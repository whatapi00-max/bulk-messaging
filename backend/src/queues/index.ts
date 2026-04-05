import type { Server as SocketIOServer } from "socket.io";
import PgBoss from "pg-boss";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  campaignRecipients,
  campaigns,
  conversations,
  failedMessages,
  leads,
  messages,
  whatsappNumbers,
} from "../db/schema";
import type { MessageJobData } from "../types";
import { logger } from "../utils/logger";
import { isBannedMetaCode, sendWhatsAppMessage } from "../services/whatsapp.service";
import { decrypt } from "../utils/crypto";
import { emitToUser } from "../socket";
import {
  pickFailoverNumber,
  shouldAutoPauseNumber,
  type RotationCandidate,
} from "../services/number-rotation.service";
import { config } from "../config";

// ─── Single pg-boss instance (uses Supabase PostgreSQL — no Redis needed) ────
const JOB_NAME = "send-message";
let boss: PgBoss | null = null;

function getBoss(): PgBoss {
  if (!boss) throw new Error("pg-boss not started — call startQueueInfrastructure first");
  return boss;
}

async function processMessageJob(data: MessageJobData): Promise<void> {
  const result = await sendWhatsAppMessage({
    phoneNumberId: data.phoneNumberId,
    accessToken: data.accessToken,
    apiProvider: data.apiProvider,
    apiBaseUrl: data.apiBaseUrl,
    to: data.phoneNumber,
    messageText: data.messageText,
    templateName: data.templateName,
    templateLanguage: data.templateLanguage,
    templateVariables: data.templateVariables,
    headerImageUrl: data.headerImageUrl,
  });

  if (result.success) {
    const [insertedMessage] = await db.insert(messages).values({
      userId: data.userId,
      campaignId: data.campaignId,
      leadId: data.leadId,
      whatsappNumberId: data.whatsappNumberId,
      direction: "outbound",
      messageType: data.templateName ? "template" : "text",
      content: data.messageText ?? null,
      templateName: data.templateName,
      status: "sent",
      metaMessageId: result.messageId,
    }).returning({ id: messages.id });

    await db
      .update(campaignRecipients)
      .set({
        status: "sent",
        messageId: result.messageId,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaignRecipients.id, data.campaignRecipientId));

    await db
      .update(campaigns)
      .set({
        messagesSent: sql`${campaigns.messagesSent} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, data.campaignId));

    await db
      .update(whatsappNumbers)
      .set({
        messagesSentToday: sql`${whatsappNumbers.messagesSentToday} + 1`,
        successCount: sql`${whatsappNumbers.successCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(whatsappNumbers.id, data.whatsappNumberId));

    const existingConversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.userId, data.userId), eq(conversations.leadId, data.leadId)))
      .limit(1);

    let conversationId: string;

    if (existingConversation[0]) {
      conversationId = existingConversation[0].id;
      await db
        .update(conversations)
        .set({
          whatsappNumberId: data.whatsappNumberId,
          lastMessageId: insertedMessage.id,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));
    } else {
      const inserted = await db
        .insert(conversations)
        .values({
          userId: data.userId,
          leadId: data.leadId,
          whatsappNumberId: data.whatsappNumberId,
          lastMessageId: insertedMessage.id,
          lastMessageAt: new Date(),
          unreadCount: 0,
          status: "active",
        })
        .returning({ id: conversations.id });
      conversationId = inserted[0].id;
    }

    const leadRows = await db
      .select({ phoneNumber: leads.phoneNumber, name: leads.name })
      .from(leads)
      .where(eq(leads.id, data.leadId))
      .limit(1);

    const lead = leadRows[0];

    emitToUser(data.userId, "conversation:new-message", {
      conversationId,
      leadId: data.leadId,
      message: insertedMessage,
      lead: {
        phoneNumber: lead?.phoneNumber ?? data.phoneNumber,
        name: lead?.name ?? null,
      },
    });

    emitToUser(data.userId, "campaign:progress", {
      campaignId: data.campaignId,
      status: "sent",
      phoneNumber: data.phoneNumber,
      whatsappNumberId: data.whatsappNumberId,
    });

    return;
  }

  await db
    .update(whatsappNumbers)
    .set({
      errorCount: sql`${whatsappNumbers.errorCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(whatsappNumbers.id, data.whatsappNumberId));

  // If Meta returns banned/restricted code, mark number as banned immediately.
  if (isBannedMetaCode(result.errorCode)) {
    await db
      .update(whatsappNumbers)
      .set({
        isActive: false,
        isPaused: true,
        pauseReason: `Auto-banned by Meta (code ${result.errorCode})`,
        updatedAt: new Date(),
      })
      .where(eq(whatsappNumbers.id, data.whatsappNumberId));
  }

  if (result.isPermanentFailure) {
    const numberRows = await db
      .select({
        id: whatsappNumbers.id,
        dailyLimit: whatsappNumbers.dailyLimit,
        messagesSentToday: whatsappNumbers.messagesSentToday,
        healthScore: whatsappNumbers.healthScore,
        isActive: whatsappNumbers.isActive,
        isPaused: whatsappNumbers.isPaused,
        errorCount: whatsappNumbers.errorCount,
        phoneNumberId: whatsappNumbers.phoneNumberId,
        accessTokenEncrypted: whatsappNumbers.accessTokenEncrypted,
        apiProvider: whatsappNumbers.apiProvider,
        apiBaseUrl: whatsappNumbers.apiBaseUrl,
      })
      .from(whatsappNumbers)
      .where(eq(whatsappNumbers.userId, data.userId));

    const current = numberRows.find((n) => n.id === data.whatsappNumberId);
    if (current && shouldAutoPauseNumber(current)) {
      await db
        .update(whatsappNumbers)
        .set({ isPaused: true, pauseReason: "Auto-paused due to provider health issues", updatedAt: new Date() })
        .where(eq(whatsappNumbers.id, current.id));
    }

    const failover = pickFailoverNumber(numberRows as RotationCandidate[], data.whatsappNumberId) as
      | (RotationCandidate & {
          phoneNumberId: string;
          accessTokenEncrypted: string;
          apiProvider: string | null;
          apiBaseUrl: string | null;
        })
      | null;

    if (failover) {
      await getBoss().send(JOB_NAME, {
        ...data,
        whatsappNumberId: failover.id,
        phoneNumberId: failover.phoneNumberId,
        accessToken: decrypt(failover.accessTokenEncrypted),
        apiProvider: failover.apiProvider ?? "meta",
        apiBaseUrl: failover.apiBaseUrl ?? undefined,
        attempt: data.attempt + 1,
      });

      await db
        .update(campaignRecipients)
        .set({ whatsappNumberId: failover.id, status: "reassigned", updatedAt: new Date() })
        .where(eq(campaignRecipients.id, data.campaignRecipientId));

      emitToUser(data.userId, "campaign:failover", {
        campaignId: data.campaignId,
        fromNumberId: data.whatsappNumberId,
        toNumberId: failover.id,
        phoneNumber: data.phoneNumber,
      });
      return;
    }
  }

  if (result.shouldRetry) {
    throw new Error(result.errorMessage ?? "Retryable send failure");
  }

  await persistFinalFailure(data, result.errorMessage ?? "Permanent failure", result.errorCode);
}

async function persistFinalFailure(data: MessageJobData, errorMessage: string, errorCode?: string) {
  await db
    .update(campaignRecipients)
    .set({
      status: "failed",
      errorMessage,
      retryCount: sql`${campaignRecipients.retryCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(campaignRecipients.id, data.campaignRecipientId));

  await db
    .update(campaigns)
    .set({
      messagesFailed: sql`${campaigns.messagesFailed} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, data.campaignId));

  await db.insert(failedMessages).values({
    userId: data.userId,
    campaignId: data.campaignId,
    leadId: data.leadId,
    whatsappNumberId: data.whatsappNumberId,
    phoneNumber: data.phoneNumber,
    messageContent: data.messageText ?? null,
    templateVariables: data.templateVariables ?? {},
    errorCode: errorCode ?? null,
    errorMessage,
    retryCount: data.attempt,
    lastRetryAt: new Date(),
  });

  emitToUser(data.userId, "campaign:progress", {
    campaignId: data.campaignId,
    status: "failed",
    phoneNumber: data.phoneNumber,
    errorMessage,
  });
}

export async function enqueueMessages(jobs: MessageJobData[]): Promise<void> {
  const b = getBoss();

  // 1-second spacing per number prevents hitting Meta's per-number rate limit
  const offsetSeconds = new Map<string, number>();

  for (const job of jobs) {
    const offset = offsetSeconds.get(job.whatsappNumberId) ?? 0;
    offsetSeconds.set(job.whatsappNumberId, offset + 1);

    await b.send(JOB_NAME, job as unknown as object, {
      retryLimit: 5,
      retryDelay: 3,
      ...(offset > 0 ? { startAfter: offset } : {}),
    });
  }
}

export async function startQueueInfrastructure(_io?: SocketIOServer): Promise<void> {
  const needsSsl =
    config.DATABASE_URL.includes("supabase.co") ||
    config.DATABASE_URL.includes("neon.tech") ||
    config.DATABASE_URL.includes("sslmode=require");

  boss = new PgBoss({
    connectionString: config.DATABASE_URL,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    monitorStateIntervalSeconds: 60,
  });

  boss.on("error", (err) => logger.error("pg-boss error", { error: (err as Error).message }));

  await boss.start();
  logger.info("pg-boss queue started (Supabase PostgreSQL)");

  await boss.work(
    JOB_NAME,
    { teamSize: 5, teamConcurrency: 1, includeMetadata: true },
    async (job: PgBoss.JobWithMetadata<MessageJobData>) => {
      try {
        await processMessageJob(job.data);
        logger.info("Job completed", { jobId: job.id });
      } catch (err) {
        logger.error("Job failed", {
          jobId: job.id,
          retry: job.retrycount,
          error: (err as Error).message,
        });
        // On final retry, persist failure rather than keep throwing
        if ((job.retrycount ?? 0) >= 4) {
          await persistFinalFailure(job.data, (err as Error).message);
        } else {
          throw err; // pg-boss will retry
        }
      }
    }
  );

  logger.info("Message queue worker registered");
}
