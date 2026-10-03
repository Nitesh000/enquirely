import { z } from "zod";

import type { FormOperation } from "@/lib/forms/operations";
import { blockSchema, formDefinitionSchema } from "@/lib/forms/schema";

/**
 * Structured-output contracts for the model.
 *
 * These are the *real* schemas, not AI-shaped copies of them
 * (`steps.md` M6.2). The model is asked to produce a genuine
 * `FormDefinition` — ids and all — and anything malformed is caught by
 * `validateDefinition` and sent back round the graph's retry loop. A
 * parallel "AI form type" would drift from the product's actual schema the
 * first time a block gains a field.
 */
export const generatedFormSchema = formDefinitionSchema;

export type GeneratedForm = z.infer<typeof generatedFormSchema>;

/**
 * Zod mirror of the `FormOperation` union, for parsing AI-proposed edits.
 *
 * The builder's own mutations never need parsing — they are constructed in
 * TypeScript and already typed. Model output is a boundary, so it does
 * (`AGENTS.md`: parse every boundary with Zod, LLM output included).
 *
 * `changes` is deliberately loose here: a partial of a discriminated union
 * is not expressible in Zod without enumerating every variant's partial
 * form. `applyOperations` merges it onto a real block and the result is
 * re-validated with `blockSchema`, so a bad patch fails there rather than
 * silently producing an invalid block.
 */
export const aiFormOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_block"),
    block: blockSchema,
    index: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("update_block"),
    id: z.string(),
    changes: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal("delete_block"), id: z.string() }),
  z.object({
    type: z.literal("move_block"),
    id: z.string(),
    toIndex: z.number().int().min(0),
  }),
  z.object({ type: z.literal("delete_logic"), ruleId: z.string() }),
]);

export const aiFormOperationsSchema = z.array(aiFormOperationSchema).max(50);

/**
 * Compile-time guard that the parsed shape really is assignable to the
 * builder's own `FormOperation`. If someone adds a variant to one and not
 * the other, this stops compiling — which is the whole point of having a
 * single operation vocabulary (`steps.md` §1).
 */
type ParsedOperation = z.infer<typeof aiFormOperationSchema>;
type _AssertAssignable = ParsedOperation extends Pick<
  FormOperation,
  never
> & { type: FormOperation["type"] }
  ? true
  : never;
const _assert: _AssertAssignable = true;
void _assert;
