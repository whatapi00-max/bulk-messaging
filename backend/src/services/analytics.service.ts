import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "../db";
import { campaigns, conversations, failedMessages, leads, messages, whatsappNumbers } from "../db/schema";

export async function getDashboardAnalytics(userId: string) {
  const [leadStats] = await db
    .select({
      totalLeads: sql<number>`count(*)`,
      totalRevenue: sql<string>`coalesce(sum(${leads.totalRevenue}), 0)`,
      optedOut: sql<number>`count(*) filter (where ${leads.optOut} = true)`,
    })
    .from(leads)
    .where(eq(leads.userId, userId));

  const [campaignStats] = await db
    .select({
      totalCampaigns: sql<number>`count(*)`,
      sent: sql<number>`coalesce(sum(${campaigns.messagesSent}), 0)`,
      delivered: sql<number>`coalesce(sum(${campaigns.messagesDelivered}), 0)`,
      read: sql<number>`coalesce(sum(${campaigns.messagesRead}), 0)`,
      replied: sql<number>`coalesce(sum(${campaigns.messagesReplied}), 0)`,
      failed: sql<number>`coalesce(sum(${campaigns.messagesFailed}), 0)`,
    })
    .from(campaigns)
    .where(eq(campaigns.userId, userId));

  const [numberStats] = await db
    .select({
      activeNumbers: sql<number>`count(*) filter (where ${whatsappNumbers.isActive} = true and ${whatsappNumbers.isPaused} = false)`,
      pausedNumbers: sql<number>`count(*) filter (where ${whatsappNumbers.isPaused} = true)`,
      avgHealth: sql<string>`coalesce(avg(${whatsappNumbers.healthScore}), 0)`,
    })
    .from(whatsappNumbers)
    .where(eq(whatsappNumbers.userId, userId));

  const [bannedStats] = await db
    .select({
      bannedNumbers: sql<number>`count(*)`,
    })
    .from(whatsappNumbers)
    .where(
      and(
        eq(whatsappNumbers.userId, userId),
        eq(whatsappNumbers.isPaused, true),
        ilike(whatsappNumbers.pauseReason, "%banned%")
      )
    );

  const [failedDataStats] = await db
    .select({
      failedData: sql<number>`count(*)`,
    })
    .from(failedMessages)
    .where(and(eq(failedMessages.userId, userId), eq(failedMessages.resolved, false)));

  const [inboxStats] = await db
    .select({
      openConversations: sql<number>`count(*) filter (where ${conversations.status} = 'active')`,
      unreadMessages: sql<number>`coalesce(sum(${conversations.unreadCount}), 0)`,
      failedExports: sql<number>`count(*)`,
    })
    .from(conversations)
    .leftJoin(failedMessages, eq(failedMessages.userId, conversations.userId))
    .where(eq(conversations.userId, userId));

  const recentCampaigns = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      totalRecipients: campaigns.totalRecipients,
      messagesSent: campaigns.messagesSent,
      messagesDelivered: campaigns.messagesDelivered,
      messagesRead: campaigns.messagesRead,
      messagesFailed: campaigns.messagesFailed,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .where(eq(campaigns.userId, userId))
    .orderBy(desc(campaigns.createdAt))
    .limit(10);

  const sent = Number(campaignStats?.sent ?? 0);
  const delivered = Number(campaignStats?.delivered ?? 0);
  const read = Number(campaignStats?.read ?? 0);
  const replied = Number(campaignStats?.replied ?? 0);

  return {
    summary: {
      totalLeads: Number(leadStats?.totalLeads ?? 0),
      totalRevenue: Number(leadStats?.totalRevenue ?? 0),
      activeNumbers: Number(numberStats?.activeNumbers ?? 0),
      pausedNumbers: Number(numberStats?.pausedNumbers ?? 0),
      avgHealth: Number(numberStats?.avgHealth ?? 0),
      bannedNumbers: Number(bannedStats?.bannedNumbers ?? 0),
      totalCampaigns: Number(campaignStats?.totalCampaigns ?? 0),
      totalSent: sent,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      readRate: delivered > 0 ? (read / delivered) * 100 : 0,
      replyRate: sent > 0 ? (replied / sent) * 100 : 0,
      unreadMessages: Number(inboxStats?.unreadMessages ?? 0),
      failedMessages: Number(campaignStats?.failed ?? 0),
      failedData: Number(failedDataStats?.failedData ?? 0),
    },
    recentCampaigns,
  };
}
