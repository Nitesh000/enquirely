import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import {
  blockSchema,
  formDefinitionSchema,
  type FormBlock,
  type FormDefinition,
} from "@/lib/forms/schema";
import { validateDefinition } from "@/lib/forms/validate-definition";

/**
 * Form generation graph (`plan.md` §9.1, `steps.md` M6.3).
 *
 *   START -> understandIntent -> generateBlocks -> validate
 *                                    ^               |
 *                                    |         (invalid, <2 retries)
 *                                    +---------------+
 *                                                    |
 *                                              (valid) -> improveWording -> END
 *
 * The retry loop is the entire reason this is a graph rather than one
 * prompt: `validate` runs the product's real `validateDefinition`, and a
 * failure feeds the actual issues back into regeneration. A single prompt
 * can only hope the model got it right; a graph can check and insist.
 *
 * Models are injected rather than imported so the graph stays pure and
 * testable — `lib/` never reaches for an API key of its own.
 */

/** Hard cap from `steps.md` M6.7: never hand back a 60-question monster. */
export const MAX_BLOCKS = 20;
const MAX_VALIDATION_RETRIES = 2;

const intentSchema = z.object({
  goal: z.string().describe("What the creator is actually trying to learn"),
  audience: z.string().describe("Who will be answering this"),
  tone: z.enum(["neutral", "friendly", "formal"]),
  targetBlockCount: z.number().int().min(1).max(MAX_BLOCKS),
});

type Intent = z.infer<typeof intentSchema>;

/**
 * The model is asked for blocks, not for a whole `FormDefinition`.
 *
 * Not a style preference — measured: `blockSchema` converts to JSON Schema
 * with no `$ref`, while `formDefinitionSchema` emits `$ref`s because the
 * logic condition tree is recursive, and self-referential `$ref` is the
 * part of JSON Schema that provider tool validators are least likely to
 * accept. Title, theme and logic are assembled here instead.
 */
const blocksSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  blocks: z.array(blockSchema).min(1).max(MAX_BLOCKS),
});

const wordingSchema = z.object({
  blocks: z
    .array(z.object({ id: z.string(), title: z.string().min(1) }))
    .max(MAX_BLOCKS),
});

const GraphState = Annotation.Root({
  /** The creator's one-line brief. */
  brief: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  intent: Annotation<Intent | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  draft: Annotation<FormDefinition | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  /** Issues from the last validate pass, fed back into regeneration. */
  issues: Annotation<string[]>({ reducer: (_, b) => b, default: () => [] }),
  attempts: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  error: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
});

export type FormGenerationState = typeof GraphState.State;

export type GenerateFormDeps = {
  /** Cheap tier: intent extraction and wording polish. */
  fast: BaseChatModel;
  /** Careful tier: writing the actual questions. */
  smart: BaseChatModel;
};

function assembleDefinition(
  parts: z.infer<typeof blocksSchema>,
): FormDefinition {
  // Parsing here (rather than trusting the model's object) applies every
  // default in the schema — theme, `required`, per-type config — so the
  // rest of the graph works with a real `FormDefinition`.
  return formDefinitionSchema.parse({
    version: 1,
    title: parts.title,
    description: parts.description,
    blocks: parts.blocks,
    logic: [],
  });
}

export function createFormGenerationGraph(deps: GenerateFormDeps) {
  const graph = new StateGraph(GraphState)
    .addNode("understandIntent", async (state) => {
      const model = deps.fast.withStructuredOutput(intentSchema, {
        name: "intent",
      });

      const intent = (await model.invoke([
        {
          role: "system",
          content:
            "You plan surveys. Read the brief and state the goal, the audience, " +
            "the tone, and how many questions it should have. Short surveys get " +
            "finished; prefer fewer questions unless the brief demands more.",
        },
        { role: "user", content: state.brief },
      ])) as Intent;

      return { intent };
    })

    .addNode("generateBlocks", async (state) => {
      const model = deps.smart.withStructuredOutput(blocksSchema, {
        name: "form",
      });

      // On a retry, the previous attempt's real validation errors go back to
      // the model. This is the payload that makes the loop worth having.
      const retryNote =
        state.issues.length > 0
          ? `\n\nYour previous attempt was rejected for these reasons. Fix all of them:\n${state.issues
              .map((issue) => `- ${issue}`)
              .join("\n")}`
          : "";

      const result = (await model.invoke([
        {
          role: "system",
          content: [
            "You write survey questions.",
            "Rules:",
            `- Give every block a unique id: q1, q2, q3 ...`,
            `- At most ${MAX_BLOCKS} blocks.`,
            "- Allowed types: short_text, long_text, email, number, single_choice, multi_choice, rating, yes_no.",
            "- single_choice and multi_choice need at least 2 options, each with a unique id and a label.",
            "- Put type-specific settings under the key matching the type (rating goes in `rating`, etc).",
            "- Ask one thing per question. No double-barrelled questions.",
          ].join("\n"),
        },
        {
          role: "user",
          content:
            `Brief: ${state.brief}\n` +
            `Goal: ${state.intent?.goal ?? "unknown"}\n` +
            `Audience: ${state.intent?.audience ?? "general"}\n` +
            `Tone: ${state.intent?.tone ?? "neutral"}\n` +
            `Aim for about ${state.intent?.targetBlockCount ?? 6} questions.` +
            retryNote,
        },
      ])) as z.infer<typeof blocksSchema>;

      try {
        return {
          draft: assembleDefinition(result),
          attempts: state.attempts + 1,
        };
      } catch (error) {
        // A schema failure here is itself a validation issue — round it back
        // through the same loop instead of throwing out of the graph.
        return {
          draft: null,
          attempts: state.attempts + 1,
          issues: [
            error instanceof Error
              ? error.message
              : "Malformed form definition",
          ],
        };
      }
    })

    .addNode("validate", async (state) => {
      if (!state.draft) {
        return {
          issues: state.issues.length ? state.issues : ["No form produced"],
        };
      }

      // The product's own structural checks — not a second, AI-specific set.
      const issues = validateDefinition(state.draft).map(
        (issue) => issue.message,
      );

      return { issues };
    })

    .addNode("improveWording", async (state) => {
      if (!state.draft) return {};

      const model = deps.fast.withStructuredOutput(wordingSchema, {
        name: "wording",
      });

      const result = (await model.invoke([
        {
          role: "system",
          content:
            "Rewrite each question to be shorter and more natural. Keep the " +
            "meaning and the ids identical. Do not add or remove questions.",
        },
        {
          role: "user",
          content: JSON.stringify(
            state.draft.blocks.map((b) => ({ id: b.id, title: b.title })),
          ),
        },
      ])) as z.infer<typeof wordingSchema>;

      const rewrites = new Map(result.blocks.map((b) => [b.id, b.title]));
      const blocks = state.draft.blocks.map((block): FormBlock => {
        const title = rewrites.get(block.id);
        return title ? { ...block, title } : block;
      });

      return { draft: { ...state.draft, blocks } };
    })

    .addEdge(START, "understandIntent")
    .addEdge("understandIntent", "generateBlocks")
    .addEdge("generateBlocks", "validate")
    .addConditionalEdges(
      "validate",
      (state) => {
        if (state.issues.length === 0) return "ok";
        // Time-boxed: two retries, then hand back a clean error rather than
        // looping on the model's expense (`steps.md` M6.7).
        return state.attempts >= MAX_VALIDATION_RETRIES ? "giveUp" : "retry";
      },
      { ok: "improveWording", retry: "generateBlocks", giveUp: END },
    )
    .addEdge("improveWording", END);

  return graph.compile();
}

export type FormGenerationResult =
  { ok: true; definition: FormDefinition } | { ok: false; issues: string[] };

/** Thin wrapper so callers get a result union instead of raw graph state. */
export async function generateForm(
  deps: GenerateFormDeps,
  brief: string,
): Promise<FormGenerationResult> {
  const graph = createFormGenerationGraph(deps);
  const final = await graph.invoke({ brief });

  if (!final.draft || final.issues.length > 0) {
    return {
      ok: false,
      issues: final.issues.length > 0 ? final.issues : ["Generation failed"],
    };
  }

  return { ok: true, definition: final.draft };
}
