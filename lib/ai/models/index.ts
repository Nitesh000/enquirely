import "server-only";

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGroq } from "@langchain/groq";

import { AllKeysExhaustedError, fingerprintKey } from "@/lib/ai/keys/rotation";
import { createRotatingFetch } from "@/lib/ai/keys/rotating-fetch";
import {
  createMemoryStore,
  createRedisStore,
  type KeyLimitStore,
} from "@/lib/ai/keys/store";
import { redis } from "@/lib/cache/redis";
import { env } from "@/lib/config/env";

/**
 * Models are requested by **capability tier**, never by vendor name
 * (`plan.md` §25, `steps.md` M6.1).
 *
 * Every graph asks for `fast` or `smart` and gets whatever currently fills
 * that role. Swapping providers — or moving a tier to a cheaper model — is
 * a change to this file and nothing else.
 */
export type ModelTier =
  /** Cheap and quick: classification, routing, short rewrites. */
  | "fast"
  /** Careful reasoning: generating a whole form, synthesising analysis. */
  | "smart";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Set GROQ_API_KEYS in .env.local to enable it.");
    this.name = "AiNotConfiguredError";
  }
}

export { AllKeysExhaustedError };

/**
 * Redis when it is configured, a process-local map otherwise.
 *
 * The fallback keeps local development working with nothing extra running;
 * it is wrong across more than one instance, which is the whole reason
 * `REDIS_URL` exists in production.
 */
const store: KeyLimitStore = redis
  ? createRedisStore(redis, (error) =>
      console.warn("[groq-rotation] redis unavailable:", error),
    )
  : createMemoryStore();

export function getKeyLimitStore() {
  return store;
}

/** For a health check or a "2 of 4 keys left" badge later. */
export async function getKeyPoolStatus() {
  const fingerprints = env.GROQ_API_KEYS.map(fingerprintKey);
  const exhausted = await store.getExhausted(fingerprints);

  return {
    total: fingerprints.length,
    available: fingerprints.length - exhausted.size,
    exhausted: exhausted.size,
  };
}

export function getModel(
  tier: ModelTier,
  options: { temperature?: number } = {},
): BaseChatModel {
  if (env.GROQ_API_KEYS.length === 0) {
    throw new AiNotConfiguredError();
  }

  return new ChatGroq({
    // The real key is attached per request by the rotating fetch below;
    // this only exists to satisfy the SDK's constructor check.
    apiKey: env.GROQ_API_KEYS[0],
    model: tier === "fast" ? env.GROQ_MODEL_FAST : env.GROQ_MODEL_SMART,
    // Deterministic by default: a form generator that returns something
    // different each run is impossible to evaluate or debug.
    temperature: options.temperature ?? 0,
    maxTokens: 8192,
    // Rotation already retries across keys. The SDK retrying on top of that
    // multiplies spend against the very limits we are trying to respect.
    maxRetries: 1,
    fetch: createRotatingFetch({
      keys: env.GROQ_API_KEYS,
      store,
      onPark: ({ fingerprint, reason, remaining, total }) =>
        console.warn(
          `[groq-rotation] key ${fingerprint} parked (${reason}), ` +
            `${remaining} of ${total} still available`,
        ),
    }),
  });
}
