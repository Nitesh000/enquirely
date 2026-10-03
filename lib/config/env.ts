import "server-only";

import { z } from "zod";

/**
 * Server environment, parsed once at module load.
 *
 * Import `env` instead of touching `process.env` anywhere else --- that way a
 * missing variable is a startup error with a readable message, not an
 * `undefined` that surfaces three layers deep in a request handler.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "BETTER_AUTH_SECRET must be at least 32 chars (openssl rand -base64 32)",
    ),
  BETTER_AUTH_URL: z.url(),

  // Optional: both present enables the GitHub button, both absent hides it.
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  /**
   * Comma-separated Groq keys, used in order: key 1 is drained before key 2
   * is touched. Split and cleaned here so no caller ever sees the raw
   * string, and so an entry of `"a,,b, "` cannot smuggle an empty key into
   * the rotation.
   *
   * Optional so the app still boots without AI configured --- every AI
   * surface checks `aiEnabled` and degrades to a clear "not configured"
   * error rather than crashing the whole server at import time.
   */
  GROQ_API_KEYS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((key) => key.trim())
        .filter((key) => key.length > 0),
    ),

  // Override if Groq retires a model. Verify against the current list at
  // https://console.groq.com/docs/models --- the defaults are a point in time.
  GROQ_MODEL_FAST: z.string().default("openai/gpt-oss-20b"),
  GROQ_MODEL_SMART: z.string().default("openai/gpt-oss-120b"),

  /**
   * Where key exhaustion is recorded. Optional: without it rotation falls
   * back to a per-instance in-memory store, which is correct locally and
   * wrong across more than one instance.
   */
  REDIS_URL: z.string().optional(),
});

function parseServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCopy .env.example to .env.local and fill it in.`,
    );
  }

  return parsed.data;
}

export const env = parseServerEnv();

/** Both halves of the GitHub OAuth pair are present. */
export const githubOAuthEnabled = Boolean(
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET,
);

/** AI features have at least one provider key configured. */
export const aiEnabled = env.GROQ_API_KEYS.length > 0;

/** Key exhaustion is shared across instances rather than per-process. */
export const redisEnabled = Boolean(env.REDIS_URL);
