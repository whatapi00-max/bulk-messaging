import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { conversations, leads, messages, whatsappNumbers } from "../db/schema";
import { sendTextReply } from "./whatsapp.service";

export async function listConversations(userId: string) {
  return db
    .select({
      id: conversations.id,
      status: conversations.status,
      unreadCount: conversations.unreadCount,
      lastMessageAt: conversations.lastMessageAt,
      leadId: leads.id,
      leadName: leads.name,
      phoneNumber: leads.phoneNumber,
      whatsappNumberId: conversations.whatsappNumberId,
    })
    .from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getConversationThread(userId: string, conversationId: string) {
  const convo = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!convo[0]) throw new Error("Conversation not found");

  const thread = await db
    .select()
    .from(messages)
    .where(and(eq(messages.userId, userId), eq(messages.leadId, convo[0].leadId)))
    .orderBy(desc(messages.timestamp));

  return { conversation: convo[0], messages: thread.reverse() };
}

export async function sendConversationReply(
  userId: string,
  conversationId: string,
  content: string
) {
  const result = await db
    .select({
      conversationId: conversations.id,
      leadId: leads.id,
      to: leads.phoneNumber,
      phoneNumberId: whatsappNumbers.phoneNumberId,
      token: whatsappNumbers.accessTokenEncrypted,
      whatsappNumberId: whatsappNumbers.id,
    })
    .from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id))
    .innerJoin(whatsappNumbers, eq(conversations.whatsappNumberId, whatsappNumbers.id))
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  const convo = result[0];
  if (!convo) throw new Error("Conversation not found");

  const sendResult = await sendTextReply(convo.phoneNumberId, convo.token, convo.to, content);
  if (!sendResult.success) {
    throw new Error(sendResult.errorMessage ?? "Failed to send reply");
  }

  const [message] = await db
    .insert(messages)
    .values({
      userId,
      leadId: convo.leadId,
      whatsappNumberId: convo.whatsappNumberId,
      direction: "outbound",
      messageType: "text",
      content,
      status: "sent",
      metaMessageId: sendResult.messageId,
    })
    .returning();

  await db
    .update(conversations)
    .set({ lastMessageId: message.id, lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return { success: true, message };
}
