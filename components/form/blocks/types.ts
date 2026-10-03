import type { AnswerValue } from "@/lib/forms/answers";
import type { FormBlock } from "@/lib/forms/schema";

/** Narrow `FormBlock` down to one variant by its `type` discriminator. */
export type BlockOfType<T extends FormBlock["type"]> = Extract<
  FormBlock,
  { type: T }
>;

/**
 * The entire contract between the runtime and a block component.
 *
 * Deliberately tiny (`steps.md` M2.3): no store access, no routing, no
 * knowledge of which question number it is or how many remain. That is what
 * lets the same component render inside the builder, the preview and the
 * public runtime without a second implementation (`plan.md` §23).
 *
 * `error` is the one addition to that list: `aria-invalid` and
 * `aria-describedby` have to sit on the real input element, so the block has
 * to know. Builder and preview just omit it.
 */
export type BlockProps<T extends FormBlock["type"]> = {
  block: BlockOfType<T>;
  value: AnswerValue | undefined;
  /**
   * `undefined` means "cleared", not "unchanged" --- emptying a number field
   * or deselecting the last choice has to be expressible, otherwise an
   * optional field can never be un-answered once touched.
   */
  onChange: (value: AnswerValue | undefined) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
  error?: string;
};

/** Letters used as choice accelerators: A, B, C ... */
export const CHOICE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function asString(value: AnswerValue | undefined): string {
  return typeof value === "string" ? value : "";
}

export function asNumber(value: AnswerValue | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function asBoolean(value: AnswerValue | undefined): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function asStringArray(value: AnswerValue | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

/**
 * `aria-describedby` for a control: its hint text, its error, or both.
 * Returns `undefined` rather than an empty string so React drops the
 * attribute entirely instead of rendering `aria-describedby=""`.
 */
export function describedBy(
  block: FormBlock,
  error: string | undefined,
): string | undefined {
  const ids = [
    block.description ? `${block.id}-description` : null,
    error ? `${block.id}-error` : null,
  ].filter(Boolean);

  return ids.length > 0 ? ids.join(" ") : undefined;
}
