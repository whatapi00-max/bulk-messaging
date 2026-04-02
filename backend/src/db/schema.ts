import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Suppress strict table callback type issues with a cast helper — drizzle-orm types
// are always correct at runtime, the "any" is an IDE limitation before install.
/* eslint-disable @typescript-eslint/no-explicit-any */
type TableCb = (table: any) => Record<string, any>;

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  subscriptionStatus: varchar("subscription_status", { length: 50 }).default("inactive"),
  subscriptionPlan: varchar("subscription_plan", { length: 50 }),
  isActive: boolean("is_active").default(true),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Subscriptions ───────────────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  plan: varchar("plan", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("active"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  setupFeePaid: boolean("setup_fee_paid").default(false),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── WhatsApp Numbers ─────────────────────────────────────────────────────────
export const whatsappNumbers = pgTable(
  "whatsapp_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
    phoneNumberId: varchar("phone_number_id", { length: 255 }).notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    wabaId: varchar("waba_id", { length: 255 }),
    apiProvider: varchar("api_provider", { length: 50 }).default("meta"),
    apiBaseUrl: varchar("api_base_url", { length: 255 }),
    dailyLimit: integer("daily_limit").default(1000),
    messagesSentToday: integer("messages_sent_today").default(0),
    healthScore: decimal("health_score", { precision: 5, scale: 2 }).default("100.00"),
    isActive: boolean("is_active").default(true),
    isPaused: boolean("is_paused").default(false),
    pauseReason: varchar("pause_reason", { length: 255 }),
    lastResetAt: timestamp("last_reset_at", { withTimezone: true }).defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    webhookVerified: boolean("webhook_verified").default(false),
    errorCount: integer("error_count").default(0),
    successCount: integer("success_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("wa_numbers_user_id_idx").on(table.userId),
    phoneNumberIdIdx: uniqueIndex("wa_numbers_phone_number_id_idx").on(table.phoneNumberId),
  })
);

// ─── Templates ───────────────────────────────────────────────────────────────
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  language: varchar("language", { length: 10 }).default("en"),
  headerType: varchar("header_type", { length: 50 }),
  headerContent: text("header_content"),
  bodyText: text("body_text").notNull(),
  footerText: text("footer_text"),
  buttons: jsonb("buttons"),
  variables: jsonb("variables"),
  isRandomizationEnabled: boolean("is_randomization_enabled").default(false),
  variations: jsonb("variations"),
  status: varchar("status", { length: 50 }).default("draft"),
  metaTemplateName: varchar("meta_template_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    countryCode: varchar("country_code", { length: 10 }),
    tags: jsonb("tags").default([]),
    customFields: jsonb("custom_fields").default({}),
    optOut: boolean("opt_out").default(false),
    source: varchar("source", { length: 100 }),
    funnelStage: varchar("funnel_stage", { length: 50 }).default("lead"),
    totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userPhoneIdx: uniqueIndex("leads_user_phone_idx").on(table.userId, table.phoneNumber),
    userIdIdx: index("leads_user_id_idx").on(table.userId),
  })
);

// ─── Campaigns ───────────────────────────────────────────────────────────────
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    templateId: uuid("template_id").references(() => templates.id),
    status: varchar("status", { length: 50 }).default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    totalRecipients: integer("total_recipients").default(0),
    messagesSent: integer("messages_sent").default(0),
    messagesDelivered: integer("messages_delivered").default(0),
    messagesRead: integer("messages_read").default(0),
    messagesFailed: integer("messages_failed").default(0),
    messagesReplied: integer("messages_replied").default(0),
    targetFilters: jsonb("target_filters").default({}),
    numberIds: jsonb("number_ids").default([]),
    rotationStrategy: varchar("rotation_strategy", { length: 50 }).default("proportional"),
    rateLimit: integer("rate_limit").default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("campaigns_user_id_idx").on(table.userId),
    statusIdx: index("campaigns_status_idx").on(table.status),
  })
);

// ─── Campaign Recipients ──────────────────────────────────────────────────────
export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    whatsappNumberId: uuid("whatsapp_number_id").references(() => whatsappNumbers.id),
    status: varchar("status", { length: 50 }).default("pending"),
    messageId: varchar("message_id", { length: 255 }),
    templateVariables: jsonb("template_variables").default({}),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    retryCount: integer("retry_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    campaignIdx: index("cr_campaign_idx").on(table.campaignId),
    leadIdx: index("cr_lead_idx").on(table.leadId),
    statusIdx: index("cr_status_idx").on(table.status),
  })
);

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    whatsappNumberId: uuid("whatsapp_number_id").references(() => whatsappNumbers.id),
    leadId: uuid("lead_id").references(() => leads.id),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    direction: varchar("direction", { length: 10 }).notNull(),
    messageType: varchar("message_type", { length: 50 }).default("text"),
    content: text("content"),
    mediaUrl: text("media_url"),
    mediaType: varchar("media_type", { length: 100 }),
    templateName: varchar("template_name", { length: 255 }),
    status: varchar("status", { length: 50 }).default("pending"),
    metaMessageId: varchar("meta_message_id", { length: 255 }),
    errorCode: varchar("error_code", { length: 50 }),
    errorMessage: text("error_message"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("messages_user_id_idx").on(table.userId),
    leadIdIdx: index("messages_lead_id_idx").on(table.leadId),
    campaignIdIdx: index("messages_campaign_id_idx").on(table.campaignId),
    metaMsgIdIdx: index("messages_meta_msg_id_idx").on(table.metaMessageId),
  })
);

// ─── Failed Messages ──────────────────────────────────────────────────────────
export const failedMessages = pgTable(
  "failed_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    leadId: uuid("lead_id").references(() => leads.id),
    whatsappNumberId: uuid("whatsapp_number_id").references(() => whatsappNumbers.id),
    phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
    messageContent: text("message_content"),
    templateVariables: jsonb("template_variables").default({}),
    errorCode: varchar("error_code", { length: 50 }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0),
    lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),
    resolved: boolean("resolved").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("failed_messages_user_id_idx").on(table.userId),
    campaignIdIdx: index("failed_messages_campaign_id_idx").on(table.campaignId),
    resolvedIdx: index("failed_messages_resolved_idx").on(table.resolved),
  })
);

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    whatsappNumberId: uuid("whatsapp_number_id").references(() => whatsappNumbers.id),
    lastMessageId: uuid("last_message_id").references(() => messages.id),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    unreadCount: integer("unread_count").default(0),
    status: varchar("status", { length: 50 }).default("active"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("convos_user_id_idx").on(table.userId),
    leadIdIdx: index("convos_lead_id_idx").on(table.leadId),
    statusIdx: index("convos_status_idx").on(table.status),
  })
);

// ─── Auto Replies ─────────────────────────────────────────────────────────────
export const autoReplies = pgTable("auto_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  triggerKeywords: jsonb("trigger_keywords").default([]),
  triggerType: varchar("trigger_type", { length: 50 }).default("keyword"),
  responseText: text("response_text").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Webhook Logs ─────────────────────────────────────────────────────────────
export const webhookLogs = pgTable(
  "webhook_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    whatsappNumberId: uuid("whatsapp_number_id").references(() => whatsappNumbers.id),
    eventType: varchar("event_type", { length: 100 }),
    payload: jsonb("payload"),
    processed: boolean("processed").default(false),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    processedIdx: index("webhook_logs_processed_idx").on(table.processed),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  whatsappNumbers: many(whatsappNumbers),
  campaigns: many(campaigns),
  leads: many(leads),
  templates: many(templates),
  subscriptions: many(subscriptions),
  conversations: many(conversations),
}));

export const whatsappNumbersRelations = relations(whatsappNumbers, ({ one, many }) => ({
  user: one(users, { fields: [whatsappNumbers.userId], references: [users.id] }),
  messages: many(messages),
  campaignRecipients: many(campaignRecipients),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, { fields: [campaigns.userId], references: [users.id] }),
  template: one(templates, { fields: [campaigns.templateId], references: [templates.id] }),
  recipients: many(campaignRecipients),
  messages: many(messages),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  user: one(users, { fields: [leads.userId], references: [users.id] }),
  messages: many(messages),
  conversations: many(conversations),
  campaignRecipients: many(campaignRecipients),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, { fields: [messages.userId], references: [users.id] }),
  lead: one(leads, { fields: [messages.leadId], references: [leads.id] }),
  campaign: one(campaigns, { fields: [messages.campaignId], references: [campaigns.id] }),
  whatsappNumber: one(whatsappNumbers, { fields: [messages.whatsappNumberId], references: [whatsappNumbers.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  lead: one(leads, { fields: [conversations.leadId], references: [leads.id] }),
  whatsappNumber: one(whatsappNumbers, { fields: [conversations.whatsappNumberId], references: [whatsappNumbers.id] }),
  lastMessage: one(messages, { fields: [conversations.lastMessageId], references: [messages.id] }),
}));
