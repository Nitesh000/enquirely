import { FormGenerationState, GenerateFormDeps } from "../generate-form";
import { wordingShema } from "../schema";
import z from "zod";
import { FormBlock } from "@/lib/forms/schema";

export const improveWording = async (
  state: FormGenerationState,
  deps: GenerateFormDeps,
): Promise<Partial<FormGenerationState>> => {
  if (!state.draft) return {};
  const model = deps.fast.withStructuredOutput(wordingShema, {
    name: "wording",
  });

  const result = (await model.invoke([
    {
      role: "system",
      content:
        "Rewrite each question to be shorter and more natural. Keep the meaning and the ids identical. Do not add or remove questions.",
    },
    {
      role: "human",
      content: JSON.stringify(
        state.draft.blocks.map((b) => ({ id: b.id, title: b.title })),
      ),
    },
  ])) as z.infer<typeof wordingShema>;

  const rewrites = new Map(result.blocks.map((b) => [b.id, b.title]));
  const blocks = state.draft.blocks.map((bl): FormBlock => {
    const title = rewrites.get(bl.id);
    return title ? { ...bl, title } : bl;
  });

  return { draft: { ...state.draft, blocks } };
};
