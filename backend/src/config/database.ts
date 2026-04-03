import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { config } from "./index";

function needsSsl(url: string): boolean {
  return (
    url.includes("supabase.co") ||
    url.includes("neon.tech") ||
    url.includes("sslmode=require")
  );
}

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: needsSsl(config.DATABASE_URL) ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;
