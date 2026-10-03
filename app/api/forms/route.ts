import { NextResponse } from "next/server";
import { z } from "zod";

import { createForm } from "@/lib/db/forms/forms";
import { getSessionWorkspace } from "@/lib/db/auth/session";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200).default("Untitled form"),
});

/** Creates an empty draft and hands back its id --- the forms list redirects straight into `/forms/[id]/edit`. */
export async function POST(request: Request) {
  const auth = await getSessionWorkspace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    // No body is fine --- "New form" has nothing to send yet.
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const form = await createForm({
    workspaceId: auth.workspace.id,
    title: parsed.data.title,
  });

  return NextResponse.json(form, { status: 201 });
}
