"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { createDefaultBlock } from "@/lib/builder/default-block";
import type { BlockType } from "@/lib/forms/schema";
import { confirm } from "@/lib/ui/confirm-store";

import { AddBlockMenu } from "./add-block-menu";
import { useBuilderStore } from "./builder-context";
import { SortableBlockItem } from "./sortable-block-item";

/**
 * Left pane: the question list. Reorder via `dnd-kit`
 * (`steps.md` M3.5) --- pointer drag plus a keyboard sensor, so reordering
 * works for a keyboard-only user too, not just drag.
 */
export function BlockListPanel() {
  const blocks = useBuilderStore((s) => s.definition.blocks);
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId);
  const dispatch = useBuilderStore((s) => s.dispatch);
  const select = useBuilderStore((s) => s.select);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleAdd(type: BlockType) {
    const block = createDefaultBlock(type);
    dispatch([{ type: "add_block", block, index: blocks.length }]);
    select(block.id);
  }

  async function handleDelete(id: string) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;

    const confirmed = await confirm({
      title: `Delete "${block.title || "this question"}"?`,
      description:
        "Undo will bring it back. A published form keeps this question until you publish again.",
      confirmLabel: "Delete question",
      destructive: true,
    });
    if (!confirmed) return;

    // `dispatch` itself keeps `selectedBlockId` valid if this was the
    // selected block --- see `withValidSelection` in `lib/builder/store.ts`.
    dispatch([{ type: "delete_block", id }]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const toIndex = blocks.findIndex((b) => b.id === over.id);
    if (toIndex === -1) return;

    // Both `move_block` and `dnd-kit`'s own `arrayMove` do the same
    // splice-out-then-splice-in-at-`toIndex`, computed against the array
    // *before* removal --- so the raw index from `over` is correct as-is,
    // no off-by-one translation needed between the two.
    dispatch([{ type: "move_block", id: String(active.id), toIndex }]);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Questions
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {blocks.length}
        </span>
      </div>

      {blocks.length === 0 ? (
        <p className="px-0.5 text-xs text-muted-foreground">
          No questions yet --- add one below.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
              {blocks.map((block, index) => (
                <SortableBlockItem
                  key={block.id}
                  block={block}
                  index={index}
                  selected={block.id === selectedBlockId}
                  onSelect={() => select(block.id)}
                  onDelete={() => handleDelete(block.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddBlockMenu onAdd={handleAdd} />
    </div>
  );
}
