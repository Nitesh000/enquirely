import type { AnswerValue } from "@/lib/forms/answers";
import type { FormBlock, FormDefinition } from "@/lib/forms/schema";

/**
 * Aggregation over response rows (`steps.md` M5.6).
 *
 * Pure functions over data already fetched --- no database, no React. M7's
 * AI tools wrap *these*, rather than writing their own queries, which is
 * what keeps the model inside workspace-scoped code paths it cannot widen
 * (`plan.md` §10). If this logic leaks into a route handler, M7 has nothing
 * to wrap.
 */

export type AnalyticsRow = {
  id: string;
  answers: Record<string, AnswerValue>;
  completedAt: Date | null;
};

export type ChoiceTally = {
  /** The stored option id, or the raw answer for free-text questions. */
  value: string;
  /** What a human should see --- the option's label where one exists. */
  label: string;
  count: number;
  /** Share of responses that answered this question at all, 0--1. */
  share: number;
};

export type NumericSummary = {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
};

/**
 * A free-text answer kept with the response it came from.
 *
 * The id is not decoration: a quote with no provenance cannot be cited, and
 * an AI answer that characterises what people said without pointing at who
 * said it is exactly the unverifiable output `steps.md` M7.4 rules out.
 */
export type TextAnswer = {
  responseId: string;
  text: string;
};

export type QuestionResult = {
  blockId: string;
  title: string;
  type: FormBlock["type"];
  /** Responses with a usable answer for this question. */
  answered: number;
  /** Rows considered, answered or not --- the denominator for drop-off. */
  total: number;
  distribution?: ChoiceTally[];
  numeric?: NumericSummary;
  /** Free-text answers, for questions where tallying values is meaningless. */
  textAnswers?: TextAnswer[];
};

/**
 * Ratings are small integers, so a raw division reports 16 digits of
 * precision the data does not have --- an answer reading "the average is
 * 2.9545454545454546" is both ugly and a false claim about accuracy.
 * Rounded here rather than at the point of display so every consumer
 * (the AI tools, a future chart, an export) agrees on the number.
 */
function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function isBlank(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function optionLabels(block: FormBlock): Map<string, string> {
  if (block.type === "single_choice") {
    return new Map(block.singleChoice.options.map((o) => [o.id, o.label]));
  }

  if (block.type === "multi_choice") {
    return new Map(block.multiChoice.options.map((o) => [o.id, o.label]));
  }

  // yes_no answers are stored as booleans, which tally to the literal keys
  // "true"/"false". Left unlabelled, an answer reads "19 said true".
  if (block.type === "yes_no") {
    return new Map([
      ["true", "Yes"],
      ["false", "No"],
    ]);
  }

  return new Map();
}

/**
 * Counts every selected value. Multi-choice answers contribute once per
 * selection, so the tallies sum to more than the response count --- which
 * is why `share` divides by the number that *answered*, not by the total of
 * all counts.
 */
function tally(block: FormBlock, values: AnswerValue[]): ChoiceTally[] {
  const labels = optionLabels(block);
  const counts = new Map<string, number>();

  for (const value of values) {
    const selected = Array.isArray(value) ? value : [value];

    for (const item of selected) {
      const key = String(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const answered = values.length;

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: labels.get(value) ?? value,
      count,
      share: answered === 0 ? 0 : round(count / answered, 4),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function summariseNumeric(values: AnswerValue[]): NumericSummary | undefined {
  const numbers = values
    .map((v) => (typeof v === "number" ? v : Number(String(v).trim())))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (numbers.length === 0) return undefined;

  const middle = Math.floor(numbers.length / 2);

  return {
    count: numbers.length,
    min: numbers[0],
    max: numbers[numbers.length - 1],
    mean: round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length, 2),
    median: round(
      numbers.length % 2 === 0
        ? (numbers[middle - 1] + numbers[middle]) / 2
        : numbers[middle],
      2,
    ),
  };
}

export function aggregateQuestion(
  block: FormBlock,
  rows: AnalyticsRow[],
): QuestionResult {
  // Kept paired with their row so free-text answers can carry provenance.
  const answered = rows.filter((row) => !isBlank(row.answers[block.id]));
  const values = answered.map((row) => row.answers[block.id] as AnswerValue);

  const result: QuestionResult = {
    blockId: block.id,
    title: block.title,
    type: block.type,
    answered: values.length,
    total: rows.length,
  };

  if (
    block.type === "single_choice" ||
    block.type === "multi_choice" ||
    block.type === "yes_no"
  ) {
    result.distribution = tally(block, values);
    return result;
  }

  if (block.type === "number" || block.type === "rating") {
    result.numeric = summariseNumeric(values);
    // A rating is a small fixed scale, so the per-value breakdown is as
    // useful as the mean --- "mostly 5s and 1s" and "everyone said 3" share
    // a mean and mean opposite things.
    if (block.type === "rating") result.distribution = tally(block, values);
    return result;
  }

  result.textAnswers = answered.map((row) => {
    const value = row.answers[block.id] as AnswerValue;
    return {
      responseId: row.id,
      text: Array.isArray(value) ? value.join(", ") : String(value),
    };
  });

  return result;
}

export function aggregateForm(
  definition: FormDefinition,
  rows: AnalyticsRow[],
): QuestionResult[] {
  return definition.blocks.map((block) => aggregateQuestion(block, rows));
}

export type CompletionStats = {
  total: number;
  completed: number;
  partial: number;
  /** 0--1, or 0 when there is nothing to divide by. */
  completionRate: number;
};

export function completionStats(rows: AnalyticsRow[]): CompletionStats {
  const completed = rows.filter((row) => row.completedAt !== null).length;

  return {
    total: rows.length,
    completed,
    partial: rows.length - completed,
    completionRate: rows.length === 0 ? 0 : completed / rows.length,
  };
}
