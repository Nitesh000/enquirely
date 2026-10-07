import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BuilderShell } from "@/components/builder/builder-shell";
import { requireWorkspace } from "@/lib/db/auth/session";
import { getFormForEdit } from "@/lib/db/forms/forms";

export const metadata: Metadata = { title: "Edit form" };

/**
 * The builder (`steps.md` M3.3). Scoped by workspace at the data layer
 * (`getFormForEdit`), not just by sitting under an authenticated layout ---
 * a form id from another workspace 404s here rather than leaking a draft.
 */
export default async function EditFormPage({
  params,
}: PageProps<"/forms/[id]/edit">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();

  const form = await getFormForEdit({ formId: id, workspaceId: workspace.id });
  if (!form) notFound();

  return (
    <BuilderShell
      formId={form.id}
      slug={form.slug}
      definition={form.definition}
      updatedAt={form.updatedAt.toISOString()}
      published={form.publishedVersionId !== null}
      acceptingResponses={form.acceptingResponses}
    />
  );
}
