"use client";

import {
  BarChart3Icon,
  CopyIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FormListItem } from "@/lib/db/forms/forms";
import { formatRelativeTime } from "@/lib/utils/time";

export function FormsGrid({ initialForms }: { initialForms: FormListItem[] }) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);

  async function handleRename(form: FormListItem) {
    const title = window.prompt("Rename form", form.title)?.trim();
    if (!title || title === form.title) return;

    const response = await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      toast.error("Couldn't rename the form.");
      return;
    }

    setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, title } : f)));
  }

  async function handleDuplicate(form: FormListItem) {
    const response = await fetch(`/api/forms/${form.id}/duplicate`, {
      method: "POST",
    });

    if (!response.ok) {
      toast.error("Couldn't duplicate the form.");
      return;
    }

    const { id } = (await response.json()) as { id: string };
    router.push(`/forms/${id}/edit`);
  }

  async function handleDelete(form: FormListItem) {
    if (!window.confirm(`Delete "${form.title}"? This can't be undone.`)) return;

    const response = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Couldn't delete the form.");
      return;
    }

    setForms((prev) => prev.filter((f) => f.id !== form.id));
  }

  if (forms.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {forms.map((form) => (
        <Card key={form.id} className="group relative ring-1 ring-foreground/10">
          {/* Stretched link makes the whole card clickable; the menu button
              sits above it (relative z-10) so its own click isn't swallowed
              by the overlay --- the standard "card with an overlay action"
              pattern, since a <button> can't nest inside the <a> itself. */}
          <Link
            href={`/forms/${form.id}/edit`}
            className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`Edit ${form.title}`}
          />

          <div className="flex items-start justify-between gap-2 px-4">
            <div className="min-w-0">
              <h3 className="truncate font-heading text-sm font-semibold">
                {form.title}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {form.blockCount} {form.blockCount === 1 ? "question" : "questions"}
                {" · "}
                {formatRelativeTime(form.updatedAt)}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative z-10 shrink-0"
                  aria-label={`More actions for ${form.title}`}
                >
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => handleRename(form)}>
                  <PencilIcon />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleDuplicate(form)}>
                  <CopyIcon />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/forms/${form.id}/responses`} className="relative z-10">
                    <BarChart3Icon />
                    View responses
                    {form.responseCount > 0 ? (
                      <Badge variant="secondary" className="ml-auto">
                        {form.responseCount}
                      </Badge>
                    ) : null}
                  </Link>
                </DropdownMenuItem>
                {form.published ? (
                  <DropdownMenuItem asChild>
                    <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon />
                      View live
                    </a>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => handleDelete(form)}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 px-4 pt-3">
            <Badge variant={form.published ? "secondary" : "outline"}>
              {form.published ? "Published" : "Draft"}
            </Badge>
            {form.responseCount > 0 ? (
              <Link
                href={`/forms/${form.id}/responses`}
                className="relative z-10 text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:underline"
              >
                {form.responseCount}{" "}
                {form.responseCount === 1 ? "response" : "responses"}
              </Link>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
