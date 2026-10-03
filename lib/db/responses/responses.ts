import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { forms, formVersions, responses } from "@/lib/db/schema";
import type { AnswerValue } from "@/lib/forms/answers";
import { getResponsePreview } from "@/lib/forms/format-answer";
import type { FormDefinition } from "@/lib/forms/schema";

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

export type ResponseListItem = {
  id: string;
  completedAt: Date | null;
  createdAt: Date;
  preview: string;
};

/**
 * Newest first (`steps.md` M5.2). Scoped by workspace via a cheap
 * existence check up front rather than joining `forms` on every page of
 * results --- once a `formId` is confirmed to belong to the workspace, it
 * cannot belong to a second one, so the paginated query itself only needs
 * to filter by `formId`.
 *
 * Each row is previewed against *its own* `form_versions.definition`, not
 * `forms.definition` --- a form republished between two responses means
 * two rows here can legitimately belong to different versions, each with
 * different block ids.
 */
export async function listResponsesForForm({
  formId,
  workspaceId,
  limit = RESPONSES_PAGE_SIZE,
  offset = 0,
}: {
  formId: string;
  workspaceId: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: ResponseListItem[]; total: number } | null> {
  const [form] = await db
    .select({ id: forms.id })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
    .limit(1);

  if (!form) return null;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: responses.id,
        completedAt: responses.completedAt,
        createdAt: responses.createdAt,
        answers: responses.answers,
        definition: formVersions.definition,
      })
      .from(responses)
      .innerJoin(formVersions, eq(formVersions.id, responses.formVersionId))
      .where(eq(responses.formId, formId))
      .orderBy(desc(responses.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(responses)
      .where(eq(responses.formId, formId)),
  ]);

  return {
    total: count,
    items: rows.map((row) => ({
      id: row.id,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      preview: getResponsePreview(
        row.definition,
        row.answers as ResponseAnswers,
      ),
    })),
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
