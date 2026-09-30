import { PlusIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/db/auth/session";

export const metadata: Metadata = { title: "Forms" };

/**
 * Forms list.
 *
 * Currently the empty state only --- the `forms` table arrives in M2 and the
 * list itself in M3. When you add it, the query belongs in `lib/forms/queries.ts`
 * and must be scoped by `workspace.id`:
 *
 *   db.select().from(forms).where(eq(forms.workspaceId, workspace.id))
 */
export default async function FormsPage() {
  const { workspace } = await requireWorkspace();
  void workspace; // scope for the M3 query

  return (
    <>
      <PageHeader
        title="Forms"
        description="Everything you have built in this workspace."
        action={
          <Button variant="brand" disabled>
            <PlusIcon />
            New form
          </Button>
        }
      />

      <div className="flex flex-col justify-center items-center py-20 px-6 text-center rounded-2xl border border-dashed">
        <span className="inline-grid place-items-center rounded-2xl size-12 bg-brand/10 text-brand">
          <SparklesIcon className="size-6" />
        </span>

        <h2 className="mt-5 text-lg font-semibold tracking-tight">
          No forms yet
        </h2>
        <p className="mt-2 max-w-sm text-sm text-pretty text-muted-foreground">
          Describe the survey you need and Enquirely will draft the questions,
          pick the right inputs and wire up the branching.
        </p>

        <div className="flex flex-col gap-2 mt-6 sm:flex-row">
          <Button variant="brand" disabled>
            <SparklesIcon />
            Generate with AI
          </Button>
          <Button variant="outline" disabled>
            <PlusIcon />
            Start from scratch
          </Button>
        </div>

        <p className="mt-6 font-mono text-xs text-muted-foreground">
          Builder lands in M3 &middot; see .agents/steps.md
        </p>
      </div>
    </>
  );
}
