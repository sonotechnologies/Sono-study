import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = "./db/migrations";

const globalForDb = globalThis as unknown as { __sonoDb?: Promise<Db> };

/**
 * Production: Neon Postgres (DATABASE_URL). Local dev without DATABASE_URL:
 * an embedded PGlite database (same SQL, pgvector included), migrated and
 * seeded with demo data on first use so the app runs with zero setup.
 */
export function getDb(): Promise<Db> {
  globalForDb.__sonoDb ??= connect().catch((err) => {
    globalForDb.__sonoDb = undefined; // retry on the next request
    throw err;
  });
  return globalForDb.__sonoDb;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    return drizzle({ client: new Pool({ connectionString: url }), schema }) as unknown as Db;
  }
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EMBEDDED_DB) {
    throw new Error("DATABASE_URL is not set");
  }
  const db = await createPgliteDb(process.env.PGLITE_DIR ?? "./.next/cache/pglite");
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db);
  return db;
}

/** Embedded Postgres used for local dev and tests. Pass no dir for in-memory. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) await (await import("node:fs/promises")).mkdir(dataDir, { recursive: true });
  const client = new PGlite({ dataDir, extensions: { vector } });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

export { schema };
