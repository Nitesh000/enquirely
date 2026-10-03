import "server-only";

import Redis from "ioredis";

import { env } from "@/lib/config/env";

/**
 * Redis client, singleton across hot reloads.
 *
 * Same reasoning as `lib/db/index.ts`: Next re-evaluates modules on every
 * edit, and without the global cache each reload opens another connection
 * until Redis stops accepting them.
 *
 * Returns `null` when `REDIS_URL` is unset — callers fall back to the
 * in-memory store, so local development works with nothing extra running.
 */
const globalForRedis = globalThis as unknown as {
  EnquirelyRedis: Redis | null | undefined;
};

function createClient(): Redis | null {
  if (!env.REDIS_URL) return null;

  const client = new Redis(env.REDIS_URL, {
    // Fail fast instead of queueing commands forever: every caller of this
    // client degrades gracefully, so a hung connection is worse than an error.
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  // An unhandled 'error' event takes the process down. Rotation already
  // fails open, so log and carry on.
  client.on("error", (error) => {
    console.warn("[redis] connection error:", (error as Error).message);
  });

  return client;
}

export const redis: Redis | null =
  globalForRedis.EnquirelyRedis ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForRedis.EnquirelyRedis = redis;
}
