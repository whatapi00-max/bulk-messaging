import type { Server as SocketIOServer } from "socket.io";
import { Queue, Worker, type Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";
import { createRedisConnection } from "../config/redis";
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

const queueMap = new Map<string, Queue<MessageJobData>>();
const workerMap = new Map<string, Worker<MessageJobData>>();

function getQueueName(numberId: string): string {
  const safeNumberId = numberId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `messages-number-${safeNumberId}`;
}

function getOrCreateQueue(numberId: string): Queue<MessageJobData> {
  const existing = queueMap.get(numberId);
  if (existing) return existing;

  const queue = new Queue<MessageJobData>(getQueueName(numberId), {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: 1000,
      removeOnFail: 2000,
    },
  });

  queueMap.set(numberId, queue);
  return queue;
}

function ensureWorker(numberId: string): Worker<MessageJobData> {
  const existing = workerMap.get(numberId);
  if (existing) return existing;

  const worker = new Worker<MessageJobData>(
    getQueueName(numberId),
    async (job) => processMessageJob(job),
    {
      connection: createRedisConnection(),
      concurrency: 20,
      limiter: { max: 1, duration: 1000 },
    }
  );

  worker.on("completed", (job) => {
    logger.info("Queue job completed", { jobId: job.id, queue: getQueueName(numberId) });
  });

  worker.on("failed", async (job, error) => {
    logger.error("Queue job failed", {
      queue: getQueueName(numberId),
      jobId: job?.id,
      error: error.message,
    });

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await persistFinalFailure(job.data, error.message);
    }
  });

  workerMap.set(numberId, worker);
  return worker;
}

async function processMessageJob(job: Job<MessageJobData>): Promise<void> {
  const data = job.data;
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
      ensureWorker(failover.id);
      const queue = getOrCreateQueue(failover.id);
      await queue.add("send-message-failover", {
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
  for (const job of jobs) {
    ensureWorker(job.whatsappNumberId);
    const queue = getOrCreateQueue(job.whatsappNumberId);
    await queue.add("send-message", job);
  }
}

export async function startQueueInfrastructure(_io?: SocketIOServer): Promise<void> {
  logger.info("BullMQ infrastructure ready");
}
