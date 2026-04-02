import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { config } from "./index";

const ssl = config.DATABASE_URL.includes("neon.tech") ||
  config.DATABASE_URL.includes("sslmode=require")
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({ connectionString: config.DATABASE_URL, ssl });

export const db = drizzle(pool, { schema });
export type DB = typeof db;
