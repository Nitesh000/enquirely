import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { invokeStructured } from "@/lib/ai/invoke-structured";
import {
  createResponseTools,
  type ResponseTools,
  type ToolResult,
} from "@/lib/ai/tools/responses";
import type { AnalysisDataset } from "@/lib/db/responses/analytics";

import {
  chatAnswerSchema,
  chatIntentSchema,
  type ChatAnswer,
  type ChatIntent,
} from "./schema";

export type ResponseChatDeps = {
  fast: BaseChatModel;
  smart: BaseChatModel;
};

/** One completed exchange, oldest first. */
export type ChatTurn = { question: string; answer: string };

export const ChatState = Annotation.Root({
  question: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  /**
   * Earlier turns, so a follow-up resolves. "And what about designers?"
   * carries no tool, no question id and no filter on its own --- without
   * the turn before it, the classifier is guessing.
   */
  history: Annotation<ChatTurn[]>({ reducer: (_, b) => b, default: () => [] }),
  intent: Annotation<ChatIntent | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  evidence: Annotation<unknown>({ reducer: (_, b) => b, default: () => null }),
  answer: Annotation<ChatAnswer | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
});

export type ChatStateType = typeof ChatState.State;

function runTool(tools: ResponseTools, intent: ChatIntent): ToolResult {
  switch (intent.tool) {
    case "get_form_schema":
      return tools.getFormSchema();
    case "filter_responses":
      return intent.filter
        ? tools.filterResponses(intent.filter)
        : { ok: false, error: "filter_responses needs a filter." };
    case "aggregate_responses":
      return tools.aggregateResponses(intent.filter);
    case "get_question_results":
      return intent.blockId
        ? tools.getQuestionResults(intent.blockId, intent.filter)
        : { ok: false, error: "get_question_results needs a blockId." };
    case "search_responses":
      return intent.searchQuery
        ? tools.searchResponses(intent.searchQuery, intent.filter)
        : { ok: false, error: "search_responses needs a searchQuery." };
    case "compare_groups":
      return intent.groups && intent.groups.length >= 2
        ? tools.compareGroups(intent.groups, intent.blockId)
        : { ok: false, error: "compare_groups needs at least two groups." };
  }
}

/**
 * Removes response ids the model wrote into its prose.
 *
 * Real ids are UUIDs, so an inline citation reads as
 * "docs were thin (550e8400-e29b-41d4-a716-446655440000)". The prompt asks
 * for ids in the citations list only, but a prompt is a request --- this is
 * the guarantee. Links are rendered separately from `citations`.
 */
export function stripInlineIds(text: string, ids: Iterable<string>): string {
  let out = text;

  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "g"), "");
  }

  return (
    out
      // Brackets left holding nothing but separators, e.g. "( , )" or "[]".
      .replace(/[([]\s*[,;]?(?:\s*[,;])*\s*[)\]]/g, "")
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/([([])\s+/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/** Every response id the evidence actually contains, at any depth. */
function collectResponseIds(evidence: unknown): Set<string> {
  const ids = new Set<string>();

  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== "object") return;

    for (const [key, value] of Object.entries(node)) {
      if (key === "responseId" && typeof value === "string") ids.add(value);
      else if (key === "responseIds" && Array.isArray(value)) {
        value.forEach((v) => typeof v === "string" && ids.add(v));
      } else walk(value);
    }
  };

  walk(evidence);
  return ids;
}

export function createResponseChatGraph(
  deps: ResponseChatDeps,
  dataset: AnalysisDataset,
) {
  const tools = createResponseTools(dataset);

  // Option *ids* are listed, not just labels: answers store the id, so a
  // filter comparing against "developers" matches nothing while looking
  // perfectly reasonable in the logs.
  const questionList = dataset.definition.blocks
    .map((block) => {
      const options =
        block.type === "single_choice"
          ? block.singleChoice.options
          : block.type === "multi_choice"
            ? block.multiChoice.options
            : null;

      const base = `- ${block.id}: "${block.title}" (${block.type})`;
      if (!options) return base;

      const values = options
        .map((o) => `${o.id} = "${o.label}"`)
        .join(", ");

      return `${base}\n    values: ${values}`;
    })
    .join("\n");

  return new StateGraph(ChatState)
    .addNode("classify", async (state) => {
      const intent = (await invokeStructured(deps.fast, chatIntentSchema, [
        {
          role: "system",
          content: [
            "You pick which single tool answers a question about survey responses.",
            "",
            "Tools:",
            "- get_form_schema: what questions exist. Use when the user asks what the form covers.",
            "- aggregate_responses: counts and averages across every question.",
            "- get_question_results: counts and averages for ONE question. Needs blockId.",
            "- filter_responses: the responses matching conditions. Needs filter.",
            "- search_responses: responses whose text contains words. Needs searchQuery.",
            "  searchQuery is matched literally against what people wrote, so use",
            "  words a respondent would type ('pricing', 'slow'). Never use the",
            "  wording of a question title --- nobody answers by repeating it.",
            "  To read what a group wrote generally, prefer get_question_results",
            "  on the free-text question with a filter.",
            "- compare_groups: two or more named slices side by side. Needs groups.",
            "  Use it whenever the question contrasts audiences --- 'X vs Y',",
            "  'how do X compare to Y', 'do X differ from Y'. A single",
            "  aggregate cannot answer those: it has no per-group breakdown.",
            "",
            "Questions in this form (use these ids, never the titles):",
            questionList,
            "",
            "Add a filter whenever the user narrows the audience, e.g. 'developers who rated below 3'.",
            "Earlier turns may precede the question. A follow-up like 'and what",
            "about designers?' means: keep the previous tool and question, swap",
            "only what the user changed.",
            "For choice questions, compare against the value id shown above, never the label.",
            "yes_no answers are booleans: compare against true or false, never",
            "the words 'yes' or 'no'.",
          ].join("\n"),
        },
        ...state.history.flatMap((turn) => [
          { role: "human" as const, content: turn.question },
          { role: "ai" as const, content: turn.answer },
        ]),
        { role: "human", content: state.question },
      ], { name: "intent" })) as ChatIntent;

      return { intent };
    })

    .addNode("gather", async (state) => {
      if (!state.intent) return { error: "No intent was produced." };

      const result = runTool(tools, state.intent);

      return result.ok
        ? { evidence: result.data }
        : { error: result.error, evidence: null };
    })

    .addNode("synthesise", async (state) => {
      const result = (await invokeStructured(deps.smart, chatAnswerSchema, [
        {
          role: "system",
          content: [
            "You answer questions about survey responses using ONLY the evidence given.",
            "",
            "Rules:",
            "- Never invent a number. Every figure must appear in the evidence.",
            "- If `truncated` is true, say the answer covers the most recent responses only.",
            "",
            "Sample size:",
            "- `lowConfidence` means the whole form has too few responses. Say once,",
            "  plainly, that there are too few to draw conclusions from.",
            "- `smallSample` means only this slice is small. State the size as a",
            "  fact ('3 of the 47 who answered') and move on. Do NOT add a",
            "  'cannot generalise' disclaimer --- the reader can see the number.",
            "- Never disclaim a list of what specific people wrote. Quoting three",
            "  respondents accurately is not a generalisation.",
            "- If the evidence does not answer the question, say so plainly.",
            "- Be brief. No preamble.",
            "",
            "Citations:",
            "- Cite a response only when you quote or characterise what that person wrote.",
            "- Free-text answers carry a `responseId`. That is the id to cite.",
            "- Put ids ONLY in the citations list. Never write one into the prose:",
            "  they are long opaque identifiers and the reader is shown links",
            "  separately.",
            "- Cite nothing for a purely numeric claim: a count or an average is",
            "  verifiable from the figures themselves, and listing every respondent",
            "  behind it is noise.",
            "- Never cite an id that does not appear in the evidence.",
          ].join("\n"),
        },
        {
          role: "human",
          content: `Question: ${state.question}\n\nEvidence:\n${JSON.stringify(
            state.evidence,
          )}`,
        },
      ], { name: "answer" })) as ChatAnswer;

      // A fabricated citation is worse than none: it looks verifiable and
      // isn't. Drop any id the evidence did not contain.
      const known = collectResponseIds(state.evidence);
      const citations = result.citations.filter((id) => known.has(id));

      return {
        answer: {
          answer: stripInlineIds(result.answer, known),
          citations,
        },
      };
    })

    .addEdge(START, "classify")
    .addEdge("classify", "gather")
    .addConditionalEdges(
      "gather",
      (state: ChatStateType) => (state.error ? "failed" : "ok"),
      { ok: "synthesise", failed: END },
    )
    .addEdge("synthesise", END)
    .compile();
}

export type ChatResult =
  | { ok: true; answer: string; citations: string[] }
  | { ok: false; error: string };

export async function answerResponseQuestion(
  deps: ResponseChatDeps,
  dataset: AnalysisDataset,
  question: string,
  history: ChatTurn[] = [],
): Promise<ChatResult> {
  const graph = createResponseChatGraph(deps, dataset);
  const state = (await graph.invoke({ question, history })) as ChatStateType;

  if (state.error || !state.answer) {
    return { ok: false, error: state.error ?? "No answer was produced." };
  }

  return {
    ok: true,
    answer: state.answer.answer,
    citations: state.answer.citations,
  };
}
