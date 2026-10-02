import type { AnswerValue } from "./answers";
import type { FormDefinition } from "./schema";

/**
 * Pure navigation state for the respondent runtime. `visited` (not index
 * arithmetic) drives `back()`, so branching `back()` keeps working once
 * M4 adds jumps --- "previous block" stops being "current index - 1" the
 * moment a jump happens.
 */
export type RuntimeState = {
  definition: FormDefinition;
  answers: Record<string, AnswerValue>;
  visited: string[];
  currentBlockId: string;
  variables: Record<string, string | number | boolean>;
};

export function start(definition: FormDefinition): RuntimeState {
  const firstBlock = definition.blocks[0];
  if (!firstBlock) {
    throw new Error("Cannot start a form with no blocks");
  }

  return {
    definition,
    answers: {},
    visited: [],
    currentBlockId: firstBlock.id,
    variables: {},
  };
}

export function answer(
  state: RuntimeState,
  blockId: string,
  value: AnswerValue,
): RuntimeState {
  return {
    ...state,
    answers: { ...state.answers, [blockId]: value },
  };
}

export function next(state: RuntimeState): RuntimeState | { done: true } {
  const currentIndex = state.definition.blocks.findIndex(
    (b) => b.id === state.currentBlockId,
  );
  const nextBlock = state.definition.blocks[currentIndex + 1];

  if (!nextBlock) {
    return { done: true };
  }

  return {
    ...state,
    visited: [...state.visited, state.currentBlockId],
    currentBlockId: nextBlock.id,
  };
}

export function back(state: RuntimeState): RuntimeState {
  if (state.visited.length === 0) {
    return state;
  }

  const previousBlockId = state.visited[state.visited.length - 1];

  return {
    ...state,
    visited: state.visited.slice(0, -1),
    currentBlockId: previousBlockId,
  };
}

export function progress(state: RuntimeState): {
  current: number;
  total: number;
} {
  const currentIndex = state.definition.blocks.findIndex(
    (b) => b.id === state.currentBlockId,
  );

  return {
    current: currentIndex + 1,
    total: state.definition.blocks.length,
  };
}
