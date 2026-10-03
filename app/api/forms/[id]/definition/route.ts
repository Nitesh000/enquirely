import { NextResponse } from "next/server";
import { z } from "zod";

import { updateFormDefinition } from "@/lib/db/forms/forms";
import { getSessionWorkspace } from "@/lib/db/auth/session";
import { formDefinitionSchema } from "@/lib/forms/schema";

/**
 * Autosave (`steps.md` M3.7). Structural validity (`formDefinitionSchema`)
 * is enforced on every save; the stricter cross-reference checks
 * (`validateDefinition` --- unreachable blocks, dangling logic targets) are
 * deliberately deferred to publish, not required here --- a draft is allowed
 * to be in a temporarily broken state while the creator is mid-edit.
 */
const bodySchema = z.object({
  definition: formDefinitionSchema,
  expectedUpdatedAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
});

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/forms/[id]/definition">,
) {
  const auth = await getSessionWorkspace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateFormDefinition({
    formId: id,
    workspaceId: auth.workspace.id,
    definition: parsed.data.definition,
    expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt),
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "This form changed elsewhere. Reload to continue.",
        updatedAt: result.updatedAt,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ updatedAt: result.updatedAt });
}
