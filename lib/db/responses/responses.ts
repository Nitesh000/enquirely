import "server-only";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { forms, formVersions, responses } from "@/lib/db/schema";
import type { AnswerValue } from "@/lib/forms/answers";
import { formatAnswerValue } from "@/lib/forms/format-answer";
import type { FormBlock, FormDefinition } from "@/lib/forms/schema";

export type ResponseAnswers = Record<string, AnswerValue>;

const RESPONSES_PAGE_SIZE = 50;

/**
 * Creates the response row as soon as the first answer arrives, rather than
 * at submit time (`steps.md` M2.12). A row that exists but has no
 * `completed_at` *is* the drop-off signal M5 needs --- if rows were only
 * written on completion, every abandoned form would be invisible.
 */
export async function createResponse({
  formId,
  formVersionId,
  answers,
  metadata,
}: {
  formId: string;
  formVersionId: string;
  answers: ResponseAnswers;
  metadata?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(responses)
    .values({ formId, formVersionId, answers, metadata })
    .returning({ id: responses.id });

  return row;
}

/**
 * Updates an in-progress response.
 *
 * Scoped by `formId` *and* `formVersionId` so a response id harvested from
 * one form cannot be used to write into another, and refuses rows that are
 * already complete so a finished submission cannot be rewritten. Respondents
 * are anonymous, so this is bounds-checking rather than authentication ---
 * see the note in the route handler.
 */
export async function updateResponse({
  responseId,
  formId,
  formVersionId,
  answers,
  completed,
}: {
  responseId: string;
  formId: string;
  formVersionId: string;
  answers: ResponseAnswers;
  completed: boolean;
}) {
  const [row] = await db
    .update(responses)
    .set({
      answers,
      ...(completed ? { completedAt: new Date() } : {}),
    })
    .where(
      and(
        eq(responses.id, responseId),
        eq(responses.formId, formId),
        eq(responses.formVersionId, formVersionId),
        isNull(responses.completedAt),
      ),
    )
    .returning({ id: responses.id });

  return row ?? null;
}

export type ResponseTableColumn = {
  blockId: string;
  title: string;
  type: FormBlock["type"];
};

export type ResponseRow = {
  id: string;
  completedAt: Date | null;
  createdAt: Date;
  /** Column `blockId` -> the formatted answer. `""` means unanswered. */
  cells: Record<string, string>;
};

/** Non-question columns the table can be sorted by. */
export const SORT_SUBMITTED = "submitted";
export const SORT_STATUS = "status";

export type ResponseStatusFilter = "all" | "completed" | "partial";

/**
 * Ordering expression for a question column.
 *
 * Sorting happens in SQL, not after fetching, so it orders the whole result
 * set rather than just the page currently on screen --- the difference
 * between a sort and a decoration.
 *
 * `${block.id}` interpolates as a bind parameter, not as SQL text; the
 * caller additionally checks the requested column against the known block
 * ids, so an unknown key can never reach here.
 */
function answerOrderExpression(block: FormBlock) {
  if (block.type === "number" || block.type === "rating") {
    // `->>` yields text, and text ordering puts "10" before "9".
    return sql`nullif(${responses.answers} ->> ${block.id}, '')::numeric`;
  }

  if (block.type === "single_choice") {
    // Order by the label the table actually displays, not the stored option
    // id --- otherwise the visible order and the sort quietly disagree.
    const whens = block.singleChoice.options.map(
      (option) => sql`when ${option.id} then ${option.label}`,
    );

    return sql`case ${responses.answers} ->> ${block.id} ${sql.join(
      whens,
      sql` `,
    )} else ${responses.answers} ->> ${block.id} end`;
  }

  return sql`lower(${responses.answers} ->> ${block.id})`;
}

/**
 * The response table (`steps.md` M5.2): one row per response, one column
 * per question, sorted and filtered in SQL.
 *
 * **Columns come from one definition --- the published version's.**
 * Responses individually reference the version they answered, and those
 * can differ, but a table needs a single stable column set. Answers to
 * blocks that version doesn't contain are not shown here; the detail page
 * renders each response against its own version and does show them.
 *
 * Scoped by workspace via a cheap existence check up front rather than
 * joining `forms` on every page of results --- once a `formId` is confirmed
 * to belong to the workspace it cannot belong to a second one.
 */
export async function listResponsesTable({
  formId,
  workspaceId,
  limit = RESPONSES_PAGE_SIZE,
  offset = 0,
  sort = SORT_SUBMITTED,
  direction = "desc",
  status = "all",
  search,
}: {
  formId: string;
  workspaceId: string;
  limit?: number;
  offset?: number;
  sort?: string;
  direction?: "asc" | "desc";
  status?: ResponseStatusFilter;
  search?: string;
}): Promise<{
  columns: ResponseTableColumn[];
  rows: ResponseRow[];
  /** Matching the active filters --- drives pagination. */
  total: number;
  /** Ignoring filters, so the UI can say "3 of 12". */
  totalUnfiltered: number;
} | null> {
  const [form] = await db
    .select({
      id: forms.id,
      draft: forms.definition,
      publishedVersionId: forms.publishedVersionId,
    })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .limit(1);

  if (!form) return null;

  let columnDefinition: FormDefinition = form.draft;
  if (form.publishedVersionId) {
    const [version] = await db
      .select({ definition: formVersions.definition })
      .from(formVersions)
      .where(eq(formVersions.id, form.publishedVersionId))
      .limit(1);
    if (version) columnDefinition = version.definition;
  }

  const blocks = columnDefinition.blocks;
  const blocksById = new Map(blocks.map((block) => [block.id, block]));

  const statusCondition =
    status === "completed"
      ? isNotNull(responses.completedAt)
      : status === "partial"
        ? isNull(responses.completedAt)
        : undefined;

  // Substring match over the stored answers. Not the GIN-indexed full-text
  // search of `steps.md` M5.4 --- it matches raw stored values, so it finds
  // any typed answer but matches choice blocks on their option *id* rather
  // than the label shown in the cell.
  const searchCondition = search?.trim()
    ? sql`${responses.answers}::text ilike ${`%${search.trim()}%`}`
    : undefined;

  const where = and(
    eq(responses.formId, formId),
    statusCondition,
    searchCondition,
  );

  const sortDirection = direction === "asc" ? sql`asc` : sql`desc`;
  const sortBlock = blocksById.get(sort);

  // `nulls last` in both directions: an unanswered question belongs at the
  // bottom whichever way the column is sorted, not floating to the top of a
  // descending sort the way Postgres would default to.
  const orderBy = sortBlock
    ? sql`${answerOrderExpression(sortBlock)} ${sortDirection} nulls last`
    : sort === SORT_STATUS
      ? sql`(${responses.completedAt} is null) ${sortDirection}`
      : sql`${responses.createdAt} ${sortDirection}`;

  const [rows, [{ count }], [{ count: countAll }]] = await Promise.all([
    db
      .select({
        id: responses.id,
        completedAt: responses.completedAt,
        createdAt: responses.createdAt,
        answers: responses.answers,
      })
      .from(responses)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(responses)
      .where(where),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(responses)
      .where(eq(responses.formId, formId)),
  ]);

  return {
    total: count,
    totalUnfiltered: countAll,
    columns: blocks.map((block) => ({
      blockId: block.id,
      title: block.title,
      type: block.type,
    })),
    rows: rows.map((row) => {
      const answers = row.answers as ResponseAnswers;
      const cells: Record<string, string> = {};

      for (const block of blocks) {
        cells[block.id] = formatAnswerValue(block, answers[block.id]);
      }

      return {
        id: row.id,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
        cells,
      };
    }),
  };
}

export type ResponseDetail = {
  id: string;
  completedAt: Date | null;
  createdAt: Date;
  definition: FormDefinition;
  answers: ResponseAnswers;
};

/**
 * A single response, scoped by workspace through a join to `forms` ---
 * `responses` carries no `workspace_id` of its own, so the join itself is
 * the authorization check, not an afterthought on top of it.
 */
export async function getResponseById({
  responseId,
  formId,
  workspaceId,
}: {
  responseId: string;
  formId: string;
  workspaceId: string;
}): Promise<ResponseDetail | null> {
  const [row] = await db
    .select({
      id: responses.id,
      completedAt: responses.completedAt,
      createdAt: responses.createdAt,
      answers: responses.answers,
      definition: formVersions.definition,
    })
    .from(responses)
    .innerJoin(forms, eq(forms.id, responses.formId))
    .innerJoin(formVersions, eq(formVersions.id, responses.formVersionId))
    .where(
      and(
        eq(responses.id, responseId),
        eq(responses.formId, formId),
        eq(forms.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    definition: row.definition,
    answers: row.answers as ResponseAnswers,
  };
}
