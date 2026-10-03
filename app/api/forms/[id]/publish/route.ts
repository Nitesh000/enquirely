import { NextResponse } from "next/server";

import { publishForm } from "@/lib/db/forms/forms";
import { getSessionWorkspace } from "@/lib/db/auth/session";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/forms/[id]/publish">,
) {
  const auth = await getSessionWorkspace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await publishForm({ formId: id, workspaceId: auth.workspace.id });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Form is not valid", issues: result.issues },
      { status: 422 },
    );
  }

  return NextResponse.json(
    { versionId: result.versionId, versionNumber: result.versionNumber },
    { status: 201 },
  );
}
