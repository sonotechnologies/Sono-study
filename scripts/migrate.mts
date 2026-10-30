/**
 * Brings the production database up to date: applies db/migrations and adds the school list.
 * Runs before every Vercel build (the "vercel-build" script), so a deploy never meets missing
 * tables. Without DATABASE_URL (local dev, CI) it does nothing: the embedded database migrates itself.
 * Usage: npm run db:setup
 */
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("No DATABASE_URL: skipping migrations.");
  process.exit(0);
}
const { Pool } = await import("@neondatabase/serverless");
const { drizzle } = await import("drizzle-orm/neon-serverless");
const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
const schema = await import("../db/schema");
const { ensureSchools } = await import("../db/seed");

const pool = new Pool({ connectionString: url });
const db = drizzle({ client: pool, schema });
await migrate(db, { migrationsFolder: "./db/migrations" });
await ensureSchools(db as never);
await pool.end();
console.log("Database is up to date.");
