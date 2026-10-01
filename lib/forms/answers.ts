import { z } from "zod";
import { FormBlock } from "./schema";

export const answerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export type AnswerValue = z.infer<typeof answerValueSchema>;

export function answerSchemaForBlock(block: FormBlock) {
  switch (block.type) {
    case "email": {
      const schema = z.email();
      return block.required ? schema : schema.optional();
    }

    case "short_text": {
      let schema = z.string();
      if (block.shortText.maxLength != undefined) {
        schema = schema.max(block.shortText.maxLength);
      }

      return block.required ? schema : schema.optional();
    }

    case "long_text": {
      let schema = z.string();
      if (block.longText.maxLength != undefined) {
        schema = schema.max(block.longText.maxLength);
      }

      return block.required ? schema : schema.optional();
    }

    case "number": {
      let schema = z.number();
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
      const schema = z
        .string()
        .refine((v) => validIds.includes(v), { message: "Invalid Option" });

      return block.required ? schema : schema.optional();
    }

    case "multi_choice": {
      const validIds = block.multiChoice.options.map((o) => o.id);
      let schema = z
        .array(z.string())
        .refine((v) => v.every((i) => validIds.includes(i)), {
          message: "Invalid options",
        });

      if (block.multiChoice.minSelected != undefined) {
        schema = schema.min(block.multiChoice.minSelected);
      }

      if (block.multiChoice.maxSelected != undefined) {
        schema = schema.max(block.multiChoice.maxSelected);
      }

      return block.required ? schema : schema.optional();
    }

    case "rating": {
      let schema = z.number().min(1);
      if (block.rating.max != undefined) {
        schema = schema.max(block.rating.max);
      }

      return block.required ? schema : schema.optional();
    }

    case "yes_no": {
      const schema = z.boolean();
      return block.required ? schema : schema.optional();
    }
  }
}
