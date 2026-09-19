import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

/**
 * Drizzle client, kept as a singleton across hot reloads.
 *
 * Next's dev server re-evaluates modules on every change; without the global
 * cache each reload opens a fresh pool and Postgres runs out of connections
 * after a few minutes of editing.
 */
const globalForDb = globalThis as unknown as {
  inquirelySql: ReturnType<typeof postgres> | undefined;
};

const sql =
  globalForDb.inquirelySql ??
  postgres(env.DATABASE_URL, {
    // Serverless-friendly: one connection per instance, short idle timeout.
    max: env.NODE_ENV === "production" ? 1 : 5,
    idle_timeout: 20,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.inquirelySql = sql;
}

export const db = drizzle(sql, { schema, casing: "snake_case" });

export { schema };
export type Database = typeof db;
