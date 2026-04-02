CREATE TABLE IF NOT EXISTS "auto_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"trigger_keywords" jsonb DEFAULT '[]'::jsonb,
	"trigger_type" varchar(50) DEFAULT 'keyword',
	"response_text" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"whatsapp_number_id" uuid,
	"status" varchar(50) DEFAULT 'pending',
	"message_id" varchar(255),
	"template_variables" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"template_id" uuid,
	"status" varchar(50) DEFAULT 'draft',
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_recipients" integer DEFAULT 0,
	"messages_sent" integer DEFAULT 0,
	"messages_delivered" integer DEFAULT 0,
	"messages_read" integer DEFAULT 0,
	"messages_failed" integer DEFAULT 0,
	"messages_replied" integer DEFAULT 0,
	"target_filters" jsonb DEFAULT '{}'::jsonb,
	"number_ids" jsonb DEFAULT '[]'::jsonb,
	"rotation_strategy" varchar(50) DEFAULT 'proportional',
	"rate_limit" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"whatsapp_number_id" uuid,
	"last_message_id" uuid,
	"last_message_at" timestamp with time zone,
	"unread_count" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'active',
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "failed_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"campaign_id" uuid,
	"lead_id" uuid,
	"whatsapp_number_id" uuid,
	"phone_number" varchar(50) NOT NULL,
	"message_content" text,
	"template_variables" jsonb DEFAULT '{}'::jsonb,
	"error_code" varchar(50),
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"last_retry_at" timestamp with time zone,
	"resolved" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"country_code" varchar(10),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"opt_out" boolean DEFAULT false,
	"source" varchar(100),
	"funnel_stage" varchar(50) DEFAULT 'lead',
	"total_revenue" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"whatsapp_number_id" uuid,
	"lead_id" uuid,
	"campaign_id" uuid,
	"direction" varchar(10) NOT NULL,
	"message_type" varchar(50) DEFAULT 'text',
	"content" text,
	"media_url" text,
	"media_type" varchar(100),
	"template_name" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"meta_message_id" varchar(255),
	"error_code" varchar(50),
	"error_message" text,
	"timestamp" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_subscription_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"plan" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"setup_fee_paid" boolean DEFAULT false,
	"amount" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100),
	"language" varchar(10) DEFAULT 'en',
	"header_type" varchar(50),
	"header_content" text,
	"body_text" text NOT NULL,
	"footer_text" text,
	"buttons" jsonb,
	"variables" jsonb,
	"is_randomization_enabled" boolean DEFAULT false,
	"variations" jsonb,
	"status" varchar(50) DEFAULT 'draft',
	"meta_template_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"stripe_customer_id" varchar(255),
	"subscription_status" varchar(50) DEFAULT 'inactive',
	"subscription_plan" varchar(50),
	"is_active" boolean DEFAULT true,
	"onboarding_completed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"whatsapp_number_id" uuid,
	"event_type" varchar(100),
	"payload" jsonb,
	"processed" boolean DEFAULT false,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"phone_number_id" varchar(255) NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"waba_id" varchar(255),
	"api_provider" varchar(50) DEFAULT 'meta',
	"api_base_url" varchar(255),
	"daily_limit" integer DEFAULT 1000,
	"messages_sent_today" integer DEFAULT 0,
	"health_score" numeric(5, 2) DEFAULT '100.00',
	"is_active" boolean DEFAULT true,
	"is_paused" boolean DEFAULT false,
	"pause_reason" varchar(255),
	"last_reset_at" timestamp with time zone DEFAULT now(),
	"last_message_at" timestamp with time zone,
	"webhook_verified" boolean DEFAULT false,
	"error_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cr_campaign_idx" ON "campaign_recipients" ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cr_lead_idx" ON "campaign_recipients" ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cr_status_idx" ON "campaign_recipients" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_user_id_idx" ON "campaigns" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "convos_user_id_idx" ON "conversations" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "convos_lead_id_idx" ON "conversations" ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "convos_status_idx" ON "conversations" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "failed_messages_user_id_idx" ON "failed_messages" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "failed_messages_campaign_id_idx" ON "failed_messages" ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "failed_messages_resolved_idx" ON "failed_messages" ("resolved");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leads_user_phone_idx" ON "leads" ("user_id","phone_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_user_id_idx" ON "leads" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_user_id_idx" ON "messages" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_lead_id_idx" ON "messages" ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_campaign_id_idx" ON "messages" ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_meta_msg_id_idx" ON "messages" ("meta_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_logs_processed_idx" ON "webhook_logs" ("processed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wa_numbers_user_id_idx" ON "whatsapp_numbers" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wa_numbers_phone_number_id_idx" ON "whatsapp_numbers" ("phone_number_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auto_replies" ADD CONSTRAINT "auto_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_whatsapp_number_id_whatsapp_numbers_id_fk" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_whatsapp_number_id_whatsapp_numbers_id_fk" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_last_message_id_messages_id_fk" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "failed_messages" ADD CONSTRAINT "failed_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "failed_messages" ADD CONSTRAINT "failed_messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "failed_messages" ADD CONSTRAINT "failed_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "failed_messages" ADD CONSTRAINT "failed_messages_whatsapp_number_id_whatsapp_numbers_id_fk" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_whatsapp_number_id_whatsapp_numbers_id_fk" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_whatsapp_number_id_whatsapp_numbers_id_fk" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_numbers" ADD CONSTRAINT "whatsapp_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
