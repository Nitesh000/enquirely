import { z } from "zod";

import { FormBlock } from "./schema";

export const answerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export type AnswerValue = z.infer<typeof answerValueSchema>;

/**
 * Message used whenever a required block has no usable answer --- missing
 * entirely, empty string, or nothing selected. Zod v4 takes this as the
 * first argument to a type constructor and uses it for the
 * "wrong type / undefined" case, so one string covers both shapes of blank.
 */
const REQUIRED = "This question is required";

/**
 * The Zod schema that validates an answer to *this specific block*.
 *
 * Runs client-side for instant feedback and server-side as the authority
 * (`steps.md` M1.2) --- so "required" has to mean the same thing in both
 * places. Note that a required text block rejects `""`, not just `undefined`:
 * a blank box is an unanswered question, and `z.string()` alone would let it
 * through.
 */
export function answerSchemaForBlock(block: FormBlock) {
  switch (block.type) {
    case "email": {
      const schema = block.required ? z.email(REQUIRED).min(1, REQUIRED) : z.email();
      return block.required ? schema : schema.optional();
    }

    case "short_text": {
      let schema = block.required
        ? z.string(REQUIRED).min(1, REQUIRED)
        : z.string();
      if (block.shortText.maxLength != undefined) {
        schema = schema.max(block.shortText.maxLength);
      }

      return block.required ? schema : schema.optional();
    }

    case "long_text": {
      let schema = block.required
        ? z.string(REQUIRED).min(1, REQUIRED)
        : z.string();
      if (block.longText.maxLength != undefined) {
        schema = schema.max(block.longText.maxLength);
      }

      return block.required ? schema : schema.optional();
    }

    case "number": {
      let schema = block.required ? z.number(REQUIRED) : z.number();
      if (block.number.min != undefined) {
        schema = schema.min(block.number.min);
      }
      if (block.number.max != undefined) {
        schema = schema.max(block.number.max);
      }

      return block.required ? schema : schema.optional();
    }

    case "single_choice": {
      const validIds = block.singleChoice.options.map((o) => o.id);
      const base = block.required
        ? z.string(REQUIRED).min(1, REQUIRED)
        : z.string();
      const schema = base.refine((v) => validIds.includes(v), {
        message: "Invalid Option",
      });

      return block.required ? schema : schema.optional();
    }

    case "multi_choice": {
      const validIds = block.multiChoice.options.map((o) => o.id);
      let schema = z
        .array(z.string(), block.required ? REQUIRED : undefined)
        .refine((v) => v.every((i) => validIds.includes(i)), {
          message: "Invalid options",
        });

      // A required multi-choice needs at least one selection, unless the
      // creator asked for more than that explicitly.
      if (block.required && block.multiChoice.minSelected == undefined) {
        schema = schema.min(1, REQUIRED);
      }

      if (block.multiChoice.minSelected != undefined) {
        schema = schema.min(
          block.multiChoice.minSelected,
          `Choose at least ${block.multiChoice.minSelected}`,
        );
      }

      if (block.multiChoice.maxSelected != undefined) {
        schema = schema.max(
          block.multiChoice.maxSelected,
          `Choose no more than ${block.multiChoice.maxSelected}`,
        );
      }

      return block.required ? schema : schema.optional();
    }

    case "rating": {
      let schema = (block.required ? z.number(REQUIRED) : z.number()).min(1);
      if (block.rating.max != undefined) {
        schema = schema.max(block.rating.max);
      }

      return block.required ? schema : schema.optional();
    }

    case "yes_no": {
      const schema = block.required ? z.boolean(REQUIRED) : z.boolean();
      return block.required ? schema : schema.optional();
    }
  }
}
