import { describe, expect, it } from "vitest";

import { createResponseTools } from "@/lib/ai/tools/responses";
import type { AnalysisDataset } from "@/lib/db/responses/analytics";
import { formDefinitionSchema } from "@/lib/forms/schema";

const definition = formDefinitionSchema.parse({
  version: 1,
  title: "Churn",
  logic: [],
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
    { id: "score", type: "rating", title: "Rate us", rating: { max: 5 } },
    { id: "why", type: "long_text", title: "Why?", longText: {} },
  ],
});

function dataset(rows: AnalysisDataset["rows"]): AnalysisDataset {
  return {
    formId: "f1",
    title: "Churn",
    definition,
    rows,
    loaded: rows.length,
    total: rows.length,
    truncated: false,
  };
}

const rows = [
  { id: "r1", answers: { role: "dev", score: 2, why: "Confusing" }, completedAt: new Date() },
  { id: "r2", answers: { role: "dev", score: 5, why: "Great" }, completedAt: new Date() },
  { id: "r3", answers: { role: "des", score: 1, why: "Too technical" }, completedAt: null },
];

describe("response tools", () => {
  it("exposes option ids, which is what answers actually store", () => {
    const result = createResponseTools(dataset(rows)).getFormSchema();

    expect(result.ok).toBe(true);
    const data = (result as { data: { questions: { blockId: string; options?: unknown[] }[] } }).data;

    expect(data.questions.find((q) => q.blockId === "role")?.options).toEqual([
      { id: "dev", label: "Developer" },
      { id: "des", label: "Designer" },
    ]);
  });

  it("filters with the same evaluator the branching engine uses", () => {
    const result = createResponseTools(dataset(rows)).filterResponses({
      mode: "all",
      conditions: [
        { blockId: "role", operator: "equals", value: "dev" },
        { blockId: "score", operator: "less_than", value: 3 },
      ],
    });

    expect(result.ok).toBe(true);
    const data = (result as { data: { matched: number; responses: { responseId: string }[] } }).data;

    expect(data.matched).toBe(1);
    expect(data.responses[0].responseId).toBe("r1");
  });

  it("rejects an unknown question rather than silently matching nothing", () => {
    const result = createResponseTools(dataset(rows)).filterResponses({
      mode: "all",
      conditions: [{ blockId: "not_a_question", operator: "equals", value: "x" }],
    });

    // Silently returning 0 matches would read to the model as "nobody said
    // that" instead of "you asked the wrong thing".
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not_a_question");
  });

  it("flags a form with too few responses to draw conclusions from", () => {
    const result = createResponseTools(dataset(rows)).aggregateResponses();
    const data = (result as { data: { lowConfidence: boolean; smallSample: boolean } }).data;

    // Three responses in total: nothing drawn from this generalises.
    expect(data).toMatchObject({ lowConfidence: true, smallSample: true });
  });

  it("separates a small slice from a small form", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `r${i}`,
      answers: { role: i < 3 ? "des" : "dev", score: 3, why: `note ${i}` },
      completedAt: null,
    }));

    const tools = createResponseTools(dataset(many));
    const designers = tools.aggregateResponses({
      mode: "all",
      conditions: [{ blockId: "role", operator: "equals", value: "des" }],
    });

    const data = (designers as { data: { lowConfidence: boolean; smallSample: boolean; matched: number } }).data;

    // 3 of 40. The slice is small, the form is not --- collapsing these made
    // every narrowed question end with "too small to generalise".
    expect(data).toMatchObject({
      matched: 3,
      smallSample: true,
      lowConfidence: false,
    });
  });

  it("caps verbatim quotes but keeps the counts exact", () => {
    const many = Array.from({ length: 500 }, (_, i) => ({
      id: `r${i}`,
      answers: { role: "dev", score: 3, why: `Complaint number ${i}` },
      completedAt: null,
    }));

    const result = createResponseTools(dataset(many)).aggregateResponses();
    const question = (
      result as {
        data: {
          questions: {
            blockId: string;
            answered: number;
            textAnswers?: string[];
            textAnswersOmitted?: number;
          }[];
        };
      }
    ).data.questions.find((q) => q.blockId === "why")!;

    // The number that matters stays true; only the quotes are sampled, and
    // the omission is reported so a sample is never presented as the whole.
    expect(question.answered).toBe(500);
    expect(question.textAnswers).toHaveLength(40);
    expect(question.textAnswersOmitted).toBe(460);
  });

  it("attaches a response id to every quote, and no blanket id list", () => {
    const result = createResponseTools(dataset(rows)).getQuestionResults("why");
    const data = result as {
      data: {
        responseIds?: unknown;
        questions: { blockId: string; textAnswers?: { responseId: string; text: string }[] }[];
      };
    };

    // Quotes are citable because they carry provenance...
    expect(data.data.questions[0].textAnswers).toEqual([
      { responseId: "r1", text: "Confusing" },
      { responseId: "r2", text: "Great" },
      { responseId: "r3", text: "Too technical" },
    ]);

    // ...and there is no flat list of every matching row. Handing one over
    // made the model cite all twelve respondents behind a single average.
    expect(data.data.responseIds).toBeUndefined();
  });

  it("searches within the filtered slice, not the whole dataset", () => {
    const tools = createResponseTools(dataset(rows));
    const devsOnly = {
      mode: "all" as const,
      conditions: [{ blockId: "role", operator: "equals" as const, value: "dev" }],
    };

    // "Confusing" appears once, from a developer. "technical" once, from a
    // designer. Ignoring the filter would answer a different question than
    // the one asked.
    const hit = tools.searchResponses("confusing", devsOnly);
    const miss = tools.searchResponses("technical", devsOnly);

    expect((hit as { data: { matched: number; searchedWithin: number } }).data).toMatchObject({
      matched: 1,
      searchedWithin: 2,
    });
    expect((miss as { data: { matched: number } }).data.matched).toBe(0);

    // Unfiltered, the designer's answer is found.
    expect(
      (tools.searchResponses("technical") as { data: { matched: number } }).data.matched,
    ).toBe(1);
  });

  it("compares named groups side by side", () => {
    const result = createResponseTools(dataset(rows)).compareGroups(
      [
        { label: "Developers", filter: { mode: "all", conditions: [{ blockId: "role", operator: "equals", value: "dev" }] } },
        { label: "Designers", filter: { mode: "all", conditions: [{ blockId: "role", operator: "equals", value: "des" }] } },
      ],
      "score",
    );

    expect(result.ok).toBe(true);
    const groups = (result as { data: { groups: { label: string; matched: number; questions: { numeric?: { mean: number } }[] }[] } }).data.groups;

    // A single whole-population aggregate cannot answer "how do X compare
    // to Y" --- it has no per-group breakdown to compare.
    expect(groups.map((g) => [g.label, g.matched])).toEqual([
      ["Developers", 2],
      ["Designers", 1],
    ]);
    expect(groups[0].questions[0].numeric?.mean).toBe(3.5);
    expect(groups[1].questions[0].numeric?.mean).toBe(1);
  });

  it("reports an empty group rather than dropping it", () => {
    const result = createResponseTools(dataset(rows)).compareGroups([
      { label: "Developers", filter: { mode: "all", conditions: [{ blockId: "role", operator: "equals", value: "dev" }] } },
      { label: "Product managers", filter: { mode: "all", conditions: [{ blockId: "role", operator: "equals", value: "pm" }] } },
    ]);

    const groups = (result as { data: { groups: { label: string; matched: number }[] } }).data.groups;

    // "No product managers answered" is a finding. Omitting the group would
    // read as though the comparison had nothing to say about them.
    expect(groups[1]).toMatchObject({ label: "Product managers", matched: 0 });
  });

  it("refuses a comparison with fewer than two groups", () => {
    const result = createResponseTools(dataset(rows)).compareGroups([
      { label: "Developers", filter: { mode: "all", conditions: [{ blockId: "role", operator: "equals", value: "dev" }] } },
    ]);

    expect(result.ok).toBe(false);
  });

  it("takes no form or workspace argument the model could widen", () => {
    const tools = createResponseTools(dataset(rows));

    // Scope is closed over, not passed in. The widest signature is
    // (filter) / (blockId, filter) --- no tool accepts a form or workspace
    // id, so there is no argument the model could use to reach other data.
    expect(tools.getFormSchema).toHaveLength(0);
    expect(tools.aggregateResponses).toHaveLength(1);
    expect(tools.filterResponses).toHaveLength(1);
    expect(tools.getQuestionResults).toHaveLength(2);
  });
});
