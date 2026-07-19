/**
 * Drizzle client. Neon serverless driver for Neon URLs (production path per
 * docs/01-ARCHITECTURE.md); node-postgres for any other Postgres (local dev,
 * CI). Singleton across HMR reloads.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __cleaDb?: Db; __cleaPool?: Pool };

function createDb(): Db {
  if (/neon\.tech/.test(env.DATABASE_URL)) {
    // Lazy require so local dev never loads the Neon driver.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require("@neondatabase/serverless");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle: drizzleNeon } = require("drizzle-orm/neon-http");
    return drizzleNeon(neon(env.DATABASE_URL), { schema, casing: "snake_case" }) as unknown as Db;
  }
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  globalForDb.__cleaPool = pool;
  return drizzle(pool, { schema, casing: "snake_case" });
}

export const db: Db = globalForDb.__cleaDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__cleaDb = db;

/** Close the pool — used by CLI scripts (seed, smoke) so the process exits. */
export async function closeDb(): Promise<void> {
  await globalForDb.__cleaPool?.end();
  globalForDb.__cleaDb = undefined;
  globalForDb.__cleaPool = undefined;
}

export { schema };
