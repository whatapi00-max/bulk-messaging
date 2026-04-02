import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  autoReplies,
  campaignRecipients,
  campaigns,
  conversations,
  leads,
  messages,
  webhookLogs,
  whatsappNumbers,
} from "../db/schema";
import type { MetaWebhookEntry, MetaInboundMessage, MetaStatusUpdate } from "../types";
import { sendTextReply } from "./whatsapp.service";
import { logger } from "../utils/logger";
import { emitToUser } from "../socket";

function extractMessageContent(message: MetaInboundMessage): string {
  if (message.text?.body) return message.text.body;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  if (message.document?.filename) return `[document] ${message.document.filename}`;
  if (message.image?.caption) return message.image.caption;
  return `[${message.type}]`;
}

export async function processMetaWebhook(payload: { entry?: MetaWebhookEntry[] }): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      const numberRows = phoneNumberId
        ? await db
            .select()
            .from(whatsappNumbers)
            .where(eq(whatsappNumbers.phoneNumberId, phoneNumberId))
            .limit(1)
        : [];

      const number = numberRows[0];
      if (!number) continue;

      await db.insert(webhookLogs).values({
        whatsappNumberId: number.id,
        eventType: change.field,
        payload: change,
        processed: false,
      });

      for (const status of change.value?.statuses ?? []) {
        await handleStatusUpdate(number.userId, status);
      }

      for (const message of change.value?.messages ?? []) {
        await handleInboundMessage(number.id, number.userId, message);
      }

      await db
        .update(webhookLogs)
        .set({ processed: true })
        .where(eq(webhookLogs.whatsappNumberId, number.id));
    }
  }
}

async function handleStatusUpdate(userId: string, status: MetaStatusUpdate): Promise<void> {
  const [messageRow] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.userId, userId), eq(messages.metaMessageId, status.id)))
    .limit(1);

  if (!messageRow) return;

  await db.update(messages).set({ status: status.status }).where(eq(messages.id, messageRow.id));

  if (messageRow.campaignId) {
    if (status.status === "delivered") {
      await db
        .update(campaigns)
        .set({ messagesDelivered: sql`${campaigns.messagesDelivered} + 1`, updatedAt: new Date() })
        .where(eq(campaigns.id, messageRow.campaignId));
    }
    if (status.status === "read") {
      await db
        .update(campaigns)
        .set({ messagesRead: sql`${campaigns.messagesRead} + 1`, updatedAt: new Date() })
        .where(eq(campaigns.id, messageRow.campaignId));
    }
  }

  emitToUser(userId, "message:status", { messageId: messageRow.id, status: status.status });
}

async function handleInboundMessage(
  whatsappNumberId: string,
  userId: string,
  inbound: MetaInboundMessage
): Promise<void> {
  const content = extractMessageContent(inbound);

  let [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.userId, userId), eq(leads.phoneNumber, inbound.from)))
    .limit(1);

  if (!lead) {
    const inserted = await db
      .insert(leads)
      .values({ userId, phoneNumber: inbound.from, source: "whatsapp_inbound", name: null })
      .returning();
    lead = inserted[0];
  }

  const [latestOutbound] = await db
    .select({ campaignId: campaignRecipients.campaignId })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.leadId, lead.id))
    .orderBy(desc(campaignRecipients.createdAt))
    .limit(1);

  const [messageRow] = await db
    .insert(messages)
    .values({
      userId,
      leadId: lead.id,
      whatsappNumberId,
      campaignId: latestOutbound?.campaignId ?? null,
      direction: "inbound",
      messageType: inbound.type,
      content,
      metaMessageId: inbound.id,
      status: "received",
      timestamp: new Date(Number(inbound.timestamp) * 1000),
    })
    .returning();

  const existingConversations = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.leadId, lead.id)))
    .limit(1);

  let conversationId: string;

  if (existingConversations[0]) {
    conversationId = existingConversations[0].id;
    await db
      .update(conversations)
      .set({
        lastMessageId: messageRow.id,
        lastMessageAt: new Date(),
        unreadCount: sql`${conversations.unreadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, existingConversations[0].id));
  } else {
    const insertedConversation = await db.insert(conversations).values({
      userId,
      leadId: lead.id,
      whatsappNumberId,
      lastMessageId: messageRow.id,
      lastMessageAt: new Date(),
      unreadCount: 1,
      status: "active",
    }).returning({ id: conversations.id });
    conversationId = insertedConversation[0].id;
  }

  if (latestOutbound?.campaignId) {
    await db
      .update(campaigns)
      .set({ messagesReplied: sql`${campaigns.messagesReplied} + 1`, updatedAt: new Date() })
      .where(eq(campaigns.id, latestOutbound.campaignId));
  }

  const rules = await db.select().from(autoReplies).where(eq(autoReplies.userId, userId));
  const matchedRule = rules.find((rule) => {
    const keywords = Array.isArray(rule.triggerKeywords) ? (rule.triggerKeywords as string[]) : [];
    return rule.isActive && keywords.some((keyword) => content.toLowerCase().includes(keyword.toLowerCase()));
  });

  const numberRows = await db.select().from(whatsappNumbers).where(eq(whatsappNumbers.id, whatsappNumberId)).limit(1);
  const number = numberRows[0];

  if (matchedRule && number) {
    try {
      await sendTextReply(number.phoneNumberId, number.accessTokenEncrypted, inbound.from, matchedRule.responseText);
    } catch (error) {
      logger.warn("Auto-reply failed", { error });
    }
  }

  emitToUser(userId, "conversation:new-message", {
    conversationId,
    leadId: lead.id,
    message: messageRow,
  });
}
