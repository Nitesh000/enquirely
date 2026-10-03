"use client";

import { CheckIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils/utils";

import { Kbd, QuestionShell } from "./question-shell";
import { asBoolean, describedBy, type BlockProps } from "./types";
import { useOptionRefs } from "./use-option-refs";

const CHOICES = [
  { value: true, label: "Yes", key: "Y", Icon: CheckIcon },
  { value: false, label: "No", key: "N", Icon: XIcon },
] as const;

export function YesNoBlock({
  block,
  value,
  onChange,
  onSubmit,
  autoFocus,
  error,
  onTitleChange,
  onDescriptionChange,
}: BlockProps<"yes_no">) {
  const selected = asBoolean(value);
  const activeIndex = selected === false ? 1 : 0;
  const { setRef, focusAt } = useOptionRefs(activeIndex, autoFocus);

  function pick(next: boolean) {
    onChange(next);
    onSubmit();
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
          Press <Kbd>Y</Kbd> or <Kbd>N</Kbd>
        </>
      }
    >
      <div
        role="radiogroup"
        aria-labelledby={`${block.id}-label`}
        aria-describedby={describedBy(block, error)}
        aria-invalid={error ? true : undefined}
        className="grid gap-2.5 sm:grid-cols-2"
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;

          const key = event.key.toUpperCase();
          if (key === "Y") {
            event.preventDefault();
            pick(true);
            return;
          }
          if (key === "N") {
            event.preventDefault();
            pick(false);
            return;
          }

          if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "ArrowUp" ||
            event.key === "ArrowDown"
          ) {
            event.preventDefault();
            const next = !(selected ?? false);
            onChange(next);
            focusAt(next ? 0 : 1);
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      >
        {CHOICES.map(({ value: choiceValue, label, key, Icon }, index) => {
          const isSelected = selected === choiceValue;

          return (
            <button
              key={label}
              ref={setRef(index)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === activeIndex ? 0 : -1}
              className={cn(
                "group flex min-h-[4rem] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                "outline-none hover:border-brand/50 hover:bg-brand/[0.04]",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                isSelected
                  ? "border-brand bg-brand/10 ring-1 ring-brand/30"
                  : "border-border",
              )}
              onClick={() => pick(choiceValue)}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
                  isSelected
                    ? "border-brand bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground group-hover:border-brand/40",
                )}
              >
                <Icon className="size-4" />
              </span>

              <span className="flex-1 text-base font-medium">{label}</span>

              <Kbd className="opacity-60">{key}</Kbd>
            </button>
          );
        })}
      </div>
    </QuestionShell>
  );
}
