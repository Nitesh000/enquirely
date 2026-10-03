"use client";

import { Kbd, QuestionShell } from "./question-shell";
import { asString, describedBy, type BlockProps } from "./types";

export function LongTextBlock({
  block,
  value,
  onChange,
  onSubmit,
  autoFocus,
  error,
  onTitleChange,
  onDescriptionChange,
}: BlockProps<"long_text">) {
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
          <Kbd>Enter</Kbd> to continue, <Kbd>Shift</Kbd>
          <span aria-hidden>+</span>
          <Kbd>Enter</Kbd> for a new line
        </>
      }
    >
      <textarea
        rows={4}
        autoFocus={autoFocus}
        maxLength={block.longText.maxLength}
        value={asString(value)}
        aria-labelledby={`${block.id}-label`}
        aria-describedby={describedBy(block, error)}
        aria-invalid={error ? true : undefined}
        className="w-full resize-none rounded-xl border bg-transparent p-4 text-lg leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-muted-foreground/40 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-ring/30 aria-[invalid=true]:border-destructive"
        placeholder="Type your answer"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Shift+Enter is a newline; bare Enter advances (`steps.md` M2.6).
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
    </QuestionShell>
  );
}
