"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CopyIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import { BlockRenderer } from "@/components/form/blocks";
import { Button } from "@/components/ui/button";
import { AddBlockMenu } from "./add-block-menu";
import { cloneBlockWithNewId, createDefaultBlock } from "@/lib/builder/default-block";
import type { BlockType, FormBlock } from "@/lib/forms/schema";

import { useBuilderStore } from "./builder-context";
import { useDebouncedField } from "./use-debounced-field";

/** No-ops for the two answer-collection callbacks every block expects --- the canvas edits structure, never collects a response. */
function noopChange() {}
function noopSubmit() {}

function EditableBlock({ block }: { block: FormBlock }) {
  const dispatch = useBuilderStore((s) => s.dispatch);

  const title = useDebouncedField(block.title, (next) =>
    dispatch([{ type: "update_block", id: block.id, changes: { title: next } }]),
  );
  const description = useDebouncedField(block.description ?? "", (next) =>
    dispatch([
      {
        type: "update_block",
        id: block.id,
        changes: { description: next || undefined },
      },
    ]),
  );

  // Every block component reads `title`/`description` straight off `block`
  // and forwards them to `QuestionShell`'s controlled input. Passing the
  // *committed* `block.title` there would mean each keystroke gets visually
  // reverted the instant the debounce hasn't committed yet --- a classic
  // controlled-input source mismatch. Feeding the live local value into the
  // block object fixes the display without touching `QuestionShell` or any
  // of the eight block components a second time.
  const liveBlock: FormBlock = {
    ...block,
    title: title.value,
    description: description.value || undefined,
  };

  return (
    <BlockRenderer
      key={block.id}
      block={liveBlock}
      value={undefined}
      onChange={noopChange}
      onSubmit={noopSubmit}
      onTitleChange={title.onChange}
      onDescriptionChange={description.onChange}
    />
  );
}

/**
 * Centre pane: the selected question, full size.
 *
 * Reuses `BlockRenderer` --- the exact component the respondent runtime
 * renders --- with an editing chrome wrapper around it, so what the creator
 * sees while typing a title *is* what a respondent will see
 * (`steps.md` M3.4). Only the title/description editing is wired up here;
 * everything else (required, options, type-specific settings) lives in the
 * right-hand settings panel.
 */
export function BuilderCanvas() {
  const blocks = useBuilderStore((s) => s.definition.blocks);
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId);
  const dispatch = useBuilderStore((s) => s.dispatch);
  const select = useBuilderStore((s) => s.select);

  const index = blocks.findIndex((b) => b.id === selectedBlockId);
  const block = index >= 0 ? blocks[index] : null;

  function handleAdd(type: BlockType) {
    const newBlock = createDefaultBlock(type);
    const at = index >= 0 ? index + 1 : blocks.length;
    dispatch([{ type: "add_block", block: newBlock, index: at }]);
    select(newBlock.id);
  }

  function handleDuplicate() {
    if (!block) return;
    const copy = cloneBlockWithNewId(block);
    dispatch([{ type: "add_block", block: copy, index: index + 1 }]);
    select(copy.id);
  }

  function handleDelete() {
    if (!block) return;
    if (!window.confirm(`Delete "${block.title || "this question"}"?`)) return;

    // `dispatch` keeps `selectedBlockId` valid on its own; see
    // `withValidSelection` in `lib/builder/store.ts`.
    dispatch([{ type: "delete_block", id: block.id }]);
  }

  if (!block) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-12 text-center">
        <span className="inline-grid place-items-center rounded-2xl size-12 bg-brand/10 text-brand">
          <SparklesIcon className="size-6" />
        </span>
        <div>
          <h3 className="font-heading text-base font-semibold">
            This form has no questions yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first question to start building.
          </p>
        </div>
        <AddBlockMenu
          onAdd={handleAdd}
          trigger={
            <Button variant="brand">Add your first question</Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-2">
        <p className="font-mono text-xs text-muted-foreground">
          Question {index + 1} of {blocks.length}
        </p>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={index <= 0}
            onClick={() => select(blocks[index - 1]?.id ?? null)}
            aria-label="Previous question"
          >
            <ArrowLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={index >= blocks.length - 1}
            onClick={() => select(blocks[index + 1]?.id ?? null)}
            aria-label="Next question"
          >
            <ArrowRightIcon />
          </Button>

          <div className="mx-1 h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDuplicate}
            aria-label="Duplicate question"
          >
            <CopyIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            aria-label="Delete question"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center rounded-2xl border bg-card px-6 py-10 sm:px-10">
        <div className="w-full max-w-xl">
          <EditableBlock block={block} />
        </div>
      </div>
    </div>
  );
}
