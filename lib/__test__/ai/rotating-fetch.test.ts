import { describe, expect, it } from "vitest";

import { AllKeysExhaustedError, fingerprintKey } from "@/lib/ai/keys/rotation";
import { createRotatingFetch } from "@/lib/ai/keys/rotating-fetch";
import { createMemoryStore, createRedisStore } from "@/lib/ai/keys/store";

const KEYS = ["gsk_one", "gsk_two", "gsk_three"];

function dailyLimit() {
  return new Response(
    "Rate limit reached for model in organization on tokens per day (TPD): Limit 500000",
    { status: 429, headers: { "retry-after": "3600" } },
  );
}

function minuteLimit() {
  return new Response(
    "Rate limit reached on requests per minute (RPM): Limit 30",
    { status: 429, headers: { "retry-after": "8" } },
  );
}

/** Records which key each attempt used, so order is assertable. */
function recordingFetch(responses: Array<() => Response>) {
  const used: string[] = [];
  let call = 0;

  const fetchImpl = (async (_input: unknown, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get("Authorization") ?? "";
    used.push(auth.replace("Bearer ", ""));
    const make = responses[Math.min(call++, responses.length - 1)];
    return make();
  }) as unknown as typeof fetch;

  return { fetchImpl, used };
}

describe("rotating fetch", () => {
  it("uses the first key when nothing is parked", async () => {
    const { fetchImpl, used } = recordingFetch([() => new Response("ok")]);
    const doFetch = createRotatingFetch({
      keys: KEYS,
      store: createMemoryStore(),
      fetchImpl,
    });

    const response = await doFetch("https://api.groq.com/v1/chat");

    expect(response.ok).toBe(true);
    expect(used).toEqual(["gsk_one"]);
  });

  it("moves to the next key when the first is spent for the day", async () => {
    const { fetchImpl, used } = recordingFetch([
      dailyLimit,
      () => new Response("ok"),
    ]);
    const doFetch = createRotatingFetch({
      keys: KEYS,
      store: createMemoryStore(),
      fetchImpl,
    });

    const response = await doFetch("https://api.groq.com/v1/chat");

    expect(response.ok).toBe(true);
    expect(used).toEqual(["gsk_one", "gsk_two"]);
  });

  it("remembers the parked key on the next request", async () => {
    const store = createMemoryStore();

    const first = recordingFetch([dailyLimit, () => new Response("ok")]);
    await createRotatingFetch({ keys: KEYS, store, fetchImpl: first.fetchImpl })(
      "https://api.groq.com/v1/chat",
    );

    // Second request should skip key one entirely rather than rediscovering
    // that it is spent.
    const second = recordingFetch([() => new Response("ok")]);
    await createRotatingFetch({
      keys: KEYS,
      store,
      fetchImpl: second.fetchImpl,
    })("https://api.groq.com/v1/chat");

    expect(second.used).toEqual(["gsk_two"]);
  });

  it("does NOT park a key for a per-minute limit", async () => {
    const store = createMemoryStore();
    const { fetchImpl, used } = recordingFetch([minuteLimit]);
    const doFetch = createRotatingFetch({ keys: KEYS, store, fetchImpl });

    const response = await doFetch("https://api.groq.com/v1/chat");

    // Returned as-is for the SDK to handle; crucially only one key was
    // touched. Parking here would drain the whole pool in a minute.
    expect(response.status).toBe(429);
    expect(used).toEqual(["gsk_one"]);
    expect(await store.getExhausted(KEYS.map(fingerprintKey))).toEqual(
      new Set(),
    );
  });

  it("parks a rejected key and continues", async () => {
    const { fetchImpl, used } = recordingFetch([
      () => new Response("invalid api key", { status: 401 }),
      () => new Response("ok"),
    ]);
    const doFetch = createRotatingFetch({
      keys: KEYS,
      store: createMemoryStore(),
      fetchImpl,
    });

    await doFetch("https://api.groq.com/v1/chat");
    expect(used).toEqual(["gsk_one", "gsk_two"]);
  });

  it("throws AllKeysExhausted once every key is spent", async () => {
    const { fetchImpl, used } = recordingFetch([dailyLimit]);
    const doFetch = createRotatingFetch({
      keys: KEYS,
      store: createMemoryStore(),
      fetchImpl,
    });

    await expect(doFetch("https://api.groq.com/v1/chat")).rejects.toThrow(
      AllKeysExhaustedError,
    );
    // Tried each key exactly once --- no infinite loop.
    expect(used).toEqual(["gsk_one", "gsk_two", "gsk_three"]);
  });

  it("surfaces a retry-after on exhaustion", async () => {
    const { fetchImpl } = recordingFetch([dailyLimit]);
    const doFetch = createRotatingFetch({
      keys: ["only-key"],
      store: createMemoryStore(),
      fetchImpl,
    });

    await doFetch("https://x").catch((error: unknown) => {
      expect(error).toBeInstanceOf(AllKeysExhaustedError);
      expect((error as AllKeysExhaustedError).retryAfterSeconds).toBeGreaterThan(
        0,
      );
    });
  });

  it("passes a 400 straight back without burning keys", async () => {
    const { fetchImpl, used } = recordingFetch([
      () => new Response("bad request", { status: 400 }),
    ]);
    const doFetch = createRotatingFetch({
      keys: KEYS,
      store: createMemoryStore(),
      fetchImpl,
    });

    const response = await doFetch("https://x");
    expect(response.status).toBe(400);
    expect(used).toEqual(["gsk_one"]);
  });

  it("leaves the response body readable after classifying it", async () => {
    const { fetchImpl } = recordingFetch([minuteLimit]);
    const doFetch = createRotatingFetch({
      keys: KEYS,
      store: createMemoryStore(),
      fetchImpl,
    });

    const response = await doFetch("https://x");
    // The SDK still has to read this; classification clones rather than consumes.
    await expect(response.text()).resolves.toContain("per minute");
  });

  it("throws rather than hanging when no keys are configured", async () => {
    const doFetch = createRotatingFetch({
      keys: [],
      store: createMemoryStore(),
      fetchImpl: (async () => new Response("ok")) as unknown as typeof fetch,
    });

    await expect(doFetch("https://x")).rejects.toThrow(AllKeysExhaustedError);
  });
});

describe("memory store", () => {
  it("expires a parked key once its TTL passes", async () => {
    let now = 1_000_000;
    const store = createMemoryStore(() => now);
    const fp = fingerprintKey("gsk_one");

    await store.markExhausted(fp, "daily_limit", 60);
    expect(await store.getExhausted([fp])).toEqual(new Set([fp]));

    now += 61_000;
    expect(await store.getExhausted([fp])).toEqual(new Set());
  });
});

describe("redis store", () => {
  it("fails open when Redis is unreachable", async () => {
    const broken = {
      mget: async () => {
        throw new Error("ECONNREFUSED");
      },
      set: async () => {
        throw new Error("ECONNREFUSED");
      },
      ttl: async () => {
        throw new Error("ECONNREFUSED");
      },
    };

    const errors: unknown[] = [];
    const store = createRedisStore(broken, (error) => errors.push(error));

    // "Nothing is parked" is the safe answer: a cache outage must not mean
    // no AI at all.
    expect(await store.getExhausted(["abc"])).toEqual(new Set());
    await expect(
      store.markExhausted("abc", "daily_limit", 60),
    ).resolves.toBeUndefined();
    expect(errors).toHaveLength(2);
  });

  it("reads parked keys from Redis", async () => {
    const data = new Map<string, string>();
    const client = {
      mget: async (...keys: string[]) => keys.map((k) => data.get(k) ?? null),
      set: async (key: string, value: string) => {
        data.set(key, value);
        return "OK";
      },
      ttl: async () => 1200,
    };

    const store = createRedisStore(client);
    await store.markExhausted("abc", "daily_limit", 3600);

    expect(await store.getExhausted(["abc", "def"])).toEqual(new Set(["abc"]));
    expect(await store.soonestResetSeconds(["abc"])).toBe(1200);
  });

  it("never writes the raw key to Redis", async () => {
    const written: string[] = [];
    const client = {
      mget: async () => [null],
      set: async (key: string, value: string) => {
        written.push(key, value);
        return "OK";
      },
      ttl: async () => 60,
    };

    const store = createRedisStore(client);
    await store.markExhausted(fingerprintKey("gsk_supersecret"), "daily_limit", 60);

    expect(written.join(" ")).not.toContain("supersecret");
  });
});
