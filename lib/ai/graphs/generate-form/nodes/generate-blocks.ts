import z from "zod";
import {
  assembleDefinition,
  FormGenerationState,
  GenerateFormDeps,
} from "../generate-form";
import { blocksSchema, MAX_BLOCKS } from "../schema";

export const generateBlocks = async (
  state: FormGenerationState,
  deps: GenerateFormDeps,
): Promise<Partial<FormGenerationState>> => {
  const model = deps.smart.withStructuredOutput(blocksSchema, {
    name: "form",
  });

  const retryNote =
    state.issues.length > 0
      ? `\n\nYour previous attempt was rejected for these reasons. Fix all of them:\n${state.issues.map((i) => `- ${i}`).join("\n")}`
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
      role: "human",
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
    return { draft: assembleDefinition(result), attempts: state.attempts + 1 };
  } catch (err) {
    return {
      draft: null,
      attempts: state.attempts + 1,
      issues: [
        err instanceof Error ? err.message : "Malformed form definition",
      ],
    };
  }
};
