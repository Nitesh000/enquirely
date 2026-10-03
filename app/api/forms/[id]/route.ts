import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteForm, renameForm } from "@/lib/db/forms/forms";
import { getSessionWorkspace } from "@/lib/db/auth/session";

const bodySchema = z.object({ title: z.string().trim().min(1).max(200) });

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/forms/[id]">,
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

  const ok = await renameForm({
    formId: id,
    workspaceId: auth.workspace.id,
    title: parsed.data.title,
  });

  if (!ok) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/forms/[id]">,
) {
  const auth = await getSessionWorkspace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const ok = await deleteForm({ formId: id, workspaceId: auth.workspace.id });
  if (!ok) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
