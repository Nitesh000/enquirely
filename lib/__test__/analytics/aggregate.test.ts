import { describe, expect, it } from "vitest";

import {
  aggregateForm,
  aggregateQuestion,
  completionStats,
  type AnalyticsRow,
} from "@/lib/analytics/aggregate";
import { formDefinitionSchema, type FormBlock } from "@/lib/forms/schema";

const definition = formDefinitionSchema.parse({
  version: 1,
  title: "Churn",
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
    {
      id: "tools",
      type: "multi_choice",
      title: "Tools you use",
      multiChoice: {
        options: [
          { id: "vs", label: "VS Code" },
          { id: "vim", label: "Vim" },
        ],
      },
    },
    { id: "score", type: "rating", title: "Rate us", rating: { max: 5 } },
    { id: "why", type: "long_text", title: "Why?", longText: {} },
  ],
  logic: [],
});

const block = (id: string): FormBlock =>
  definition.blocks.find((b) => b.id === id)!;

const rows: AnalyticsRow[] = [
  { id: "r1", answers: { role: "dev", tools: ["vs", "vim"], score: 2, why: "Confusing" }, completedAt: new Date() },
  { id: "r2", answers: { role: "dev", tools: ["vs"], score: 4, why: "Fine" }, completedAt: new Date() },
  { id: "r3", answers: { role: "des", tools: [], score: 3, why: "" }, completedAt: null },
  { id: "r4", answers: {}, completedAt: null },
];

describe("aggregateQuestion", () => {
  it("tallies choices by label, ordered by count", () => {
    const result = aggregateQuestion(block("role"), rows);

    expect(result.answered).toBe(3);
    expect(result.total).toBe(4);
    // Shares are rounded: 2/3 raw is 0.6666666666666666, which reads as
    // 66.66666666666666% wherever it is displayed.
    expect(result.distribution).toEqual([
      { value: "dev", label: "Developer", count: 2, share: 0.6667 },
      { value: "des", label: "Designer", count: 1, share: 0.3333 },
    ]);
  });

  it("counts each selection of a multi-choice, sharing against responders", () => {
    const result = aggregateQuestion(block("tools"), rows);

    // Two people answered; three selections between them. Shares therefore
    // sum above 1, which is correct for multi-select.
    expect(result.answered).toBe(2);
    expect(result.distribution).toEqual([
      { value: "vs", label: "VS Code", count: 2, share: 1 },
      { value: "vim", label: "Vim", count: 1, share: 0.5 },
    ]);
  });

  it("summarises numeric answers", () => {
    const result = aggregateQuestion(block("score"), rows);

    expect(result.numeric).toEqual({
      count: 3,
      min: 2,
      max: 4,
      mean: 3,
      median: 3,
    });
  });

  it("also breaks a rating down per value, since the mean hides shape", () => {
    const polarised: AnalyticsRow[] = [
      { id: "a", answers: { score: 1 }, completedAt: null },
      { id: "b", answers: { score: 5 }, completedAt: null },
    ];

    const result = aggregateQuestion(block("score"), polarised);

    expect(result.numeric?.mean).toBe(3);
    expect(result.distribution).toHaveLength(2);
  });

  it("averages the two middle values for an even count", () => {
    const even: AnalyticsRow[] = [
      { id: "a", answers: { score: 1 }, completedAt: null },
      { id: "b", answers: { score: 2 }, completedAt: null },
      { id: "c", answers: { score: 3 }, completedAt: null },
      { id: "d", answers: { score: 10 }, completedAt: null },
    ];

    expect(aggregateQuestion(block("score"), even).numeric?.median).toBe(2.5);
  });

  it("collects free text instead of tallying it", () => {
    const result = aggregateQuestion(block("why"), rows);

    // Each quote keeps the response it came from --- without that id an AI
    // answer can characterise what people said but never point at who.
    expect(result.textAnswers).toEqual([
      { responseId: "r1", text: "Confusing" },
      { responseId: "r2", text: "Fine" },
    ]);
    expect(result.distribution).toBeUndefined();
  });

  it("treats empty string and empty array as unanswered", () => {
    // r3 has why:"" and tools:[]; r4 has nothing at all.
    expect(aggregateQuestion(block("why"), rows).answered).toBe(2);
    expect(aggregateQuestion(block("tools"), rows).answered).toBe(2);
  });

  it("survives a question nobody answered", () => {
    const result = aggregateQuestion(block("score"), [
      { id: "x", answers: {}, completedAt: null },
    ]);

    expect(result.answered).toBe(0);
    expect(result.numeric).toBeUndefined();
  });

  it("returns a result per block, in definition order", () => {
    expect(aggregateForm(definition, rows).map((r) => r.blockId)).toEqual([
      "role",
      "tools",
      "score",
      "why",
    ]);
  });
});

describe("completionStats", () => {
  it("splits completed from partial", () => {
    expect(completionStats(rows)).toEqual({
      total: 4,
      completed: 2,
      partial: 2,
      completionRate: 0.5,
    });
  });

  it("does not divide by zero", () => {
    expect(completionStats([])).toEqual({
      total: 0,
      completed: 0,
      partial: 0,
      completionRate: 0,
    });
  });
});

describe("precision", () => {
  it("does not report more precision than integer answers carry", () => {
    // 63 / 22 = 2.8636363636363638 raw, which an AI answer repeats verbatim.
    const awkward: AnalyticsRow[] = Array.from({ length: 22 }, (_, i) => ({
      id: `r${i}`,
      answers: { score: (i % 5) + 1 },
      completedAt: null,
    }));

    const result = aggregateQuestion(block("score"), awkward);

    expect(result.numeric?.mean).toBe(2.86);
    expect(String(result.numeric?.mean)).not.toContain("363636");
  });
});
