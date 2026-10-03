import { describe, expect, it } from "vitest";

import {
  classifyFailure,
  fingerprintKey,
  parseDuration,
  secondsUntilUtcDayEnd,
  selectKey,
} from "@/lib/ai/keys/rotation";

describe("fingerprintKey", () => {
  it("is stable for the same key", () => {
    expect(fingerprintKey("gsk_abc")).toBe(fingerprintKey("gsk_abc"));
  });

  it("differs between keys", () => {
    expect(fingerprintKey("gsk_abc")).not.toBe(fingerprintKey("gsk_def"));
  });

  it("never contains the key itself", () => {
    const key = "gsk_supersecretvalue";
    expect(fingerprintKey(key)).not.toContain("supersecret");
  });
});

describe("parseDuration", () => {
  const cases: Array<[input: string, expected: number]> = [
    ["7.66s", 7.66],
    ["2m59.56s", 179.56],
    ["1h2m3s", 3723],
    ["500ms", 0.5],
    ["30", 30], // bare number == seconds, which is what retry-after sends
  ];

  it.each(cases)("parses %j as %j seconds", (input, expected) => {
    expect(parseDuration(input)).toBeCloseTo(expected, 2);
  });

  it("returns null for junk and empties", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration("soon")).toBeNull();
  });
});

describe("secondsUntilUtcDayEnd", () => {
  it("counts to the next UTC midnight", () => {
    const at2300 = new Date("2026-10-03T23:00:00.000Z");
    expect(secondsUntilUtcDayEnd(at2300)).toBe(3600);
  });

  it("is always positive, even at midnight exactly", () => {
    expect(
      secondsUntilUtcDayEnd(new Date("2026-10-03T00:00:00.000Z")),
    ).toBeGreaterThan(0);
  });
});

describe("classifyFailure", () => {
  it("does NOT retire a key for a per-minute 429", () => {
    const verdict = classifyFailure({
      status: 429,
      body: "Rate limit reached ... on requests per minute (RPM): Limit 30",
    });

    // The whole pool would be dead in a minute if this retired keys.
    expect(verdict.exhausted).toBe(false);
    if (verdict.exhausted) return;
    expect(verdict.retryable).toBe(true);
  });

  it("retires a key on a per-day token limit", () => {
    const verdict = classifyFailure({
      status: 429,
      body: "Rate limit reached ... on tokens per day (TPD): Limit 500000",
    });

    expect(verdict.exhausted).toBe(true);
    if (!verdict.exhausted) return;
    expect(verdict.reason).toBe("daily_limit");
  });

  it("retires a key on a per-day request limit", () => {
    const verdict = classifyFailure({
      status: 429,
      body: "Rate limit reached on requests per day (RPD): Limit 14400",
    });

    expect(verdict.exhausted).toBe(true);
  });

  it("prefers retry-after over the day-end fallback", () => {
    const verdict = classifyFailure({
      status: 429,
      body: "tokens per day (TPD) exceeded",
      headers: new Map([["retry-after", "7200"]]),
    });

    expect(verdict.exhausted).toBe(true);
    if (!verdict.exhausted) return;
    expect(verdict.resetSeconds).toBe(7200);
  });

  it("parses Groq's duration-style reset header", () => {
    const verdict = classifyFailure({
      status: 429,
      body: "tokens per day (TPD) exceeded",
      headers: new Map([["x-ratelimit-reset-tokens", "1h30m"]]),
    });

    expect(verdict.exhausted).toBe(true);
    if (!verdict.exhausted) return;
    expect(verdict.resetSeconds).toBe(5400);
  });

  it("floors a daily park at one minute", () => {
    const verdict = classifyFailure({
      status: 429,
      body: "tokens per day (TPD) exceeded",
      headers: new Map([["retry-after", "2"]]),
    });

    expect(verdict.exhausted).toBe(true);
    if (!verdict.exhausted) return;
    expect(verdict.resetSeconds).toBe(60);
  });

  it("parks a rejected key", () => {
    for (const status of [401, 403]) {
      const verdict = classifyFailure({ status });
      expect(verdict.exhausted).toBe(true);
      if (!verdict.exhausted) return;
      expect(verdict.reason).toBe("invalid_key");
    }
  });

  it("treats 5xx as retryable but not exhausted", () => {
    const verdict = classifyFailure({ status: 503 });
    expect(verdict.exhausted).toBe(false);
    if (verdict.exhausted) return;
    expect(verdict.retryable).toBe(true);
  });

  it("treats 400 as neither exhausted nor retryable", () => {
    const verdict = classifyFailure({ status: 400, body: "bad request" });
    expect(verdict.exhausted).toBe(false);
    if (verdict.exhausted) return;
    expect(verdict.retryable).toBe(false);
  });
});

describe("selectKey", () => {
  const keys = ["key-one", "key-two", "key-three"];

  it("returns the first key when none are parked", () => {
    expect(selectKey(keys, new Set())?.key).toBe("key-one");
  });

  it("drains in order rather than spreading load", () => {
    const exhausted = new Set([fingerprintKey("key-one")]);
    expect(selectKey(keys, exhausted)?.key).toBe("key-two");
  });

  it("skips over several parked keys", () => {
    const exhausted = new Set([
      fingerprintKey("key-one"),
      fingerprintKey("key-two"),
    ]);
    expect(selectKey(keys, exhausted)?.key).toBe("key-three");
  });

  it("returns null when every key is parked", () => {
    const exhausted = new Set(keys.map(fingerprintKey));
    expect(selectKey(keys, exhausted)).toBeNull();
  });

  it("returns null for an empty pool", () => {
    expect(selectKey([], new Set())).toBeNull();
  });

  it("is unaffected by reordering the pool", () => {
    // Fingerprints are content-based, so a parked key stays parked even if
    // it moves position in GROQ_API_KEYS.
    const exhausted = new Set([fingerprintKey("key-two")]);
    expect(selectKey(["key-two", "key-one"], exhausted)?.key).toBe("key-one");
  });
});
