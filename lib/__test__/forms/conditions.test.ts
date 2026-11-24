import { describe, expect, it } from "vitest";

import {
  evaluateCondition,
  evaluateConditionGroup,
} from "@/lib/forms/conditions";
import type { Condition, ConditionGroup } from "@/lib/forms/schema";

const answers = {
  role: "developer",
  rating: 2,
  comment: "The onboarding was confusing",
  tools: ["vscode", "vim"],
  subscribed: true,
  blank: "",
  emptyList: [] as string[],
};

function check(condition: Condition) {
  return evaluateCondition(condition, answers);
}

describe("evaluateCondition", () => {
  it("compares equality case-insensitively", () => {
    expect(check({ blockId: "role", operator: "equals", value: "Developer" })).toBe(true);
    expect(check({ blockId: "role", operator: "equals", value: "designer" })).toBe(false);
    expect(check({ blockId: "role", operator: "not_equals", value: "designer" })).toBe(true);
  });

  it("treats equality on a multi-select as membership", () => {
    expect(check({ blockId: "tools", operator: "equals", value: "vim" })).toBe(true);
    expect(check({ blockId: "tools", operator: "equals", value: "emacs" })).toBe(false);
  });

  it("compares numbers numerically, not as text", () => {
    // The bug this guards: "10" < "9" is true as strings.
    const ten = { rating: 10 };
    expect(
      evaluateCondition({ blockId: "rating", operator: "greater_than", value: 9 }, ten),
    ).toBe(true);
  });

  it("coerces string values, since JSON and model output both send them", () => {
    expect(check({ blockId: "rating", operator: "less_than", value: "3" })).toBe(true);
    expect(check({ blockId: "rating", operator: "greater_than_or_equal", value: "2" })).toBe(true);
  });

  it("fails rather than throws when a value is not comparable", () => {
    expect(check({ blockId: "role", operator: "greater_than", value: 3 })).toBe(false);
    expect(check({ blockId: "rating", operator: "less_than", value: "abc" })).toBe(false);
  });

  it("matches substrings case-insensitively", () => {
    expect(check({ blockId: "comment", operator: "contains", value: "ONBOARDING" })).toBe(true);
    expect(check({ blockId: "comment", operator: "not_contains", value: "pricing" })).toBe(true);
  });

  it("treats empty string and empty array as unanswered", () => {
    expect(check({ blockId: "blank", operator: "is_answered" })).toBe(false);
    expect(check({ blockId: "emptyList", operator: "is_answered" })).toBe(false);
    expect(check({ blockId: "missing", operator: "is_not_answered" })).toBe(true);
    expect(check({ blockId: "role", operator: "is_answered" })).toBe(true);
  });

  it("returns false for value operators on an unanswered question", () => {
    // A partial response is a normal row, not an error.
    expect(check({ blockId: "missing", operator: "equals", value: "x" })).toBe(false);
    expect(check({ blockId: "missing", operator: "not_equals", value: "x" })).toBe(false);
    expect(check({ blockId: "missing", operator: "greater_than", value: 1 })).toBe(false);
  });

  it("returns false when a comparison operator has no value", () => {
    expect(check({ blockId: "role", operator: "equals" })).toBe(false);
    expect(check({ blockId: "comment", operator: "contains" })).toBe(false);
  });
});

describe("evaluateConditionGroup", () => {
  it("evaluates a bare condition", () => {
    expect(
      evaluateConditionGroup({ blockId: "role", operator: "equals", value: "developer" }, answers),
    ).toBe(true);
  });

  it("requires every member of all", () => {
    const group: ConditionGroup = {
      all: [
        { blockId: "role", operator: "equals", value: "developer" },
        { blockId: "rating", operator: "less_than", value: 3 },
      ],
    };

    expect(evaluateConditionGroup(group, answers)).toBe(true);
    expect(evaluateConditionGroup(group, { ...answers, rating: 5 })).toBe(false);
  });

  it("requires one member of any", () => {
    const group: ConditionGroup = {
      any: [
        { blockId: "role", operator: "equals", value: "designer" },
        { blockId: "rating", operator: "less_than", value: 3 },
      ],
    };

    expect(evaluateConditionGroup(group, answers)).toBe(true);
    expect(evaluateConditionGroup(group, { ...answers, rating: 5 })).toBe(false);
  });

  it("nests all and any to arbitrary depth", () => {
    // country = US AND (plan = pro OR rating < 3) --- the mixed case that
    // is the entire reason ConditionGroup is recursive.
    const group: ConditionGroup = {
      all: [
        { blockId: "role", operator: "equals", value: "developer" },
        {
          any: [
            { blockId: "tools", operator: "equals", value: "emacs" },
            { blockId: "rating", operator: "less_than", value: 3 },
          ],
        },
      ],
    };

    expect(evaluateConditionGroup(group, answers)).toBe(true);
    expect(evaluateConditionGroup(group, { ...answers, rating: 9 })).toBe(false);
  });

  it("uses the identity of each operator when empty", () => {
    // The model can emit either, and an empty `all` matching nothing (or an
    // empty `any` matching everything) would both be surprising.
    expect(evaluateConditionGroup({ all: [] }, answers)).toBe(true);
    expect(evaluateConditionGroup({ any: [] }, answers)).toBe(false);
  });
});
