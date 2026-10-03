import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/db/auth/session";
import { getResponseById } from "@/lib/db/responses/responses";
import { formatAnswerValue } from "@/lib/forms/format-answer";

export const metadata: Metadata = { title: "Response" };

/**
 * One response, all answers in block order (`steps.md` M5.3).
 *
 * Renders against `form_versions.definition` --- the exact questions this
 * respondent was actually shown --- never `forms.definition`, which may
 * since have been edited into something this response never answered.
 */
export default async function ResponseDetailPage({
  params,
}: PageProps<"/forms/[id]/responses/[responseId]">) {
  const { id, responseId } = await params;
  const { workspace } = await requireWorkspace();

  const response = await getResponseById({
    responseId,
    formId: id,
    workspaceId: workspace.id,
  });
  if (!response) notFound();

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
        <Link href={`/forms/${id}/responses`}>
          <ArrowLeftIcon />
          Back to responses
        </Link>
      </Button>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {response.definition.title}
        </h1>
        <Badge variant={response.completedAt ? "secondary" : "outline"}>
          {response.completedAt ? "Completed" : "Partial"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {response.createdAt.toLocaleString()}
        </span>
      </div>

      <div className="flex flex-col gap-6 max-w-2xl">
        {response.definition.blocks.map((block) => {
          const value = response.answers[block.id];
          const text = formatAnswerValue(block, value);

          return (
            <div key={block.id} className="border-b pb-5 last:border-b-0">
              <p className="text-sm font-medium text-muted-foreground">
                {block.title}
              </p>
              {text ? (
                <p className="mt-1.5 text-base whitespace-pre-wrap">{text}</p>
              ) : (
                <p className="mt-1.5 text-base text-muted-foreground/60 italic">
                  Not answered
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
