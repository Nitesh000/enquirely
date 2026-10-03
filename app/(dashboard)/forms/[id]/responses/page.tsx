import { ArrowLeftIcon, InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/db/auth/session";
import { getFormForEdit } from "@/lib/db/forms/forms";
import { listResponsesForForm } from "@/lib/db/responses/responses";
import { formatRelativeTime } from "@/lib/utils/time";

export const metadata: Metadata = { title: "Responses" };

const PAGE_SIZE = 50;

/** Response list (`steps.md` M5.2) --- scoped by workspace, newest first. */
export default async function ResponsesPage({
  params,
  searchParams,
}: PageProps<"/forms/[id]/responses">) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { workspace } = await requireWorkspace();

  const form = await getFormForEdit({ formId: id, workspaceId: workspace.id });
  if (!form) notFound();

  const result = await listResponsesForForm({
    formId: id,
    workspaceId: workspace.id,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  if (!result) notFound();

  const { items, total } = result;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
        <Link href={`/forms/${id}/edit`}>
          <ArrowLeftIcon />
          Back to {form.title}
        </Link>
      </Button>

      <PageHeader
        title="Responses"
        description={`${total} ${total === 1 ? "response" : "responses"} to ${form.title}`}
      />

      {items.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-20 px-6 text-center rounded-2xl border border-dashed">
          <span className="inline-grid place-items-center rounded-2xl size-12 bg-brand/10 text-brand">
            <InboxIcon className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold tracking-tight">
            No responses yet
          </h2>
          <p className="mt-2 max-w-sm text-sm text-pretty text-muted-foreground">
            {form.publishedVersionId
              ? "Share the form's link to start collecting answers."
              : "Publish the form to start collecting answers."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/forms/${id}/responses/${item.id}`}
              className="flex items-center gap-4 border-b bg-card px-4 py-3 text-sm outline-none transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50"
            >
              <Badge
                variant={item.completedAt ? "secondary" : "outline"}
                className="shrink-0"
              >
                {item.completedAt ? "Completed" : "Partial"}
              </Badge>
              <span className="min-w-0 flex-1 truncate">{item.preview}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(item.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? (
              <Link href={`/forms/${id}/responses?page=${page - 1}`}>
                Previous
              </Link>
            ) : (
              <span>Previous</span>
            )}
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={`/forms/${id}/responses?page=${page + 1}`}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </div>
      ) : null}
    </>
  );
}
