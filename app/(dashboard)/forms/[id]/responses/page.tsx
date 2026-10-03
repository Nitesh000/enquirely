import {
  ArrowLeftIcon,
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InboxIcon,
  SearchIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireWorkspace } from "@/lib/db/auth/session";
import { getFormForEdit } from "@/lib/db/forms/forms";
import {
  listResponsesTable,
  SORT_STATUS,
  SORT_SUBMITTED,
  type ResponseStatusFilter,
} from "@/lib/db/responses/responses";
import { cn } from "@/lib/utils/utils";
import { formatRelativeTime } from "@/lib/utils/time";

export const metadata: Metadata = { title: "Responses" };

const PAGE_SIZE = 50;

const STATUS_FILTERS: { value: ResponseStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
];

type Query = {
  page: number;
  sort: string;
  direction: "asc" | "desc";
  status: ResponseStatusFilter;
  q: string;
};

/** Current query with `overrides` applied, as a query string --- so changing the sort keeps the filter, and vice versa. */
function buildHref(formId: string, query: Query, overrides: Partial<Query>) {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (next.page > 1) params.set("page", String(next.page));
  if (next.sort !== SORT_SUBMITTED) params.set("sort", next.sort);
  if (next.direction !== "desc") params.set("dir", next.direction);
  if (next.status !== "all") params.set("status", next.status);
  if (next.q) params.set("q", next.q);

  const search = params.toString();
  return `/forms/${formId}/responses${search ? `?${search}` : ""}`;
}

function SortHeader({
  formId,
  query,
  column,
  label,
  className,
}: {
  formId: string;
  query: Query;
  column: string;
  label: string;
  className?: string;
}) {
  const active = query.sort === column;
  // A fresh column starts ascending; the active one flips. Sorting always
  // resets to page 1 --- page 4 of the old order is meaningless in the new.
  const direction = active && query.direction === "asc" ? "desc" : "asc";

  return (
    <th scope="col" className={cn("px-3 py-2 text-left font-medium", className)}>
      <Link
        href={buildHref(formId, query, { sort: column, direction, page: 1 })}
        className={cn(
          "inline-flex items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        {active ? (
          query.direction === "asc" ? (
            <ChevronUpIcon className="size-3 shrink-0" />
          ) : (
            <ChevronDownIcon className="size-3 shrink-0" />
          )
        ) : (
          <ArrowUpDownIcon className="size-3 shrink-0 opacity-40" />
        )}
      </Link>
    </th>
  );
}

/** Response table (`steps.md` M5.2) --- workspace-scoped, sorted and filtered in SQL. */
export default async function ResponsesPage({
  params,
  searchParams,
}: PageProps<"/forms/[id]/responses">) {
  const { id } = await params;
  const resolved = await searchParams;

  const statusParam = String(resolved.status ?? "all");
  const query: Query = {
    page: Math.max(1, Number(resolved.page) || 1),
    sort: String(resolved.sort ?? SORT_SUBMITTED),
    direction: resolved.dir === "asc" ? "asc" : "desc",
    status: STATUS_FILTERS.some((f) => f.value === statusParam)
      ? (statusParam as ResponseStatusFilter)
      : "all",
    q: String(resolved.q ?? ""),
  };

  const { workspace } = await requireWorkspace();

  const form = await getFormForEdit({ formId: id, workspaceId: workspace.id });
  if (!form) notFound();

  const result = await listResponsesTable({
    formId: id,
    workspaceId: workspace.id,
    limit: PAGE_SIZE,
    offset: (query.page - 1) * PAGE_SIZE,
    sort: query.sort,
    direction: query.direction,
    status: query.status,
    search: query.q,
  });
  if (!result) notFound();

  const { columns, rows, total, totalUnfiltered } = result;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = query.status !== "all" || query.q !== "";

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
        description={
          filtered
            ? `${total} of ${totalUnfiltered} ${totalUnfiltered === 1 ? "response" : "responses"} to ${form.title}`
            : `${totalUnfiltered} ${totalUnfiltered === 1 ? "response" : "responses"} to ${form.title}`
        }
      />

      {totalUnfiltered === 0 ? (
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
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
              {STATUS_FILTERS.map((filter) => (
                <Link
                  key={filter.value}
                  href={buildHref(id, query, { status: filter.value, page: 1 })}
                  aria-current={query.status === filter.value ? "true" : undefined}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    query.status === filter.value
                      ? "bg-background font-medium text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                </Link>
              ))}
            </div>

            {/* A plain GET form: searching is a navigation, so it needs no
                client JS and the result stays linkable and refreshable. */}
            <form action={`/forms/${id}/responses`} className="flex items-center gap-2">
              {query.status !== "all" ? (
                <input type="hidden" name="status" value={query.status} />
              ) : null}
              {query.sort !== SORT_SUBMITTED ? (
                <input type="hidden" name="sort" value={query.sort} />
              ) : null}
              {query.direction !== "desc" ? (
                <input type="hidden" name="dir" value={query.direction} />
              ) : null}

              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  name="q"
                  defaultValue={query.q}
                  placeholder="Search answers"
                  className="w-56 pl-8"
                />
              </div>
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>

            {filtered ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/forms/${id}/responses`}>Clear</Link>
              </Button>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              No responses match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr className="border-b">
                    <SortHeader
                      formId={id}
                      query={query}
                      column={SORT_STATUS}
                      label="Status"
                      className="w-28"
                    />
                    <SortHeader
                      formId={id}
                      query={query}
                      column={SORT_SUBMITTED}
                      label="Submitted"
                      className="w-32"
                    />
                    {columns.map((column) => (
                      <SortHeader
                        key={column.blockId}
                        formId={id}
                        query={query}
                        column={column.blockId}
                        label={column.title}
                        className="min-w-48 max-w-64"
                      />
                    ))}
                    <th scope="col" className="w-16 px-3 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b bg-card last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={row.completedAt ? "secondary" : "outline"}
                        >
                          {row.completedAt ? "Completed" : "Partial"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                        {formatRelativeTime(row.createdAt)}
                      </td>
                      {columns.map((column) => (
                        <td
                          key={column.blockId}
                          className="max-w-64 truncate px-3 py-2.5"
                          title={row.cells[column.blockId] || undefined}
                        >
                          {row.cells[column.blockId] || (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/forms/${id}/responses/${row.id}`}
                          className="rounded-md text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={query.page <= 1}
                asChild={query.page > 1}
              >
                {query.page > 1 ? (
                  <Link href={buildHref(id, query, { page: query.page - 1 })}>
                    Previous
                  </Link>
                ) : (
                  <span>Previous</span>
                )}
              </Button>
              <span className="font-mono text-xs text-muted-foreground">
                Page {query.page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={query.page >= totalPages}
                asChild={query.page < totalPages}
              >
                {query.page < totalPages ? (
                  <Link href={buildHref(id, query, { page: query.page + 1 })}>
                    Next
                  </Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
