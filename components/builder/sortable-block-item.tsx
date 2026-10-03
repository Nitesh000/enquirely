"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, Trash2Icon } from "lucide-react";

import { cn } from "@/lib/utils/utils";
import type { FormBlock } from "@/lib/forms/schema";

import { BLOCK_TYPE_ICONS } from "./block-meta";

export function SortableBlockItem({
  block,
  index,
  selected,
  onSelect,
  onDelete,
}: {
  block: FormBlock;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const Icon = BLOCK_TYPE_ICONS[block.type];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 rounded-lg border bg-background pr-1.5",
        selected ? "border-brand/40 ring-1 ring-brand/20" : "border-transparent",
        isDragging && "z-10 opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={`Reorder "${block.title || "Untitled question"}"`}
        className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/50 outline-none hover:text-muted-foreground focus-visible:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          selected
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="w-4 shrink-0 font-mono text-[11px] text-muted-foreground/60">
          {index + 1}
        </span>
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{block.title || "Untitled question"}</span>
      </button>

      <button
        type="button"
        aria-label={`Delete "${block.title || "Untitled question"}"`}
        onClick={onDelete}
        className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 group-hover:flex"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}
