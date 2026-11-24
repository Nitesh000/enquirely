import { z } from "zod";

import {
  aggregateForm,
  aggregateQuestion,
  completionStats,
  type AnalyticsRow,
  type QuestionResult,
} from "@/lib/analytics/aggregate";
import { evaluateConditionGroup } from "@/lib/forms/conditions";
import { conditionSchema, type ConditionGroup } from "@/lib/forms/schema";
import type { AnalysisDataset } from "@/lib/db/responses/analytics";

/**
 * Tools for the response-chat graph (`steps.md` M7.1, `plan.md` §10).
 *
 * Two rules hold the design together:
 *
 * 1. **The tools wrap existing functions, never new queries.** Filtering is
 *    `evaluateConditionGroup`, aggregation is `lib/analytics/aggregate`.
 *    The model gets the same semantics the builder and the response table
 *    use, not a parallel implementation that can disagree with them.
 *
 * 2. **Scope is bound before the model sees a tool.** `createResponseTools`
 *    closes over a dataset already fetched for one workspace-scoped form,
 *    so no tool takes a `formId` or `workspaceId` argument --- there is no
 *    parameter the model could use to widen its own access.
 */

/**
 * A deliberately flat filter: one level of `all`/`any` over plain
 * conditions. The real `ConditionGroup` nests arbitrarily, which forces
 * `$ref` into the JSON Schema sent to the provider --- the member tool
 * validators are least likely to accept. The flat shape is a strict subset,
 * so widening it below is lossless.
 */
export const responseFilterSchema = z.object({
  mode: z.enum(["all", "any"]).default("all"),
  conditions: z.array(conditionSchema).min(1),
});

export type ResponseFilter = z.infer<typeof responseFilterSchema>;

export function toConditionGroup(filter: ResponseFilter): ConditionGroup {
  return filter.mode === "all"
    ? { all: filter.conditions }
    : { any: filter.conditions };
}

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

/** A named slice of the responses, for side-by-side comparison. */
export const comparisonGroupSchema = z.object({
  label: z
    .string()
    .min(1)
    .describe("How to refer to this group in the answer, e.g. 'Developers'."),
  filter: responseFilterSchema,
});

export type ComparisonGroup = z.infer<typeof comparisonGroupSchema>;

export type ResponseTools = {
  getFormSchema: () => ToolResult;
  filterResponses: (filter: ResponseFilter) => ToolResult;
  aggregateResponses: (filter?: ResponseFilter) => ToolResult;
  getQuestionResults: (blockId: string, filter?: ResponseFilter) => ToolResult;
  searchResponses: (
    query: string,
    filter?: ResponseFilter,
    limit?: number,
  ) => ToolResult;
  compareGroups: (groups: ComparisonGroup[], blockId?: string) => ToolResult;
};

/** Enough of a response for the model to quote and cite, and no more. */
function sample(rows: AnalyticsRow[], limit: number) {
  return rows.slice(0, limit).map((row) => ({
    responseId: row.id,
    completed: row.completedAt !== null,
    answers: row.answers,
  }));
}

function matching(dataset: AnalysisDataset, filter?: ResponseFilter) {
  if (!filter) return dataset.rows;

  const group = toConditionGroup(filter);
  return dataset.rows.filter((row) =>
    evaluateConditionGroup(group, row.answers),
  );
}

/**
 * Below this, a distribution is noise dressed as a finding (`steps.md`
 * M7.10).
 *
 * Two different facts are derived from it, and collapsing them into one
 * flag made every narrowed question on a small form end with "the sample is
 * too small to generalise":
 *
 *   lowConfidence  the WHOLE FORM has too few responses. Nothing drawn from
 *                  it generalises, and that is worth saying plainly.
 *   smallSample    this particular slice is small, but the form is not.
 *                  "3 of the 47 designers" is a size worth stating, not a
 *                  reason to disclaim the answer.
 *
 * Quoting three people accurately is not a generalisation, so neither flag
 * should attach a caveat to a list of what specific respondents wrote.
 */
export const MIN_ROWS_FOR_CONFIDENCE = 10;

/**
 * Free-text answers sent to the model per question.
 *
 * `aggregateQuestion` returns every one of them, which is right for an
 * exporter and ruinous for a prompt: measured at ~101k tokens for 5,000
 * responses across two text questions. Counts and distributions stay exact
 * --- only the verbatim quotes are sampled, and the model is told how many
 * it did not see so it cannot present a sample as the whole.
 */
const MAX_TEXT_ANSWERS = 40;

function capText(results: QuestionResult[]) {
  return results.map((result) => {
    if (!result.textAnswers || result.textAnswers.length <= MAX_TEXT_ANSWERS) {
      return result;
    }

    return {
      ...result,
      textAnswers: result.textAnswers.slice(0, MAX_TEXT_ANSWERS),
      textAnswersOmitted: result.textAnswers.length - MAX_TEXT_ANSWERS,
    };
  });
}

export function createResponseTools(dataset: AnalysisDataset): ResponseTools {
  function describe(rows: AnalyticsRow[], results: QuestionResult[]) {
    return {
      matched: rows.length,
      totalResponses: dataset.total,
      truncated: dataset.truncated,
      lowConfidence: dataset.total < MIN_ROWS_FOR_CONFIDENCE,
      smallSample: rows.length < MIN_ROWS_FOR_CONFIDENCE,
      completion: completionStats(rows),
      questions: capText(results),
    };
  }

  return {
    getFormSchema() {
      return {
        ok: true,
        data: {
          title: dataset.title,
          totalResponses: dataset.total,
          truncated: dataset.truncated,
          questions: dataset.definition.blocks.map((block) => ({
            blockId: block.id,
            title: block.title,
            type: block.type,
            options:
              block.type === "single_choice"
                ? block.singleChoice.options
                : block.type === "multi_choice"
                  ? block.multiChoice.options
                  : undefined,
          })),
        },
      };
    },

    filterResponses(filter) {
      const unknown = filter.conditions
        .map((c) => c.blockId)
        .filter((id) => !dataset.definition.blocks.some((b) => b.id === id));

      if (unknown.length > 0) {
        return {
          ok: false,
          error: `Unknown question id(s): ${unknown.join(", ")}. Call get_form_schema first.`,
        };
      }

      const rows = matching(dataset, filter);

      return {
        ok: true,
        data: {
          matched: rows.length,
          totalResponses: dataset.total,
          lowConfidence: dataset.total < MIN_ROWS_FOR_CONFIDENCE,
          smallSample: rows.length < MIN_ROWS_FOR_CONFIDENCE,
          responses: sample(rows, 25),
        },
      };
    },

    aggregateResponses(filter) {
      const rows = matching(dataset, filter);
      return {
        ok: true,
        data: describe(rows, aggregateForm(dataset.definition, rows)),
      };
    },

    getQuestionResults(blockId, filter) {
      const block = dataset.definition.blocks.find((b) => b.id === blockId);

      if (!block) {
        return {
          ok: false,
          error: `Unknown question id: ${blockId}. Call get_form_schema first.`,
        };
      }

      const rows = matching(dataset, filter);

      // No blanket list of ids here. Handing over every matching row made
      // the model cite all of them for a purely numeric claim --- a dozen
      // links that support nothing. Free-text answers carry their own
      // `responseId`, which is what a quote actually needs.
      return { ok: true, data: describe(rows, [aggregateQuestion(block, rows)]) };
    },

    compareGroups(groups, blockId) {
      if (groups.length < 2) {
        return { ok: false, error: "compare_groups needs at least two groups." };
      }

      const block = blockId
        ? dataset.definition.blocks.find((b) => b.id === blockId)
        : undefined;

      if (blockId && !block) {
        return {
          ok: false,
          error: `Unknown question id: ${blockId}. Call get_form_schema first.`,
        };
      }

      const blocks = block ? [block] : dataset.definition.blocks;

      return {
        ok: true,
        data: {
          totalResponses: dataset.total,
          truncated: dataset.truncated,
          lowConfidence: dataset.total < MIN_ROWS_FOR_CONFIDENCE,
          groups: groups.map((group) => {
            const rows = matching(dataset, group.filter);

            return {
              label: group.label,
              matched: rows.length,
              smallSample: rows.length < MIN_ROWS_FOR_CONFIDENCE,
              // An empty group is reported, not omitted --- "no designers
              // answered" is a finding, and a silently missing group reads
              // as though the comparison simply had nothing to say.
              questions: capText(
                blocks.map((b) => aggregateQuestion(b, rows)),
              ),
            };
          }),
        },
      };
    },

    searchResponses(query, filter, limit = 25) {
      const needle = query.trim().toLowerCase();

      if (needle === "") {
        return { ok: false, error: "Search query was empty." };
      }

      // Search within the filtered slice, not the whole dataset. Dropping
      // the filter here answered "what are developers complaining about"
      // from everyone's answers, which is a different question.
      const candidates = matching(dataset, filter);

      const rows = candidates.filter((row) =>
        Object.values(row.answers).some((value) =>
          (Array.isArray(value) ? value.join(" ") : String(value))
            .toLowerCase()
            .includes(needle),
        ),
      );

      return {
        ok: true,
        data: {
          matched: rows.length,
          searchedWithin: candidates.length,
          totalResponses: dataset.total,
          responses: sample(rows, limit),
        },
      };
    },
  };
}
