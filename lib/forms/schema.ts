import { z } from "zod";

/**
 * The canonical form definition. Builder, preview, and the respondent
 * runtime (`app/f/[slug]`) all consume this same shape --- see
 * `.agents/plan.md` §4. Types are inferred from these schemas, never
 * hand-written separately.
 */

const baseBlockFields = {
  id: z.string(),
  title: z.string().min(1).describe("The question we wish to ask the user."),
  description: z
    .string()
    .optional()
    .describe("More detailed description for the question"),
  required: z
    .boolean()
    .default(false)
    .describe("Is answering this question required?"),
  validation: z.object({ message: z.string() }).optional(),
};

const shortTextBlock = z.object({
  ...baseBlockFields,
  type: z.literal("short_text"),
  shortText: z
    .object({ maxLength: z.number().int().positive().optional() })
    .strict()
    .default({}),
});

const longTextBlock = z.object({
  ...baseBlockFields,
  type: z.literal("long_text"),
  longText: z
    .object({ maxLength: z.number().int().positive().optional() })
    .strict()
    .default({}),
});

const emailBlock = z.object({
  ...baseBlockFields,
  type: z.literal("email"),
});

const numberBlock = z.object({
  ...baseBlockFields,
  type: z.literal("number"),
  number: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .strict()
    .default({}),
});

const choiceOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
});

const singleChoiceBlock = z.object({
  ...baseBlockFields,
  type: z.literal("single_choice"),
  singleChoice: z
    .object({
      options: z.array(choiceOptionSchema).min(2),
    })
    .strict(),
});

const multiChoiceBlock = z.object({
  ...baseBlockFields,
  type: z.literal("multi_choice"),
  multiChoice: z
    .object({
      options: z.array(choiceOptionSchema).min(2),
      minSelected: z.number().int().positive().optional(),
      maxSelected: z.number().int().positive().optional(),
    })
    .strict(),
});

const ratingBlock = z.object({
  ...baseBlockFields,
  type: z.literal("rating"),
  rating: z
    .object({
      max: z.number().int().min(2).max(10).default(5),
      style: z.enum(["star", "number"]).default("star"),
    })
    .strict()
    .default({ max: 5, style: "star" }),
});

const yesNoBlock = z.object({
  ...baseBlockFields,
  type: z.literal("yes_no"),
});

export const blockSchema = z.discriminatedUnion("type", [
  shortTextBlock,
  longTextBlock,
  emailBlock,
  numberBlock,
  singleChoiceBlock,
  multiChoiceBlock,
  ratingBlock,
  yesNoBlock,
]);

export type FormBlock = z.infer<typeof blockSchema>;
export type BlockType = FormBlock["type"];

const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
  "is_answered",
  "is_not_answered",
]);

const conditionSchema = z.object({
  blockId: z.string(),
  operator: conditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

/**
 * Compound grouping (`all` / `any`) is built in from M1 rather than
 * retrofitted in M4 --- flat condition arrays are painful to migrate to
 * nested groups later (`steps.md` §M4.1). `z.ZodType` annotates the
 * return type explicitly because Zod cannot infer a self-referential
 * schema from `z.lazy()` alone.
 */
export type ConditionGroup =
  | z.infer<typeof conditionSchema>
  | { all: ConditionGroup[] }
  | { any: ConditionGroup[] };

const conditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.union([
    conditionSchema,
    z.object({ all: z.array(conditionGroupSchema) }),
    z.object({ any: z.array(conditionGroupSchema) }),
  ]),
);

const logicActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("show"), target: z.string() }),
  z.object({ type: z.literal("hide"), target: z.string() }),
  z.object({ type: z.literal("jump"), target: z.string() }),
  z.object({ type: z.literal("end_survey") }),
  z.object({
    type: z.literal("set_variable"),
    variable: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.object({
    type: z.literal("change_completion_screen"),
    screenId: z.string(),
  }),
]);

export const logicRuleSchema = z.object({
  id: z.string(),
  condition: conditionGroupSchema,
  action: logicActionSchema,
});

export type LogicRule = z.infer<typeof logicRuleSchema>;

export const themeSchema = z.object({
  preset: z.enum(["minimal", "soft", "bold", "glass"]).default("minimal"),
  accentColor: z.string().default("#6366f1"),
  font: z.string().default("Inter"),
  buttonStyle: z.enum(["rounded", "pill", "square"]).default("rounded"),
  animation: z.enum(["subtle", "smooth", "playful"]).default("subtle"),
});

const defaultTheme = {
  preset: "minimal",
  accentColor: "#6366f1",
  font: "Inter",
  buttonStyle: "rounded",
  animation: "subtle",
} as const;

export type FormTheme = z.infer<typeof themeSchema>;

export const formDefinitionSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1),
  description: z.string().optional(),
  blocks: z.array(blockSchema),
  logic: z.array(logicRuleSchema).default([]),
  theme: themeSchema.default(defaultTheme),
});

export type FormDefinition = z.infer<typeof formDefinitionSchema>;
