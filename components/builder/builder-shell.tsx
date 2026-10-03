"use client";

import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  Redo2Icon,
  RocketIcon,
  Undo2Icon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { FormDefinition } from "@/lib/forms/schema";

import { BlockListPanel } from "./block-list-panel";
import { BuilderCanvas } from "./builder-canvas";
import { BuilderStoreProvider, useBuilderStore } from "./builder-context";
import { SaveStatusIndicator } from "./save-status";
import { SettingsPanel } from "./settings-panel";
import { useAutosave } from "./use-autosave";
import { useDebouncedField } from "./use-debounced-field";

function TitleField() {
  const title = useBuilderStore((s) => s.definition.title);
  const dispatch = useBuilderStore((s) => s.dispatch);

  const field = useDebouncedField(title, (next) =>
    dispatch([{ type: "update_form", changes: { title: next || "Untitled form" } }]),
  );

  return (
    <input
      value={field.value}
      onChange={(event) => field.onChange(event.target.value)}
      onBlur={field.flush}
      placeholder="Untitled form"
      className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-1 font-heading text-sm font-medium outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
}

function UndoRedoButtons() {
  const canUndo = useBuilderStore((s) => s.canUndo);
  const canRedo = useBuilderStore((s) => s.canRedo);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);

  // Cmd+Z / Cmd+Shift+Z (`steps.md` M3.8). Ctrl on non-Mac, same handler.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "z") return;

      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!canUndo}
        onClick={undo}
        aria-label="Undo"
      >
        <Undo2Icon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!canRedo}
        onClick={redo}
        aria-label="Redo"
      >
        <Redo2Icon />
      </Button>
    </div>
  );
}

function PublishButton({
  formId,
  slug,
  published,
  onPublished,
  flush,
}: {
  formId: string;
  slug: string;
  published: boolean;
  onPublished: () => void;
  flush: () => Promise<void>;
}) {
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    setPublishing(true);
    try {
      await flush(); // make sure the very latest edit is saved first

      const response = await fetch(`/api/forms/${formId}/publish`, {
        method: "POST",
      });
      const data = (await response.json()) as
        | { versionNumber: number }
        | { error: string; issues?: string[] };

      if (!response.ok) {
        const issues = "issues" in data ? data.issues : undefined;
        toast.error(
          issues && issues.length > 0
            ? `Can't publish: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}`
            : ("error" in data && data.error) || "Publish failed",
        );
        return;
      }

      toast.success(
        `Published${"versionNumber" in data ? ` (v${data.versionNumber})` : ""}`,
      );
      onPublished();
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {published ? (
        <Button variant="ghost" size="sm" asChild>
          <a href={`/f/${slug}`} target="_blank" rel="noreferrer">
            <ExternalLinkIcon />
            View live
          </a>
        </Button>
      ) : null}
      <Button variant="brand" size="sm" disabled={publishing} onClick={handlePublish}>
        <RocketIcon />
        {publishing ? "Publishing…" : published ? "Publish changes" : "Publish"}
      </Button>
    </div>
  );
}

function BuilderLayout({
  formId,
  slug,
  initialUpdatedAt,
  initialPublished,
}: {
  formId: string;
  slug: string;
  initialUpdatedAt: string;
  initialPublished: boolean;
}) {
  const { status, flush } = useAutosave(formId, initialUpdatedAt);
  const [published, setPublished] = useState(initialPublished);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/forms" aria-label="Back to forms">
            <ArrowLeftIcon />
          </Link>
        </Button>

        <TitleField />
        <SaveStatusIndicator status={status} />

        <div className="ml-auto flex items-center gap-3">
          <UndoRedoButtons />
          <div className="h-5 w-px bg-border" />
          <PublishButton
            formId={formId}
            slug={slug}
            published={published}
            onPublished={() => setPublished(true)}
            flush={flush}
          />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-border lg:grid-cols-[240px_1fr_280px]">
        <div className="overflow-y-auto bg-background p-3">
          <BlockListPanel />
        </div>
        <div className="overflow-y-auto bg-muted/30 p-6">
          <BuilderCanvas />
        </div>
        <div className="overflow-y-auto bg-background p-4">
          <SettingsPanel />
        </div>
      </div>
    </div>
  );
}

export function BuilderShell(props: {
  formId: string;
  slug: string;
  definition: FormDefinition;
  updatedAt: string;
  published: boolean;
}) {
  return (
    <BuilderStoreProvider definition={props.definition}>
      <BuilderLayout
        formId={props.formId}
        slug={props.slug}
        initialUpdatedAt={props.updatedAt}
        initialPublished={props.published}
      />
    </BuilderStoreProvider>
  );
}
