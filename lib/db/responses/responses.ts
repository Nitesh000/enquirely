import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { responses } from "@/lib/db/schema";
import type { AnswerValue } from "@/lib/forms/answers";

export type ResponseAnswers = Record<string, AnswerValue>;

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
