import { describe, expect, it } from "vitest";

import {
  answerResponseQuestion,
  stripInlineIds,
  type ResponseChatDeps,
} from "@/lib/ai/graphs/response-chat/response-chat";
import type { AnalysisDataset } from "@/lib/db/responses/analytics";
import { formDefinitionSchema } from "@/lib/forms/schema";

const definition = formDefinitionSchema.parse({
  version: 1,
  title: "Cancellation",
  blocks: [
    {
      id: "role",
      type: "single_choice",
      title: "Your role",
      singleChoice: {
        options: [
          { id: "dev", label: "Developer" },
          { id: "des", label: "Designer" },
        ],
      },
    },
    { id: "score", type: "rating", title: "Rate onboarding", rating: { max: 5 } },
    { id: "why", type: "long_text", title: "What went wrong?", longText: {} },
  ],
  logic: [],
});

const dataset: AnalysisDataset = {
  formId: "f1",
  title: "Cancellation",
  definition,
  rows: [
    { id: "r1", answers: { role: "dev", score: 2, why: "Setup was confusing" }, completedAt: new Date() },
    { id: "r2", answers: { role: "dev", score: 1, why: "Docs were thin" }, completedAt: new Date() },
    { id: "r3", answers: { role: "dev", score: 5, why: "All good" }, completedAt: new Date() },
    { id: "r4", answers: { role: "des", score: 2, why: "Too technical" }, completedAt: null },
  ],
  loaded: 4,
  total: 4,
  truncated: false,
};

/** Each model returns the next canned reply; records what it was asked. */
function makeDeps(
  replies: { fast: unknown[]; smart: unknown[] },
  seen: { evidence?: string; classifyMessages?: { role?: string; content: string }[] } = {},
): ResponseChatDeps {
  const model = (queue: unknown[], capture: "evidence" | "classify") =>
    ({
      withStructuredOutput: () => ({
        invoke: async (messages: { role?: string; content: string }[]) => {
          if (capture === "evidence") {
            seen.evidence = messages[messages.length - 1].content;
          } else {
            seen.classifyMessages = messages;
          }
          return queue.shift();
        },
      }),
    }) as never;

  return {
    fast: model(replies.fast, "classify"),
    smart: model(replies.smart, "evidence"),
  };
}

describe("stripInlineIds", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  const other = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

  it("removes an id the model wrote into the prose", () => {
    // Real ids are UUIDs, so an inline citation is unreadable. Links are
    // rendered from `citations` separately.
    expect(stripInlineIds(`Setup was confusing (${uuid}) and docs thin.`, [uuid])).toBe(
      "Setup was confusing and docs thin.",
    );
  });

  it("cleans up the punctuation left behind", () => {
    expect(
      stripInlineIds(`Issues: setup (${uuid}), docs (${other}).`, [uuid, other]),
    ).toBe("Issues: setup, docs.");

    expect(stripInlineIds(`Two people [${uuid}, ${other}] complained.`, [uuid, other])).toBe(
      "Two people complained.",
    );
  });

  it("leaves prose without ids untouched", () => {
    const clean = "No ids here at all, mean 2.75.";
    expect(stripInlineIds(clean, [uuid])).toBe(clean);
  });

  it("does not touch an id that is merely a substring of a word", () => {
    expect(stripInlineIds("version a1b2 shipped", ["a1"])).toBe("version a1b2 shipped");
  });
});

describe("response chat graph", () => {
  it("routes a narrowed question through a filter and answers from the evidence", async () => {
    const seen: { evidence?: string } = {};
    const deps = makeDeps(
      {
        fast: [
          {
            tool: "get_question_results",
            blockId: "why",
            filter: {
              mode: "all",
              conditions: [
                { blockId: "role", operator: "equals", value: "dev" },
                { blockId: "score", operator: "less_than", value: 3 },
              ],
            },
          },
        ],
        smart: [
          { answer: "Two developers cited setup and docs.", citations: ["r1", "r2"] },
        ],
      },
      seen,
    );

    const result = await answerResponseQuestion(
      deps,
      dataset,
      "What are developers who rated below 3 complaining about?",
    );

    expect(result).toEqual({
      ok: true,
      answer: "Two developers cited setup and docs.",
      citations: ["r1", "r2"],
    });

    // The filter ran for real: r3 (score 5) and r4 (designer) are excluded.
    expect(seen.evidence).toContain('"matched":2');
    expect(seen.evidence).toContain("Setup was confusing");
    expect(seen.evidence).not.toContain("All good");
  });

  it("drops citations the evidence never contained", async () => {
    const deps = makeDeps({
      fast: [{ tool: "search_responses", searchQuery: "docs" }],
      smart: [{ answer: "Docs came up once.", citations: ["r2", "r99", "made-up"] }],
    });

    const result = await answerResponseQuestion(deps, dataset, "Any doc complaints?");

    // A fabricated id looks verifiable and isn't --- worse than no citation.
    expect(result).toEqual({
      ok: true,
      answer: "Docs came up once.",
      citations: ["r2"],
    });
  });

  it("tells the model when the sample is too small to generalise", async () => {
    const seen: { evidence?: string } = {};
    const deps = makeDeps(
      {
        fast: [
          {
            tool: "aggregate_responses",
            filter: {
              mode: "all",
              conditions: [{ blockId: "role", operator: "equals", value: "des" }],
            },
          },
        ],
        smart: [{ answer: "Only one designer responded.", citations: [] }],
      },
      seen,
    );

    await answerResponseQuestion(deps, dataset, "What do designers think?");

    expect(seen.evidence).toContain('"lowConfidence":true');
  });

  it("stops before synthesis when the tool call is unusable", async () => {
    const deps = makeDeps({
      fast: [{ tool: "get_question_results", blockId: "not_a_question" }],
      smart: [],
    });

    const result = await answerResponseQuestion(deps, dataset, "How did Q9 do?");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unknown question id");
  });

  it("gives the classifier earlier turns so a follow-up resolves", async () => {
    const seen: { classifyMessages?: { role?: string; content: string }[] } = {};
    const deps = makeDeps(
      {
        fast: [{ tool: "get_question_results", blockId: "why" }],
        smart: [{ answer: "Designers mentioned it was too technical.", citations: [] }],
      },
      seen,
    );

    await answerResponseQuestion(deps, dataset, "And what about designers?", [
      { question: "What are developers complaining about?", answer: "Setup and docs." },
    ]);

    const contents = (seen.classifyMessages ?? []).map((m) => m.content);

    // Without the prior turn, "and what about designers?" names no tool, no
    // question and no filter --- the classifier would be guessing.
    expect(contents).toContain("What are developers complaining about?");
    expect(contents).toContain("Setup and docs.");
    expect(contents.at(-1)).toBe("And what about designers?");
  });

  it("refuses a tool call missing its required argument", async () => {
    const deps = makeDeps({
      fast: [{ tool: "search_responses" }],
      smart: [],
    });

    const result = await answerResponseQuestion(deps, dataset, "find something");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("searchQuery");
  });
});
