import { createStore } from "zustand/vanilla";

import { applyOperations, type FormOperation } from "@/lib/forms/operations";
import type { FormDefinition } from "@/lib/forms/schema";

/**
 * Builder state: the draft definition, an undo/redo stack, and dirty state
 * (`steps.md` M3.2). Every edit --- manual or AI --- is a list of
 * `FormOperation`s run through `applyOperations`; this file never mutates
 * `definition` any other way (`steps.md` §1's "one architectural bet").
 *
 * `zustand/vanilla`, not `zustand`'s React `create()`: this is `lib/`, which
 * stays React-free. The hook binding lives in
 * `components/builder/builder-context.tsx`.
 */
export type BuilderState = {
  definition: FormDefinition;
  selectedBlockId: string | null;
  /** Diverged from the last successful save. */
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: (ops: FormOperation[]) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  /** Called once an autosave round-trip succeeds. */
  markSaved: () => void;
};

export type BuilderStore = ReturnType<typeof createBuilderStore>;

export function createBuilderStore(initial: FormDefinition) {
  /**
   * Snapshots, not inverse operations.
   *
   * `steps.md` §M3.2 says "push inverse onto undo" --- this pushes the whole
   * previous `FormDefinition` instead. Deriving a correct inverse for every
   * operation needs the same pre-image data a snapshot already has (undoing
   * `delete_block` needs the deleted block; undoing `move_block` needs the
   * original index), so a snapshot is no less correct and meaningfully
   * simpler. A form's definition is small JSON; holding a short history of
   * them costs nothing worth optimising away.
   *
   * Lives outside the reactive `set()` state on purpose: history is
   * replay-only, never rendered directly, so there's nothing to gain by
   * putting it through Zustand's subscription machinery. `canUndo`/`canRedo`
   * are the booleans components actually subscribe to.
   */
  const history: { past: FormDefinition[]; future: FormDefinition[] } = {
    past: [],
    future: [],
  };

  /**
   * `selectedBlockId` pointing at a block that no longer exists is a real
   * failure mode, not a hypothetical one: undo doesn't just change
   * `definition`, it can resurrect a block without anything re-selecting
   * it, leaving the canvas on its empty state while the list shows one
   * question. Re-validated after every state change --- `dispatch`,
   * `undo`, and `redo` alike --- rather than trusting each call site (a
   * future AI-driven dispatch deleting the selected block would hit the
   * exact same gap) to remember to fix it up itself.
   */
  function withValidSelection(
    definition: FormDefinition,
    selectedBlockId: string | null,
  ): string | null {
    if (selectedBlockId && definition.blocks.some((b) => b.id === selectedBlockId)) {
      return selectedBlockId;
    }
    return definition.blocks[0]?.id ?? null;
  }

  return createStore<BuilderState>()((set, get) => ({
    definition: initial,
    selectedBlockId: initial.blocks[0]?.id ?? null,
    dirty: false,
    canUndo: false,
    canRedo: false,

    dispatch: (ops) => {
      if (ops.length === 0) return;

      const { definition, selectedBlockId } = get();
      history.past.push(definition);
      history.future = [];

      const nextDefinition = applyOperations(definition, ops);

      set({
        definition: nextDefinition,
        selectedBlockId: withValidSelection(nextDefinition, selectedBlockId),
        dirty: true,
        canUndo: true,
        canRedo: false,
      });
    },

    select: (id) => set({ selectedBlockId: id }),

    undo: () => {
      if (history.past.length === 0) return;

      const { definition, selectedBlockId } = get();
      history.future.push(definition);
      const previous = history.past.pop() as FormDefinition;

      set({
        definition: previous,
        selectedBlockId: withValidSelection(previous, selectedBlockId),
        dirty: true,
        canUndo: history.past.length > 0,
        canRedo: true,
      });
    },

    redo: () => {
      if (history.future.length === 0) return;

      const { definition, selectedBlockId } = get();
      history.past.push(definition);
      const next = history.future.pop() as FormDefinition;

      set({
        definition: next,
        selectedBlockId: withValidSelection(next, selectedBlockId),
        dirty: true,
        canUndo: true,
        canRedo: history.future.length > 0,
      });
    },

    markSaved: () => set({ dirty: false }),
  }));
}
