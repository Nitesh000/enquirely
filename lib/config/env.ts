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
    .min(32, "BETTER_AUTH_SECRET must be at least 32 chars (openssl rand -base64 32)"),
  BETTER_AUTH_URL: z.url(),

  // Optional: both present enables the GitHub button, both absent hides it.
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
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
