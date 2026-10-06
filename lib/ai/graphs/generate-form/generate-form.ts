import { FormDefinition, formDefinitionSchema } from "@/lib/forms/schema";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import z from "zod";
import { blocksSchema, Intent, MAX_VALIDATION_RETRIES } from "./schema";
import { understandIntent } from "./nodes/understand-intent";
import { generateBlocks } from "./nodes/generate-blocks";
import { validateNode } from "./nodes/validate-node";
import { improveWording } from "./nodes/improve-wording";

const GraphState = Annotation.Root({
  brief: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  intent: Annotation<Intent | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  draft: Annotation<FormDefinition | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  issues: Annotation<string[]>({ reducer: (_, b) => b, default: () => [] }),
  attempts: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  error: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
});

export type FormGenerationState = typeof GraphState.State;

export type GenerateFormDeps = {
  fast: BaseChatModel;
  smart: BaseChatModel;
};

export function assembleDefinition(
  parts: z.infer<typeof blocksSchema>,
): FormDefinition {
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
    .addNode("understandIntent", (s) => understandIntent(s, deps))
    .addNode("generateBlocks", (s) => generateBlocks(s, deps))
    .addNode("validate", (s) => validateNode(s, deps))
    .addNode("improveWording", (s) => improveWording(s, deps))
    .addEdge(START, "understandIntent")
    .addEdge("understandIntent", "generateBlocks")
    .addEdge("generateBlocks", "validate")
    .addConditionalEdges(
      "validate",
      (state) => {
        if (state.issues.length === 0) return "ok";
        return state.attempts >= MAX_VALIDATION_RETRIES ? "giveUp" : "retry";
      },
      {
        ok: "improveWording",
        retry: "generateBlocks",
        giveUp: END,
      },
    )
    .addEdge("improveWording", END);

  return graph.compile();
}

export type FormGenerationResult =
  { ok: true; definition: FormDefinition } | { ok: false; issues: string[] };

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
