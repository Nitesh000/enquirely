import type { AnswerValue } from "./answers";
import type { FormBlock } from "./schema";

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
