import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublishedFormBySlug } from "@/lib/db/forms/forms";
import {
  createResponse,
  updateResponse,
  type ResponseAnswers,
} from "@/lib/db/responses/responses";
import { answerSchemaForBlock, answerValueSchema } from "@/lib/forms/answers";

/**
 * Respondent submission endpoint (`steps.md` M2.10).
 *
 * Everything here re-validates against the **published version's**
 * definition, never `forms.definition` --- the creator may have edited the
 * draft since this respondent loaded the page, and an answer must be judged
 * against the form that was actually asked.
 *
 * The client's validation is a courtesy; this is the authority. Both run the
 * same `answerSchemaForBlock`, which is the entire reason that function
 * exists in `lib/` instead of in a component.
 */
const respondBodySchema = z.object({
  /** Absent on the first call; the response row is created and its id returned. */
  responseId: z.uuid().optional(),
  answers: z.record(z.string(), answerValueSchema),
  completed: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/f/[slug]/respond">,
) {
  const { slug } = await params;

  const form = await getPublishedFormBySlug(slug);
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = respondBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 },
    );
  }

  const { responseId, answers, completed } = parsedBody.data;
  const blocksById = new Map(
    form.definition.blocks.map((block) => [block.id, block]),
  );

  // Reject unknown block ids outright rather than silently dropping them ---
  // a payload referencing a block this version does not have means the client
  // is out of date or forged, and either way the data would be unattributable.
  const fieldErrors: Record<string, string> = {};
  for (const [blockId, value] of Object.entries(answers)) {
    const block = blocksById.get(blockId);
    if (!block) {
      return NextResponse.json(
        { error: `Unknown block id: ${blockId}` },
        { status: 400 },
      );
    }

    const result = answerSchemaForBlock(block).safeParse(value);
    if (!result.success) {
      fieldErrors[blockId] = result.error.issues[0]?.message ?? "Invalid answer";
    }
  }

  // Only a completed submission has to satisfy every block. Partial saves are
  // expected to be incomplete --- that is what makes them partial.
  if (completed) {
    for (const block of form.definition.blocks) {
      if (blocksById.has(block.id) && fieldErrors[block.id]) continue;

      const result = answerSchemaForBlock(block).safeParse(answers[block.id]);
      if (!result.success) {
        fieldErrors[block.id] =
          result.error.issues[0]?.message ?? "Invalid answer";
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors },
      { status: 422 },
    );
  }

  const typedAnswers = answers as ResponseAnswers;

  if (!responseId) {
    const created = await createResponse({
      formId: form.formId,
      formVersionId: form.versionId,
      answers: typedAnswers,
    });

    if (completed) {
      await updateResponse({
        responseId: created.id,
        formId: form.formId,
        formVersionId: form.versionId,
        answers: typedAnswers,
        completed: true,
      });
    }

    return NextResponse.json({ responseId: created.id }, { status: 201 });
  }

  const updated = await updateResponse({
    responseId,
    formId: form.formId,
    formVersionId: form.versionId,
    answers: typedAnswers,
    completed,
  });

  if (!updated) {
    // Either the id does not belong to this form/version, or the response was
    // already completed. Both are 409, not 404: the caller sent something
    // syntactically fine that conflicts with server state.
    return NextResponse.json(
      { error: "Response is not open for updates" },
      { status: 409 },
    );
  }

  return NextResponse.json({ responseId: updated.id });
}
