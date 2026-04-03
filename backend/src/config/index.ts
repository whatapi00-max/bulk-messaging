import dotenv from "dotenv";
import path from "path";
import { existsSync } from "fs";
import { z } from "zod";

// Local dev: .env lives at the monorepo root (backend/../.env or backend/../../.env).
// Production (Render): no .env file — env vars are injected by the platform.
const candidates = [
  path.resolve(process.cwd(), "../.env"),       // repo root (dev: run from backend/)
  path.resolve(__dirname, "../../../.env"),     // repo root (tsx: __dirname = src/config/)
  path.resolve(process.cwd(), ".env"),          // backend/.env fallback
];
for (const p of candidates) {
  if (existsSync(p)) { dotenv.config({ path: p }); break; }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("8080"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_SETUP_PRICE_ID: z.string().optional().default(""),
  STRIPE_MONTHLY_PRICE_ID: z.string().optional().default(""),
  FRONTEND_URL: z.string().url().default("http://localhost:8000"),
  APP_BASE_URL: z.string().url().default("http://localhost:8080"),
  META_API_VERSION: z.string().default("v18.0"),
  META_GRAPH_URL: z.string().url().default("https://graph.facebook.com"),
  META_VERIFY_TOKEN: z.string().default("wacrm_webhook_verify"),
  META_APP_SECRET: z.string().optional().default(""),
  OWNER_EMAIL: z.string().email("OWNER_EMAIL must be a valid email"),
  OWNER_PASSWORD: z
    .string()
    .min(16, "OWNER_PASSWORD must be at least 16 characters")
    .regex(/[a-z]/, "OWNER_PASSWORD must include a lowercase letter")
    .regex(/[A-Z]/, "OWNER_PASSWORD must include an uppercase letter")
    .regex(/[0-9]/, "OWNER_PASSWORD must include a number")
    .regex(/[^A-Za-z0-9]/, "OWNER_PASSWORD must include a special character"),
  OWNER_FULL_NAME: z.string().min(2, "OWNER_FULL_NAME is required"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
