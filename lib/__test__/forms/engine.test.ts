import { describe, expect, it } from "vitest";

import { answer, back, next, progress, start } from "@/lib/forms/engine";
import type { FormDefinition } from "@/lib/forms/schema";

function makeDefinition(): FormDefinition {
  return {
    version: 1,
    title: "Test",
    blocks: [
      {
        id: "q1",
        title: "Q1",
        required: false,
        type: "short_text",
        shortText: {},
      },
      {
        id: "q2",
        title: "Q2",
        required: false,
        type: "short_text",
        shortText: {},
      },
      {
        id: "q3",
        title: "Q3",
        required: false,
        type: "short_text",
        shortText: {},
      },
    ],
    logic: [],
    theme: {
      preset: "minimal",
      accentColor: "#000",
      font: "Inter",
      buttonStyle: "rounded",
      animation: "subtle",
    },
  };
}

describe("start", () => {
  it("begins at the first block with empty answers and history", () => {
    const state = start(makeDefinition());

    expect(state.currentBlockId).toBe("q1");
    expect(state.answers).toEqual({});
    expect(state.visited).toEqual([]);
  });

  it("throws when the form has no blocks", () => {
    const empty: FormDefinition = { ...makeDefinition(), blocks: [] };

    expect(() => start(empty)).toThrow();
  });
});

describe("answer", () => {
  it("stores the value under the given block id", () => {
    const state = start(makeDefinition());

    const result = answer(state, "q1", "hello");

    expect(result.answers).toEqual({ q1: "hello" });
  });

  it("merges rather than replaces when answering a second block", () => {
    const state = start(makeDefinition());

    const result = answer(answer(state, "q1", "hello"), "q2", "world");

    expect(result.answers).toEqual({ q1: "hello", q2: "world" });
  });

  it("does not move navigation", () => {
    const state = start(makeDefinition());

    const result = answer(state, "q1", "hello");

    expect(result.currentBlockId).toBe(state.currentBlockId);
    expect(result.visited).toEqual(state.visited);
  });

  it("does not mutate the original state", () => {
    const state = start(makeDefinition());

    answer(state, "q1", "hello");

    expect(state.answers).toEqual({});
  });
});

describe("next", () => {
  it("advances to the following block and records history", () => {
    const state = start(makeDefinition());

    const result = next(state);
    if ("done" in result) throw new Error("expected a RuntimeState");

    expect(result.currentBlockId).toBe("q2");
    expect(result.visited).toEqual(["q1"]);
  });

  it("reaches the last block after two steps with full history", () => {
    let state = start(makeDefinition());

    const first = next(state);
    if ("done" in first) throw new Error("expected a RuntimeState");
    state = first;

    const second = next(state);
    if ("done" in second) throw new Error("expected a RuntimeState");
    state = second;

    expect(state.currentBlockId).toBe("q3");
    expect(state.visited).toEqual(["q1", "q2"]);
  });

  it("returns done past the last block instead of a state", () => {
    let state = start(makeDefinition());

    for (let i = 0; i < 2; i++) {
      const result = next(state);
      if ("done" in result) throw new Error("expected a RuntimeState");
      state = result;
    }

    const result = next(state);

    expect(result).toEqual({ done: true });
  });

  it("does not mutate the original state", () => {
    const state = start(makeDefinition());
    const snapshotVisited = [...state.visited];

    next(state);

    expect(state.visited).toEqual(snapshotVisited);
    expect(state.currentBlockId).toBe("q1");
  });
});

describe("back", () => {
  it("returns to the previous block and shrinks history", () => {
    const state = start(makeDefinition());
    const afterNext = next(state);
    if ("done" in afterNext) throw new Error("expected a RuntimeState");

    const result = back(afterNext);

    expect(result.currentBlockId).toBe("q1");
    expect(result.visited).toEqual([]);
  });

  it("is a no-op at the start", () => {
    const state = start(makeDefinition());

    const result = back(state);

    expect(result.currentBlockId).toBe("q1");
    expect(result.visited).toEqual([]);
  });

  it("round-trips with next back to the exact starting state", () => {
    const state = start(makeDefinition());
    const afterNext = next(state);
    if ("done" in afterNext) throw new Error("expected a RuntimeState");

    const result = back(afterNext);

    expect(result.currentBlockId).toBe(state.currentBlockId);
    expect(result.visited).toEqual(state.visited);
  });

  it("does not mutate the original state", () => {
    const state = start(makeDefinition());
    const afterNext = next(state);
    if ("done" in afterNext) throw new Error("expected a RuntimeState");
    const snapshotVisited = [...afterNext.visited];

    back(afterNext);

    expect(afterNext.visited).toEqual(snapshotVisited);
  });
});

describe("progress", () => {
  it("reports 1 of total at the start", () => {
    const state = start(makeDefinition());

    expect(progress(state)).toEqual({ current: 1, total: 3 });
  });

  it("reports 2 of total after one next", () => {
    const state = start(makeDefinition());
    const result = next(state);
    if ("done" in result) throw new Error("expected a RuntimeState");

    expect(progress(result)).toEqual({ current: 2, total: 3 });
  });

  it("reports current equal to total at the last block", () => {
    let state = start(makeDefinition());

    for (let i = 0; i < 2; i++) {
      const result = next(state);
      if ("done" in result) throw new Error("expected a RuntimeState");
      state = result;
    }

    const { current, total } = progress(state);
    expect(current).toBe(total);
  });
});
