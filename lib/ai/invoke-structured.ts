import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessageLike } from "@langchain/core/messages";
import type { z } from "zod";

/**
 * Structured output fails transiently more often than it should, in ways
 * that are not the caller's fault and that succeed on a second attempt:
 *
 *   tool_use_failed  Groq rejects the model's own reply --- "Tool choice is
 *                    none, but model called a tool". Seen with `gpt-oss`,
 *                    which leaks its reasoning channel as a tool named
 *                    `commentary`. The `failed_generation` in the error
 *                    body is usually *correct*; only the envelope is wrong.
 *   Failed to parse  the reply did not match the schema.
 *
 * Both arrive as a 400, so neither the SDK's retry policy (4xx is terminal)
 * nor key rotation (nothing is exhausted) does anything with them. Left
 * alone they surfaced as roughly one failed answer in eight.
 */
export function isTransientStructuredOutputFailure(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    /tool_use_failed/i.test(message) ||
    /tool choice is none, but model called a tool/i.test(message) ||
    /failed to parse/i.test(message)
  );
}

/**
 * Pulls the model's actual output out of a `tool_use_failed` error.
 *
 * Groq rejects the *envelope* while handing back the contents verbatim in
 * `failed_generation`. Observed wrapper names so far: `commentary` and
 * `tool_json`, both carrying correct arguments. Retrying does not help ---
 * the same prompt reproduces the same wrapper --- but the data needed to
 * answer is already in the error, and it is still validated against the
 * schema before use.
 */
function recoverFailedGeneration<T extends z.ZodType>(
  error: unknown,
  schema: T,
): z.infer<T> | null {
  const message = error instanceof Error ? error.message : "";
  const start = message.indexOf("{");
  if (start === -1) return null;

  try {
    const body: unknown = JSON.parse(message.slice(start));
    const raw = (body as { error?: { failed_generation?: unknown } })?.error
      ?.failed_generation;

    if (typeof raw !== "string") return null;

    const generated: unknown = JSON.parse(raw);

    // Either a `{ name, arguments }` envelope or the bare object.
    const candidate =
      generated !== null &&
      typeof generated === "object" &&
      "arguments" in generated
        ? (generated as { arguments: unknown }).arguments
        : generated;

    const parsed = schema.safeParse(candidate);
    return parsed.success ? (parsed.data as z.infer<T>) : null;
  } catch {
    return null;
  }
}

/**
 * `withStructuredOutput(...).invoke(...)`, hardened against the failures
 * above. Anything else is rethrown untouched --- a 401, a 429 or a genuine
 * schema mismatch should not be retried here.
 */
export async function invokeStructured<T extends z.ZodType>(
  model: BaseChatModel,
  schema: T,
  messages: BaseMessageLike[],
  { name, attempts = 3 }: { name: string; attempts?: number },
): Promise<z.infer<T>> {
  const bound = model.withStructuredOutput(schema, { name });

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return (await bound.invoke(messages)) as z.infer<T>;
    } catch (error) {
      if (!isTransientStructuredOutputFailure(error)) throw error;

      // Prefer the model's own output over another round trip.
      const recovered = recoverFailedGeneration(error, schema);
      if (recovered !== null) return recovered;

      lastError = error;

      // A short, growing pause: these clear on their own, and hammering the
      // same model in the same millisecond tends to reproduce them.
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
