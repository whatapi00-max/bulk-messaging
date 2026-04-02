import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema";
import * as path from "path";
import "dotenv/config";

async function runMigration() {
  const url = process.env.DATABASE_URL!;
  const ssl = url.includes("neon.tech") || url.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false;
  const pool = new Pool({ connectionString: url, ssl });
  const db = drizzle(pool, { schema });

  console.log("⏳ Running database migrations...");

  await migrate(db, {
    migrationsFolder: path.join(__dirname, "../../drizzle"),
  });

  console.log("✅ Migrations completed successfully");
  await pool.end();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
