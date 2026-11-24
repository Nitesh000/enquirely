import "server-only";

import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { formVersions, forms, responses } from "@/lib/db/schema";
import type { AnalyticsRow } from "@/lib/analytics/aggregate";
import type { AnswerValue } from "@/lib/forms/answers";
import type { FormDefinition } from "@/lib/forms/schema";

/**
 * Hard ceiling on rows pulled into memory for one analysis. Truncation is
 * reported rather than silent --- an answer computed from the newest 5,000
 * of 40,000 responses is not wrong, but presenting it as "all responses"
 * would be.
 */
export const ANALYSIS_ROW_LIMIT = 5000;

export type AnalysisDataset = {
  formId: string;
  title: string;
  /** The definition questions are described against --- published if there is one. */
  definition: FormDefinition;
  rows: AnalyticsRow[];
  /** Rows actually loaded (may be fewer than `total`). */
  loaded: number;
  total: number;
  truncated: boolean;
};

/**
 * Every response for a form, for aggregation and filtering in memory.
 *
 * Deliberately *not* filtered in SQL. `evaluateConditionGroup`
 * (`lib/forms/conditions.ts`) is the one implementation of what a condition
 * means, shared with M4's branching engine and M7's `filter_responses`
 * tool; generating a second, SQL-shaped copy is how "shown to the
 * respondent" and "matched by a filter" start disagreeing. The paginated
 * table in `listResponsesTable` filters in SQL because it must order the
 * whole set to show one page --- analysis has no such constraint, it reads
 * everything once and reduces.
 *
 * Scoped by workspace at the query, not by a check afterwards: a form id
 * from another workspace matches nothing here.
 */
export async function loadResponsesForAnalysis({
  formId,
  workspaceId,
  limit = ANALYSIS_ROW_LIMIT,
}: {
  formId: string;
  workspaceId: string;
  limit?: number;
}): Promise<AnalysisDataset | null> {
  const [form] = await db
    .select({
      id: forms.id,
      title: forms.title,
      draft: forms.definition,
      publishedVersionId: forms.publishedVersionId,
    })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .limit(1);

  if (!form) return null;

  let definition: FormDefinition = form.draft;
  if (form.publishedVersionId) {
    const [version] = await db
      .select({ definition: formVersions.definition })
      .from(formVersions)
      .where(eq(formVersions.id, form.publishedVersionId))
      .limit(1);
    if (version) definition = version.definition;
  }

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: responses.id,
        answers: responses.answers,
        completedAt: responses.completedAt,
      })
      .from(responses)
      .where(eq(responses.formId, form.id))
      .orderBy(desc(responses.createdAt))
      .limit(limit),
    db
      .select({ value: count() })
      .from(responses)
      .where(eq(responses.formId, form.id)),
  ]);

  const total = totals?.value ?? rows.length;

  return {
    formId: form.id,
    title: form.title,
    definition,
    rows: rows.map((row) => ({
      id: row.id,
      answers: row.answers as Record<string, AnswerValue>,
      completedAt: row.completedAt,
    })),
    loaded: rows.length,
    total,
    truncated: total > rows.length,
  };
}
