import { NextResponse } from "next/server";

import { duplicateForm } from "@/lib/db/forms/forms";
import { getSessionWorkspace } from "@/lib/db/auth/session";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/forms/[id]/duplicate">,
) {
  const auth = await getSessionWorkspace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const copy = await duplicateForm({ formId: id, workspaceId: auth.workspace.id });
  if (!copy) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json(copy, { status: 201 });
}
