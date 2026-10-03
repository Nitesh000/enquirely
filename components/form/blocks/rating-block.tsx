"use client";

import { StarIcon } from "lucide-react";

import { cn } from "@/lib/utils/utils";

import { Kbd, QuestionShell } from "./question-shell";
import { asNumber, describedBy, type BlockProps } from "./types";
import { useOptionRefs } from "./use-option-refs";

export function RatingBlock({
  block,
  value,
  onChange,
  onSubmit,
  autoFocus,
  error,
}: BlockProps<"rating">) {
  const { max, style } = block.rating;
  const selected = asNumber(value);
  const scale = Array.from({ length: max }, (_, index) => index + 1);
  const activeIndex = selected === undefined ? 0 : selected - 1;
  const { setRef, focusAt } = useOptionRefs(activeIndex, autoFocus);

  function pick(next: number) {
    onChange(next);
    onSubmit();
  }

  function move(step: number) {
    const next = Math.min(Math.max((selected ?? (step > 0 ? 0 : max + 1)) + step, 1), max);
    onChange(next);
    focusAt(next - 1);
  }

  return (
    <QuestionShell
      blockId={block.id}
      title={block.title}
      description={block.description}
      required={block.required}
      error={error}
      hint={
        <>
          Press <Kbd>1</Kbd>–<Kbd>{max > 9 ? "9" : max}</Kbd>, or use{" "}
          <Kbd>←</Kbd> <Kbd>→</Kbd> then <Kbd>Enter</Kbd>
        </>
      }
    >
      <div
        role="radiogroup"
        aria-labelledby={`${block.id}-label`}
        aria-describedby={describedBy(block, error)}
        aria-invalid={error ? true : undefined}
        className="flex flex-wrap gap-2"
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;

          // Number keys jump straight to a value --- single digits only, so a
          // 10-point scale is reached by click or arrows for its top value.
          const digit = Number(event.key);
          if (Number.isInteger(digit) && digit >= 1 && digit <= max) {
            event.preventDefault();
            pick(digit);
            return;
          }

          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            move(1);
            return;
          }

          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            move(-1);
            return;
          }

          // Submits even when unrated: a required question has to explain
          // itself rather than quietly refusing to move.
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      >
        {scale.map((point) => {
          // Stars fill cumulatively; numbers highlight only the exact pick.
          const isActive =
            style === "star"
              ? selected !== undefined && point <= selected
              : point === selected;

          return (
            <button
              key={point}
              ref={setRef(point - 1)}
              type="button"
              role="radio"
              aria-checked={point === selected}
              aria-label={`${point} of ${max}`}
              tabIndex={point - 1 === activeIndex ? 0 : -1}
              className={cn(
                "grid size-13 place-items-center rounded-xl border text-base font-medium transition-all",
                "outline-none hover:border-brand/50 hover:bg-brand/[0.04]",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive
                  ? "border-brand bg-brand/10 text-foreground"
                  : "border-border text-muted-foreground",
              )}
              onClick={() => pick(point)}
            >
              {style === "star" ? (
                <StarIcon
                  aria-hidden
                  className={cn(
                    "size-6 transition-colors",
                    isActive ? "fill-brand text-brand" : "text-muted-foreground",
                  )}
                />
              ) : (
                point
              )}
            </button>
          );
        })}
      </div>
    </QuestionShell>
  );
}
