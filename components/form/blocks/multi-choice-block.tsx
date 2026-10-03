"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils/utils";

import { Kbd, QuestionShell, optionBaseClasses } from "./question-shell";
import {
  CHOICE_LETTERS,
  asStringArray,
  describedBy,
  type BlockProps,
} from "./types";
import { useOptionRefs } from "./use-option-refs";

export function MultiChoiceBlock({
  block,
  value,
  onChange,
  onSubmit,
  autoFocus,
  error,
}: BlockProps<"multi_choice">) {
  const options = block.multiChoice.options;
  const selected = asStringArray(value);
  // Multi-select has no single "current" option, so the roving index is
  // tracked rather than derived from the selection.
  const [activeIndex, setActiveIndex] = useState(0);
  const { setRef, focusAt } = useOptionRefs(activeIndex, autoFocus);

  function toggle(optionId: string) {
    const next = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];

    // Empty means un-answered, not "answered with nothing".
    onChange(next.length > 0 ? next : undefined);
  }

  function move(step: number) {
    const nextIndex = (activeIndex + step + options.length) % options.length;
    setActiveIndex(nextIndex);
    focusAt(nextIndex);
  }

  const { minSelected, maxSelected } = block.multiChoice;

  return (
    <QuestionShell
      blockId={block.id}
      title={block.title}
      description={block.description}
      required={block.required}
      error={error}
      hint={
        <>
          {minSelected !== undefined || maxSelected !== undefined ? (
            <span className="mr-1">
              {minSelected !== undefined && maxSelected !== undefined
                ? `Choose ${minSelected}–${maxSelected}.`
                : minSelected !== undefined
                  ? `Choose at least ${minSelected}.`
                  : `Choose up to ${maxSelected}.`}
            </span>
          ) : null}
          Letters toggle, <Kbd>Enter</Kbd> confirms
        </>
      }
    >
      <div
        role="group"
        aria-labelledby={`${block.id}-label`}
        aria-describedby={describedBy(block, error)}
        className="grid gap-2.5"
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;

          const letterIndex = CHOICE_LETTERS.indexOf(event.key.toUpperCase());
          if (letterIndex >= 0 && letterIndex < options.length) {
            event.preventDefault();
            setActiveIndex(letterIndex);
            toggle(options[letterIndex].id);
            return;
          }

          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            move(event.key === "ArrowDown" ? 1 : -1);
            return;
          }

          // Enter confirms the whole set. Space still toggles the focused
          // option, via the button's own native click.
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      >
        {options.map((option, index) => {
          const isSelected = selected.includes(option.id);

          return (
            <button
              key={option.id}
              ref={setRef(index)}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={index === activeIndex ? 0 : -1}
              className={cn(
                optionBaseClasses,
                isSelected
                  ? "border-brand bg-brand/10 ring-1 ring-brand/30"
                  : "border-border",
              )}
              onClick={() => {
                setActiveIndex(index);
                toggle(option.id);
              }}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md border font-mono text-xs font-medium transition-colors",
                  isSelected
                    ? "border-brand bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground group-hover:border-brand/40",
                )}
              >
                {isSelected ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  (CHOICE_LETTERS[index] ?? index + 1)
                )}
              </span>

              <span className="flex-1 text-[0.9375rem]">{option.label}</span>
            </button>
          );
        })}
      </div>
    </QuestionShell>
  );
}
