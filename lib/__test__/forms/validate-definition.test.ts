import { describe, expect, it } from "vitest";

import { validateDefinition } from "@/lib/forms/validate-definition";
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

describe("validateDefinition", () => {
  it("returns no issues for a clean form", () => {
    expect(validateDefinition(makeDefinition())).toEqual([]);
  });

  it("flags a duplicate block id", () => {
    const def = makeDefinition();
    def.blocks[1].id = "q1";

    const issues = validateDefinition(def);

    expect(issues).toContainEqual(
      expect.objectContaining({ blockId: "q1" }),
    );
  });

  it("flags a condition referencing an unknown block", () => {
    const def = makeDefinition();
    def.logic = [
      {
        id: "r1",
        condition: { blockId: "ghost", operator: "is_answered" },
        action: { type: "end_survey" },
      },
    ];

    const issues = validateDefinition(def);

    expect(issues).toContainEqual(
      expect.objectContaining({ blockId: "ghost" }),
    );
  });

  it("flags an unknown block buried inside a nested all/any condition", () => {
    const def = makeDefinition();
    def.logic = [
      {
        id: "r4",
        condition: {
          all: [
            { blockId: "q1", operator: "is_answered" },
            { any: [{ blockId: "ghost2", operator: "is_answered" }] },
          ],
        },
        action: { type: "end_survey" },
      },
    ];

    const issues = validateDefinition(def);

    expect(issues).toContainEqual(
      expect.objectContaining({ blockId: "ghost2" }),
    );
  });

  it("flags a jump action targeting an unknown block", () => {
    const def = makeDefinition();
    def.logic = [
      {
        id: "r2",
        condition: { blockId: "q1", operator: "is_answered" },
        action: { type: "jump", target: "ghost" },
      },
    ];

    const issues = validateDefinition(def);

    expect(issues).toContainEqual(
      expect.objectContaining({ blockId: "ghost" }),
    );
  });

  it("flags a rule that jumps to the block that triggered it", () => {
    const def = makeDefinition();
    def.logic = [
      {
        id: "r3",
        condition: { blockId: "q1", operator: "equals", value: "x" },
        action: { type: "jump", target: "q1" },
      },
    ];

    const issues = validateDefinition(def);

    expect(issues).toContainEqual(
      expect.objectContaining({ blockId: "q1" }),
    );
  });

  it("does not flag a normal jump to a different block", () => {
    const def = makeDefinition();
    def.logic = [
      {
        id: "r5",
        condition: { blockId: "q1", operator: "equals", value: "x" },
        action: { type: "jump", target: "q2" },
      },
    ];

    expect(validateDefinition(def)).toEqual([]);
  });

  it("never flags blocks as unreachable in M1 (no logic evaluated yet)", () => {
    // engine.ts's next() is purely linear in M1 -- it never skips a
    // block -- so every block is reachable by definition, regardless of
    // what logic exists. This becomes a real check in M4, once jumps are
    // actually evaluated at runtime. If this test ever fails, that's a
    // deliberate M4 change, not a regression.
    const def = makeDefinition();
    def.blocks.push({
      id: "q3",
      title: "Q3",
      required: false,
      type: "short_text",
      shortText: {},
    });

    expect(validateDefinition(def)).toEqual([]);
  });

  it("reports multiple independent issues in one pass", () => {
    const def = makeDefinition();
    def.blocks[1].id = "q1";
    def.logic = [
      {
        id: "r1",
        condition: { blockId: "ghost", operator: "is_answered" },
        action: { type: "end_survey" },
      },
    ];

    const issues = validateDefinition(def);

    expect(issues).toContainEqual(
      expect.objectContaining({ blockId: "q1" }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ blockId: "ghost" }),
    );
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
