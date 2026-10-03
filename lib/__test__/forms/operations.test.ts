import { describe, expect, it } from "vitest";

import { applyOperations, type FormOperation } from "@/lib/forms/operations";
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
    logic: [
      {
        id: "r1",
        condition: { blockId: "q1", operator: "is_answered" },
        action: { type: "show", target: "q2" },
      },
    ],
    theme: {
      preset: "minimal",
      accentColor: "#000",
      font: "Inter",
      buttonStyle: "rounded",
      animation: "subtle",
    },
  };
}

describe("applyOperations", () => {
  describe("update_form", () => {
    it("updates the title", () => {
      const def = makeDefinition();

      const result = applyOperations(def, [
        { type: "update_form", changes: { title: "Renamed" } },
      ]);

      expect(result.title).toBe("Renamed");
    });

    it("leaves description untouched when absent from changes", () => {
      const def = { ...makeDefinition(), description: "Original" };

      const result = applyOperations(def, [
        { type: "update_form", changes: { title: "Renamed" } },
      ]);

      expect(result.description).toBe("Original");
    });

    it("clears description when explicitly set to undefined", () => {
      const def = { ...makeDefinition(), description: "Original" };

      const result = applyOperations(def, [
        { type: "update_form", changes: { description: undefined } },
      ]);

      expect(result.description).toBeUndefined();
    });

    it("never touches blocks", () => {
      const def = makeDefinition();
      const snapshotBlocks = def.blocks.map((b) => b.id);

      const result = applyOperations(def, [
        { type: "update_form", changes: { title: "Renamed" } },
      ]);

      expect(result.blocks.map((b) => b.id)).toEqual(snapshotBlocks);
    });
  });

  it("does not mutate the original definition", () => {
    const def = makeDefinition();
    const snapshotBlocks = def.blocks.map((b) => b.id);

    applyOperations(def, [{ type: "delete_block", id: "q1" }]);

    expect(def.blocks.map((b) => b.id)).toEqual(snapshotBlocks);
  });

  describe("add_block", () => {
    it("appends when index is at the end", () => {
      const def = makeDefinition();
      const newBlock = {
        id: "q3",
        title: "Q3",
        required: false,
        type: "short_text" as const,
        shortText: {},
      };

      const result = applyOperations(def, [
        { type: "add_block", block: newBlock, index: 2 },
      ]);

      expect(result.blocks.map((b) => b.id)).toEqual(["q1", "q2", "q3"]);
    });

    it("inserts at the requested index, not just at the end", () => {
      const def = makeDefinition();
      const newBlock = {
        id: "q0",
        title: "Q0",
        required: false,
        type: "short_text" as const,
        shortText: {},
      };

      const result = applyOperations(def, [
        { type: "add_block", block: newBlock, index: 0 },
      ]);

      expect(result.blocks.map((b) => b.id)).toEqual(["q0", "q1", "q2"]);
    });
  });

  describe("update_block", () => {
    it("merges changes into the target block", () => {
      const def = makeDefinition();

      const result = applyOperations(def, [
        { type: "update_block", id: "q2", changes: { title: "Updated Q2" } },
      ]);

      expect(result.blocks.find((b) => b.id === "q2")?.title).toBe(
        "Updated Q2",
      );
    });

    it("leaves other blocks untouched", () => {
      const def = makeDefinition();

      const result = applyOperations(def, [
        { type: "update_block", id: "q2", changes: { title: "Updated Q2" } },
      ]);

      expect(result.blocks.find((b) => b.id === "q1")?.title).toBe("Q1");
    });

    it("throws for an unknown block id", () => {
      const def = makeDefinition();

      expect(() =>
        applyOperations(def, [
          { type: "update_block", id: "ghost", changes: { title: "x" } },
        ]),
      ).toThrow();
    });
  });

  describe("delete_block", () => {
    it("removes exactly the target block", () => {
      const def = makeDefinition();

      const result = applyOperations(def, [
        { type: "delete_block", id: "q1" },
      ]);

      expect(result.blocks.map((b) => b.id)).toEqual(["q2"]);
    });

    it("throws for an unknown block id instead of deleting the wrong one", () => {
      const def = makeDefinition();

      expect(() =>
        applyOperations(def, [{ type: "delete_block", id: "ghost" }]),
      ).toThrow();
    });
  });

  describe("move_block", () => {
    it("reorders blocks to the target index", () => {
      const def = makeDefinition();
      const threeBlocks: FormDefinition = {
        ...def,
        blocks: [
          ...def.blocks,
          {
            id: "q3",
            title: "Q3",
            required: false,
            type: "short_text",
            shortText: {},
          },
        ],
      };

      const result = applyOperations(threeBlocks, [
        { type: "move_block", id: "q3", toIndex: 0 },
      ]);

      expect(result.blocks.map((b) => b.id)).toEqual(["q3", "q1", "q2"]);
    });

    it("throws for an unknown block id instead of moving the wrong one", () => {
      const def = makeDefinition();

      expect(() =>
        applyOperations(def, [
          { type: "move_block", id: "ghost", toIndex: 0 },
        ]),
      ).toThrow();
    });
  });

  describe("add_logic", () => {
    it("appends a new logic rule", () => {
      const def = makeDefinition();
      const newRule: FormOperation = {
        type: "add_logic",
        rule: {
          id: "r2",
          condition: { blockId: "q2", operator: "is_answered" },
          action: { type: "end_survey" },
        },
      };

      const result = applyOperations(def, [newRule]);

      expect(result.logic.map((r) => r.id)).toEqual(["r1", "r2"]);
    });
  });

  describe("delete_logic", () => {
    it("removes exactly the target rule", () => {
      const def = makeDefinition();

      const result = applyOperations(def, [
        { type: "delete_logic", ruleId: "r1" },
      ]);

      expect(result.logic).toEqual([]);
    });

    it("throws for an unknown rule id instead of deleting the wrong one", () => {
      const def = makeDefinition();

      expect(() =>
        applyOperations(def, [{ type: "delete_logic", ruleId: "ghost" }]),
      ).toThrow();
    });
  });

  describe("update_theme", () => {
    it("merges partial theme changes", () => {
      const def = makeDefinition();

      const result = applyOperations(def, [
        { type: "update_theme", changes: { preset: "bold" } },
      ]);

      expect(result.theme.preset).toBe("bold");
      expect(result.theme.font).toBe("Inter");
    });
  });

  describe("multiple operations in one call", () => {
    it("applies them in order", () => {
      const def = makeDefinition();

      const result = applyOperations(def, [
        { type: "delete_block", id: "q1" },
        {
          type: "add_block",
          block: {
            id: "q3",
            title: "Q3",
            required: false,
            type: "short_text",
            shortText: {},
          },
          index: 1,
        },
      ]);

      expect(result.blocks.map((b) => b.id)).toEqual(["q2", "q3"]);
    });
  });
});
