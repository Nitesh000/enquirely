import { z } from "zod";

/**
 * Models emit `null` for optional fields they have nothing to say about.
 * Zod's `.optional()` accepts `undefined`, not `null`, so a reply that is
 * otherwise perfect fails to parse:
 *
 *     {"tool":"filter_responses","blockId":null,"searchQuery":null,...}
 *     -> Invalid input: expected string, received null
 *
 * Observed against Groq on both the form-generation and response-chat
 * graphs, so it is a property of talking to models rather than a quirk of
 * one schema.
 *
 * Stripping nulls before validation is preferred over loosening the schemas
 * themselves: `blockSchema` and friends are the product's real types and
 * should keep saying that a description is a string or absent, never null.
 *
 * The JSON Schema the provider receives is unchanged --- `z.preprocess`
 * passes conversion straight through to the inner schema, verified to still
 * emit `properties`/`required` with no `$ref`.
 */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== null)
        .map(([key, item]) => [key, stripNulls(item)]),
    );
  }

  return value;
}

/** Wrap any schema handed to `withStructuredOutput`. */
export function modelOutput<T extends z.ZodType>(schema: T) {
  return z.preprocess(stripNulls, schema);
}
