import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { db } from "../db";
import { campaignRecipients, campaigns, failedMessages, leads, whatsappNumbers } from "../db/schema";
import { calculateProportionalAllocation } from "../services/number-rotation.service";
import { enqueueMessages } from "../queues";
import { decrypt } from "../utils/crypto";
import { streamFailedMessagesCsv, streamFailedMessagesXlsx } from "../utils/export";
import type { MessageJobData } from "../types";

export const campaignsRouter = Router();

campaignsRouter.use(requireAuth);

const campaignSchema = z
  .object({
    name: z.string().min(2),
    description: z.string().optional(),
    templateId: z.string().uuid().optional(),
    leadIds: z.array(z.string().uuid()).min(1),
    numberIds: z.array(z.string().uuid()).min(1),
    messageText: z.string().optional(),
    templateName: z.string().optional(),
    templateLanguage: z.string().default("en"),
    templateVariables: z.record(z.string()).optional(),
    scheduledAt: z.string().datetime().optional(),
    rotationStrategy: z.enum(["proportional", "round_robin", "failover_first"]).default("proportional"),
  })
  .refine(
    (data) => Boolean(data.messageText?.trim()) || Boolean(data.templateName?.trim()),
    { message: "Either messageText or templateName is required", path: ["messageText"] }
  );

const updateCampaignSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "scheduled", "running", "paused", "completed", "failed", "canceled"]).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

campaignsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, req.user!.userId))
      .orderBy(desc(campaigns.createdAt));

    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/", validateBody(campaignSchema), async (req, res, next) => {
  try {
    const hasMessageText = typeof req.body.messageText === "string" && req.body.messageText.trim().length > 0;
    const hasTemplateName = typeof req.body.templateName === "string" && req.body.templateName.trim().length > 0;
    if (!hasMessageText && !hasTemplateName) {
      res.status(400).json({ error: "Either message text or template name is required" });
      return;
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        userId: req.user!.userId,
        name: req.body.name,
        description: req.body.description,
        templateId: req.body.templateId,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        totalRecipients: req.body.leadIds.length,
        numberIds: req.body.numberIds,
        targetFilters: {
          leadIds: req.body.leadIds,
          messageText: hasMessageText ? req.body.messageText.trim() : undefined,
          templateName: hasTemplateName ? req.body.templateName.trim() : undefined,
          templateLanguage: req.body.templateLanguage,
          templateVariables: req.body.templateVariables ?? {},
        },
        rotationStrategy: req.body.rotationStrategy,
        status: req.body.scheduledAt ? "scheduled" : "draft",
      })
      .returning();

    res.status(201).json({ data: campaign });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/:id/start", async (req, res, next) => {
  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, req.params.id), eq(campaigns.userId, req.user!.userId)))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const config = (campaign.targetFilters ?? {}) as {
      leadIds?: string[];
      messageText?: string;
      templateName?: string;
      templateLanguage?: string;
      templateVariables?: Record<string, string>;
    };

    const leadIds = Array.isArray(config.leadIds) ? config.leadIds : [];
    const numberIds = Array.isArray(campaign.numberIds) ? (campaign.numberIds as string[]) : [];

    const leadRows = leadIds.length
      ? await db.select().from(leads).where(and(eq(leads.userId, req.user!.userId), inArray(leads.id, leadIds)))
      : [];

    const numberRows = numberIds.length
      ? await db
          .select()
          .from(whatsappNumbers)
          .where(and(eq(whatsappNumbers.userId, req.user!.userId), inArray(whatsappNumbers.id, numberIds)))
      : [];

    if (leadRows.length === 0 || numberRows.length === 0) {
      res.status(400).json({ error: "Campaign requires at least one lead and one active number" });
      return;
    }

    const allocation = calculateProportionalAllocation(numberRows, leadRows.length);
    if (allocation.length === 0) {
      res.status(400).json({ error: "No eligible WhatsApp numbers available for this campaign" });
      return;
    }

    let pointer = 0;
    const recipientPayload: Array<{
      leadId: string;
      whatsappNumberId: string;
    }> = [];

    for (const slot of allocation) {
      for (let i = 0; i < slot.count && pointer < leadRows.length; i += 1) {
        recipientPayload.push({
          leadId: leadRows[pointer].id,
          whatsappNumberId: slot.numberId,
        });
        pointer += 1;
      }
    }

    const insertedRecipients = await db
      .insert(campaignRecipients)
      .values(
        recipientPayload.map((item) => ({
          campaignId: campaign.id,
          leadId: item.leadId,
          whatsappNumberId: item.whatsappNumberId,
          status: "queued",
          templateVariables: config.templateVariables ?? {},
        }))
      )
      .returning();

    const leadMap = new Map(leadRows.map((lead) => [lead.id, lead]));
    const numberMap = new Map(numberRows.map((number) => [number.id, number]));

    const jobs: MessageJobData[] = insertedRecipients.map((recipient) => {
      const lead = leadMap.get(recipient.leadId)!;
      const number = numberMap.get(recipient.whatsappNumberId!)!;

      return {
        userId: req.user!.userId,
        campaignId: campaign.id,
        campaignRecipientId: recipient.id,
        leadId: lead.id,
        phoneNumber: lead.phoneNumber,
        whatsappNumberId: number.id,
        phoneNumberId: number.phoneNumberId,
        accessToken: decrypt(number.accessTokenEncrypted),
        apiProvider: number.apiProvider ?? "meta",
        apiBaseUrl: number.apiBaseUrl ?? undefined,
        templateName: config.templateName,
        templateLanguage: config.templateLanguage,
        templateVariables: config.templateVariables ?? {},
        messageText: config.messageText,
        attempt: 1,
      };
    });

    await enqueueMessages(jobs);

    await db
      .update(campaigns)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaigns.id, campaign.id));

    res.json({
      success: true,
      queued: jobs.length,
      allocation,
    });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.patch("/:id", validateBody(updateCampaignSchema), async (req, res, next) => {
  try {
    const [updated] = await db
      .update(campaigns)
      .set({
        ...req.body,
        ...(req.body.scheduledAt !== undefined
          ? { scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, req.params.id), eq(campaigns.userId, req.user!.userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, req.params.id), eq(campaigns.userId, req.user!.userId)))
      .returning({ id: campaigns.id });

    if (!deleted.length) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    res.json({ data: { id: deleted[0].id } });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/:id/failed/export", async (req, res, next) => {
  try {
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";
    const rows = await db
      .select({
        id: failedMessages.id,
        phone_number: failedMessages.phoneNumber,
        message_content: failedMessages.messageContent,
        error_code: failedMessages.errorCode,
        error_message: failedMessages.errorMessage,
        retry_count: failedMessages.retryCount,
        campaign_id: failedMessages.campaignId,
        created_at: failedMessages.createdAt,
      })
      .from(failedMessages)
      .where(and(eq(failedMessages.userId, req.user!.userId), eq(failedMessages.campaignId, req.params.id)));

    if (format === "xlsx") {
      await streamFailedMessagesXlsx(res, rows.map((r) => ({ ...r, retry_count: r.retry_count ?? 0 })));
      return;
    }

    await streamFailedMessagesCsv(res, rows.map((r) => ({ ...r, retry_count: r.retry_count ?? 0 })));
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/:id/retry-failed", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(failedMessages)
      .where(
        and(
          eq(failedMessages.userId, req.user!.userId),
          eq(failedMessages.campaignId, req.params.id),
          eq(failedMessages.resolved, false)
        )
      );

    if (rows.length === 0) {
      res.json({ success: true, retried: 0 });
      return;
    }

    const numberRows = await db.select().from(whatsappNumbers).where(eq(whatsappNumbers.userId, req.user!.userId));
    const numberMap = new Map(numberRows.map((number) => [number.id, number]));

    const jobs: MessageJobData[] = [];

    for (const failed of rows) {
      if (!failed.whatsappNumberId) continue;
      const number = numberMap.get(failed.whatsappNumberId);
      if (!number) continue;

      jobs.push({
        userId: failed.userId,
        campaignId: failed.campaignId ?? req.params.id,
        campaignRecipientId: "",
        leadId: failed.leadId ?? "",
        phoneNumber: failed.phoneNumber,
        whatsappNumberId: number.id,
        phoneNumberId: number.phoneNumberId,
        accessToken: decrypt(number.accessTokenEncrypted),
        apiProvider: number.apiProvider ?? "meta",
        apiBaseUrl: number.apiBaseUrl ?? undefined,
        messageText: failed.messageContent ?? undefined,
        templateVariables: (failed.templateVariables as Record<string, string>) ?? {},
        attempt: (failed.retryCount ?? 0) + 1,
      });
    }

    await enqueueMessages(jobs);

    res.json({ success: true, retried: jobs.length });
  } catch (error) {
    next(error);
  }
});
