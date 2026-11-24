import type { AnswerValue } from "./answers";
import type { Condition, ConditionGroup } from "./schema";

/**
 * Condition evaluation, in one place.
 *
 * Three callers want the same semantics and must not drift: M4's branching
 * engine deciding which block comes next, M5's response filters, and M7's
 * `filter_responses` tool. A second implementation is how "shown to the
 * respondent" and "matched by a filter" start disagreeing about the same
 * rule.
 *
 * Pure: answers in, boolean out. No database, no SQL, no React.
 */

function isBlank(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Comparisons arrive as strings from JSON and from the model alike, so both
 * sides are coerced before a numeric operator runs. `NaN` means "not
 * comparable", which fails the comparison rather than throwing.
 */
function toNumber(value: AnswerValue | string | number | boolean): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? Number.NaN : Number(trimmed);
  }
  return Number.NaN;
}

function toText(value: AnswerValue | string | number | boolean): string {
  if (Array.isArray(value)) return value.join(" ");
  return String(value).toLowerCase();
}

function compareNumeric(
  answer: AnswerValue,
  expected: Condition["value"],
  compare: (a: number, b: number) => boolean,
): boolean {
  if (expected === undefined) return false;

  const left = toNumber(answer);
  const right = toNumber(expected);

  if (Number.isNaN(left) || Number.isNaN(right)) return false;

  return compare(left, right);
}

/** Multi-choice stores an array, so equality means "is among the selected". */
function equals(answer: AnswerValue, expected: Condition["value"]): boolean {
  if (expected === undefined) return false;

  if (Array.isArray(answer)) {
    return answer.some((item) => toText(item) === toText(expected));
  }

  return toText(answer) === toText(expected);
}

export function evaluateCondition(
  condition: Condition,
  answers: Record<string, AnswerValue>,
): boolean {
  const answer = answers[condition.blockId];

  if (condition.operator === "is_answered") return !isBlank(answer);
  if (condition.operator === "is_not_answered") return isBlank(answer);

  // Every remaining operator compares a value, and an unanswered question
  // compares false rather than throwing --- a partial response is a normal
  // row here, not an error.
  if (isBlank(answer) || answer === undefined) return false;

  switch (condition.operator) {
    case "equals":
      return equals(answer, condition.value);
    case "not_equals":
      return !equals(answer, condition.value);
    case "contains":
      return (
        condition.value !== undefined &&
        toText(answer).includes(toText(condition.value))
      );
    case "not_contains":
      return (
        condition.value !== undefined &&
        !toText(answer).includes(toText(condition.value))
      );
    case "greater_than":
      return compareNumeric(answer, condition.value, (a, b) => a > b);
    case "less_than":
      return compareNumeric(answer, condition.value, (a, b) => a < b);
    case "greater_than_or_equal":
      return compareNumeric(answer, condition.value, (a, b) => a >= b);
    case "less_than_or_equal":
      return compareNumeric(answer, condition.value, (a, b) => a <= b);
  }
}

/**
 * An empty `all` is true and an empty `any` is false --- the identity of
 * each operation. It matters because the model can emit either, and the
 * alternative is a group that silently matches everything.
 */
export function evaluateConditionGroup(
  group: ConditionGroup,
  answers: Record<string, AnswerValue>,
): boolean {
  if ("all" in group) {
    return group.all.every((child) => evaluateConditionGroup(child, answers));
  }

  if ("any" in group) {
    return group.any.some((child) => evaluateConditionGroup(child, answers));
  }

  return evaluateCondition(group, answers);
}
