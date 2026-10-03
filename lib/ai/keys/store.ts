import type { ExhaustionReason } from "./rotation";

/**
 * Where "this key is spent until X" is recorded.
 *
 * Kept behind an interface with no `server-only` import so the behaviour is
 * unit-testable, and so the Redis client can be swapped (Upstash HTTP on a
 * serverless deploy, for instance) without touching the rotation logic.
 */
export type KeyLimitStore = {
  /** Fingerprints currently parked, from the candidate set given. */
  getExhausted(fingerprints: readonly string[]): Promise<Set<string>>;
  markExhausted(
    fingerprint: string,
    reason: ExhaustionReason,
    ttlSeconds: number,
  ): Promise<void>;
  /** Seconds until the soonest parked key frees up, for a Retry-After. */
  soonestResetSeconds(fingerprints: readonly string[]): Promise<number>;
};

export const EXHAUSTED_KEY_PREFIX = "enquirely:groq:exhausted:";

export function redisKeyFor(fingerprint: string) {
  return `${EXHAUSTED_KEY_PREFIX}${fingerprint}`;
}

/** Minimal slice of ioredis this module actually uses. */
export type RedisLike = {
  mget(...keys: string[]): Promise<(string | null)[]>;
  set(
    key: string,
    value: string,
    mode: "EX",
    ttlSeconds: number,
  ): Promise<unknown>;
  ttl(key: string): Promise<number>;
};

/**
 * Redis-backed store.
 *
 * Every operation fails **open**: if Redis is unreachable the caller is told
 * "nothing is parked" and the request proceeds on the first key. A cache
 * outage degrading into "we might retry a spent key and get a 429" is a far
 * better failure than "no AI at all because the cache is down".
 */
export function createRedisStore(
  client: RedisLike,
  onError?: (error: unknown) => void,
): KeyLimitStore {
  return {
    async getExhausted(fingerprints) {
      if (fingerprints.length === 0) return new Set();

      try {
        const values = await client.mget(...fingerprints.map(redisKeyFor));
        const exhausted = new Set<string>();

        fingerprints.forEach((fingerprint, index) => {
          if (values[index] != null) exhausted.add(fingerprint);
        });

        return exhausted;
      } catch (error) {
        onError?.(error);
        return new Set();
      }
    },

    async markExhausted(fingerprint, reason, ttlSeconds) {
      try {
        await client.set(
          redisKeyFor(fingerprint),
          JSON.stringify({ reason, at: new Date().toISOString() }),
          "EX",
          Math.max(1, Math.ceil(ttlSeconds)),
        );
      } catch (error) {
        onError?.(error);
      }
    },

    async soonestResetSeconds(fingerprints) {
      try {
        const ttls = await Promise.all(
          fingerprints.map((fingerprint) => client.ttl(redisKeyFor(fingerprint))),
        );
        const positive = ttls.filter((ttl) => ttl > 0);
        return positive.length > 0 ? Math.min(...positive) : 60;
      } catch (error) {
        onError?.(error);
        return 60;
      }
    },
  };
}

/**
 * Process-local fallback used when `REDIS_URL` is not set.
 *
 * Correct for local development and a single instance. On a multi-instance
 * deploy each instance keeps its own view, so a key spent on one is
 * rediscovered the hard way on another — which is exactly why `REDIS_URL`
 * matters in production rather than being an optimisation.
 */
export function createMemoryStore(
  now: () => number = () => Date.now(),
): KeyLimitStore {
  const parked = new Map<string, { reason: ExhaustionReason; until: number }>();

  const live = (fingerprint: string) => {
    const entry = parked.get(fingerprint);
    if (!entry) return null;
    if (entry.until <= now()) {
      parked.delete(fingerprint);
      return null;
    }
    return entry;
  };

  return {
    async getExhausted(fingerprints) {
      const exhausted = new Set<string>();
      for (const fingerprint of fingerprints) {
        if (live(fingerprint)) exhausted.add(fingerprint);
      }
      return exhausted;
    },

    async markExhausted(fingerprint, reason, ttlSeconds) {
      parked.set(fingerprint, {
        reason,
        until: now() + Math.max(1, ttlSeconds) * 1000,
      });
    },

    async soonestResetSeconds(fingerprints) {
      const remaining = fingerprints
        .map((fingerprint) => live(fingerprint))
        .filter((entry) => entry !== null)
        .map((entry) => Math.ceil((entry.until - now()) / 1000));

      return remaining.length > 0 ? Math.min(...remaining) : 60;
    },
  };
}
