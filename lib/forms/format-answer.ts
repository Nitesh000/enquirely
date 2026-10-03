import type { AnswerValue } from "./answers";
import type { FormBlock, FormDefinition } from "./schema";

const PREVIEW_MAX_LENGTH = 80;

/**
 * An answer as a human-readable string --- "Google", not the option id
 * `"google"` the database actually stores; "Yes", not `true`.
 *
 * Pure and block-type-aware so the response list, the response detail page,
 * and the CSV/JSON exporters (`steps.md` M5.8) all render an answer
 * identically. One formatter, not three copies that quietly drift.
 */
export function formatAnswerValue(
  block: FormBlock,
  value: AnswerValue | undefined,
): string {
  if (value === undefined) return "";

  switch (block.type) {
    case "single_choice": {
      const option = block.singleChoice.options.find((o) => o.id === value);
      return option?.label ?? String(value);
    }

    case "multi_choice": {
      const ids = Array.isArray(value) ? value : [];
      return ids
        .map(
          (id) =>
            block.multiChoice.options.find((o) => o.id === id)?.label ?? id,
        )
        .join(", ");
    }

    case "yes_no":
      return value === true ? "Yes" : value === false ? "No" : "";

    case "rating":
      return typeof value === "number" ? `${value} / ${block.rating.max}` : "";

    default:
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
  }
}

/**
 * One-line summary for the response list: the first answered block,
 * formatted and truncated. "(no answers)" for a response abandoned before
 * the first question --- which is a real, expected state, not an error.
 */
export function getResponsePreview(
  definition: FormDefinition,
  answers: Record<string, AnswerValue>,
): string {
  for (const block of definition.blocks) {
    const text = formatAnswerValue(block, answers[block.id]);
    if (text) {
      return text.length > PREVIEW_MAX_LENGTH
        ? `${text.slice(0, PREVIEW_MAX_LENGTH)}…`
        : text;
    }
  }

  return "(no answers)";
}
