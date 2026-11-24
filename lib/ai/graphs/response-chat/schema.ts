import { z } from "zod";

import { modelOutput } from "@/lib/ai/schemas/model-output";
import {
  comparisonGroupSchema,
  responseFilterSchema,
} from "@/lib/ai/tools/responses";

export const CHAT_TOOLS = [
  "get_form_schema",
  "filter_responses",
  "aggregate_responses",
  "get_question_results",
  "search_responses",
  "compare_groups",
] as const;

/**
 * The classifier picks one tool and supplies its arguments in a single
 * structured call, rather than the provider's tool-calling loop. It keeps
 * the step deterministic and inspectable --- the route can stream "Reading
 * 127 responses" because it knows which tool was chosen before it runs.
 */
const chatIntentShape = z.object({
  tool: z.enum(CHAT_TOOLS),
  blockId: z
    .string()
    .optional()
    .describe("Required for get_question_results. A question id, not its title."),
  searchQuery: z
    .string()
    .optional()
    .describe("Required for search_responses. The words to look for in answers."),
  filter: responseFilterSchema
    .optional()
    .describe("Narrows which responses are considered. Omit to use all of them."),
  groups: z
    .array(comparisonGroupSchema)
    .min(2)
    .max(4)
    .optional()
    .describe(
      "Required for compare_groups. One entry per side of the comparison.",
    ),
});

export const chatIntentSchema = modelOutput(chatIntentShape);

export type ChatIntent = z.infer<typeof chatIntentShape>;

const chatAnswerShape = z.object({
  answer: z
    .string()
    .min(1)
    .describe("The answer, in plain prose. State numbers you were given, never estimates."),
  citations: z
    .array(z.string())
    .default([])
    .describe("Response ids this answer drew on. Only ids present in the evidence."),
});

export const chatAnswerSchema = modelOutput(chatAnswerShape);

export type ChatAnswer = z.infer<typeof chatAnswerShape>;
