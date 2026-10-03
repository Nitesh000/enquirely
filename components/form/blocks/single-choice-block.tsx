"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils/utils";

import { Kbd, QuestionShell, optionBaseClasses } from "./question-shell";
import {
  CHOICE_LETTERS,
  asString,
  describedBy,
  type BlockProps,
} from "./types";
import { useOptionRefs } from "./use-option-refs";

export function SingleChoiceBlock({
  block,
  value,
  onChange,
  onSubmit,
  autoFocus,
  error,
  onTitleChange,
  onDescriptionChange,
}: BlockProps<"single_choice">) {
  const options = block.singleChoice.options;
  const selected = asString(value);
  const selectedIndex = options.findIndex((option) => option.id === selected);
  // Exactly one option is tabbable at a time; Tab enters and leaves the
  // group in one step rather than walking every choice.
  const activeIndex = selectedIndex === -1 ? 0 : selectedIndex;
  const { setRef, focusAt } = useOptionRefs(activeIndex, autoFocus);

  function choose(optionId: string) {
    onChange(optionId);
    // Picking a single choice is the answer *and* the intent to move on.
    // Safe to fire both in one tick: the renderer's reducer applies them in
    // order, so the submit sees the value just set.
    onSubmit();
  }

  function move(step: number) {
    const base = selectedIndex === -1 ? (step === 1 ? -1 : 0) : selectedIndex;
    const nextIndex = (base + step + options.length) % options.length;
    onChange(options[nextIndex].id);
    focusAt(nextIndex);
  }

  return (
    <QuestionShell
      blockId={block.id}
      title={block.title}
      description={block.description}
      required={block.required}
      error={error}
      onTitleChange={onTitleChange}
      onDescriptionChange={onDescriptionChange}
      hint={
        <>
          Press <Kbd>A</Kbd>–<Kbd>{CHOICE_LETTERS[options.length - 1]}</Kbd> to
          choose, or use <Kbd>↑</Kbd> <Kbd>↓</Kbd>
        </>
      }
    >
      <div
        role="radiogroup"
        aria-labelledby={`${block.id}-label`}
        aria-describedby={describedBy(block, error)}
        aria-invalid={error ? true : undefined}
        className="grid gap-2.5"
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;

          const letterIndex = CHOICE_LETTERS.indexOf(event.key.toUpperCase());
          if (letterIndex >= 0 && letterIndex < options.length) {
            event.preventDefault();
            choose(options[letterIndex].id);
            return;
          }

          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            move(event.key === "ArrowDown" ? 1 : -1);
            return;
          }

          // Stops the focused button from treating Enter as a click, so
          // Enter always means "continue", never "pick whatever is focused".
          // Submits even with nothing selected: on a required question the
          // respondent needs to see *why* it won't advance, not silence.
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      >
        {options.map((option, index) => {
          const isSelected = option.id === selected;

          return (
            <button
              key={option.id}
              ref={setRef(index)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === activeIndex ? 0 : -1}
              className={cn(
                optionBaseClasses,
                isSelected
                  ? "border-brand bg-brand/10 ring-1 ring-brand/30"
                  : "border-border",
              )}
              onClick={() => choose(option.id)}
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
                {CHOICE_LETTERS[index] ?? index + 1}
              </span>

              <span className="flex-1 text-[0.9375rem]">{option.label}</span>

              {isSelected ? (
                <CheckIcon aria-hidden className="size-4 text-brand" />
              ) : null}
            </button>
          );
        })}
      </div>
    </QuestionShell>
  );
}
