import { SparklesIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { FormsGrid } from "@/components/dashboard/forms-grid";
import { NewFormButton } from "@/components/dashboard/new-form-button";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/db/auth/session";
import { listFormsForWorkspace } from "@/lib/db/forms/forms";
import { GenerateFormDialog } from "@/components/dashboard/generate-form-dialog";

export const metadata: Metadata = { title: "Forms" };

/** Forms list (`steps.md` M3.1) --- scoped by `workspace.id`, per `AGENTS.md`. */
export default async function FormsPage() {
  const { workspace } = await requireWorkspace();
  const forms = await listFormsForWorkspace(workspace.id);

  console.log(">> forms", forms);

  return (
    <>
      <PageHeader
        title="Forms"
        description="Everything you have built in this workspace."
        action={
          forms.length > 0 ? (
            <div className="flex gap-1">
              <NewFormButton />
              <GenerateFormDialog variant="brand" />
            </div>
          ) : undefined
        }
      />

      {forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center">
          <span className="bg-brand/10 text-brand inline-grid size-12 place-items-center rounded-2xl">
            <SparklesIcon className="size-6" />
          </span>

          <h2 className="mt-5 text-lg font-semibold tracking-tight">
            No forms yet
          </h2>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm text-pretty">
            Describe the survey you need and Enquirely will draft the questions,
            pick the right inputs and wire up the branching.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <GenerateFormDialog variant="brand" buttonStyle="long" />
            <NewFormButton variant="outline" />
          </div>

          <p className="text-muted-foreground mt-6 font-mono text-xs">
            AI generation lands with the rest of M6 &middot; see
            .agents/steps.md
          </p>
        </div>
      ) : (
        <FormsGrid initialForms={forms} />
      )}
    </>
  );
}
