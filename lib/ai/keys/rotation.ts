import { createHash } from "node:crypto";

/**
 * Pure key-rotation logic: no Redis, no network, no env.
 *
 * Groq hands out several free keys with per-day caps, so the strategy is
 * "use them in order, skip the ones that are spent, reset at the daily
 * boundary". Everything here is deliberately a pure function so the part
 * that is easy to get subtly wrong --- deciding whether a 429 means
 * "wait a moment" or "this key is finished until tomorrow" --- is testable
 * without a key or a server.
 */

export type ExhaustionReason = "daily_limit" | "invalid_key";

export type FailureVerdict =
  | { exhausted: false; retryable: boolean }
  | { exhausted: true; reason: ExhaustionReason; resetSeconds: number };

/**
 * Stable, non-reversible id for a key.
 *
 * Fingerprints — never raw keys — are what get written to Redis and logs.
 * Identifying a key by its position in `GROQ_API_KEYS` would be cheaper but
 * breaks the moment someone reorders or removes one: every later key would
 * inherit the wrong exhaustion marker.
 */
export function fingerprintKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
}

/**
 * Parses Groq's rate-limit reset headers, which are durations like
 * `7.66s`, `2m59.56s` or `1h2m3s` — not plain seconds, which is the
 * obvious wrong assumption to make here.
 */
export function parseDuration(value: string | null | undefined): number | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  // A bare number is seconds (this is what `retry-after` sends).
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  const pattern = /(\d+(?:\.\d+)?)\s*(ms|h|m|s)/g;
  const unitSeconds: Record<string, number> = {
    ms: 0.001,
    s: 1,
    m: 60,
    h: 3600,
  };

  let total = 0;
  let matched = false;
  for (const match of trimmed.matchAll(pattern)) {
    matched = true;
    total += Number(match[1]) * unitSeconds[match[2]];
  }

  return matched ? total : null;
}

/** Seconds until the next UTC midnight — the fallback daily reset. */
export function secondsUntilUtcDayEnd(now: Date = new Date()): number {
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );

  return Math.max(1, Math.ceil((nextMidnight - now.getTime()) / 1000));
}

/**
 * Decides what a failed Groq response means for this key.
 *
 * The distinction that matters: Groq rate-limits per minute *and* per day
 * on the same 429. Treating a per-minute 429 as daily exhaustion would burn
 * every key in the pool within about a minute and then report "all keys
 * exhausted" for the rest of the day — so only an explicitly daily limit
 * retires a key.
 */
export function classifyFailure({
  status,
  body,
  headers,
  now = new Date(),
}: {
  status: number;
  body?: string;
  headers?: Headers | Map<string, string> | null;
  now?: Date;
}): FailureVerdict {
  const header = (name: string): string | null => {
    if (!headers) return null;
    if (headers instanceof Map) return headers.get(name) ?? null;
    return headers.get(name);
  };

  // A rejected key is not a spent key, but retrying it every request is
  // pointless. Park it for the day; a corrected key has a new fingerprint
  // and is picked up immediately.
  if (status === 401 || status === 403) {
    return {
      exhausted: true,
      reason: "invalid_key",
      resetSeconds: secondsUntilUtcDayEnd(now),
    };
  }

  if (status !== 429) {
    return { exhausted: false, retryable: status >= 500 };
  }

  const text = body ?? "";
  const isDaily = /per\s*day|\bTPD\b|\bRPD\b|daily/i.test(text);

  if (!isDaily) {
    // Per-minute ceiling: the same key works again shortly.
    return { exhausted: false, retryable: true };
  }

  const resetSeconds =
    parseDuration(header("retry-after")) ??
    parseDuration(header("x-ratelimit-reset-tokens")) ??
    parseDuration(header("x-ratelimit-reset-requests")) ??
    secondsUntilUtcDayEnd(now);

  return {
    exhausted: true,
    reason: "daily_limit",
    // Never park a key for less than a minute on a daily limit; a tiny
    // reset value here is far more likely to be a parse quirk than truth.
    resetSeconds: Math.max(60, Math.ceil(resetSeconds)),
  };
}

/**
 * First key, in configured order, that is not currently parked.
 *
 * "In order" is the whole point: key 1 is drained before key 2 is touched,
 * which keeps the spend predictable instead of spreading usage thinly
 * across every key and exhausting them all at once.
 */
export function selectKey(
  keys: readonly string[],
  exhausted: ReadonlySet<string>,
): { key: string; fingerprint: string } | null {
  for (const key of keys) {
    const fingerprint = fingerprintKey(key);
    if (!exhausted.has(fingerprint)) return { key, fingerprint };
  }

  return null;
}

export class AllKeysExhaustedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      `Every Groq API key has hit its limit. Next reset in roughly ${Math.ceil(
        retryAfterSeconds / 60,
      )} minute(s).`,
    );
    this.name = "AllKeysExhaustedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
