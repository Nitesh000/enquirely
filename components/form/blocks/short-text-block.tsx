"use client";

import { Kbd, QuestionShell, runtimeFieldClasses } from "./question-shell";
import { asString, describedBy, type BlockProps } from "./types";

export function ShortTextBlock({
  block,
  value,
  onChange,
  onSubmit,
  autoFocus,
  error,
  onTitleChange,
  onDescriptionChange,
}: BlockProps<"short_text">) {
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
          Press <Kbd>Enter</Kbd> to continue
        </>
      }
    >
      <input
        type="text"
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="next"
        maxLength={block.shortText.maxLength}
        value={asString(value)}
        aria-labelledby={`${block.id}-label`}
        aria-describedby={describedBy(block, error)}
        aria-invalid={error ? true : undefined}
        className={runtimeFieldClasses}
        placeholder="Type your answer"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
    </QuestionShell>
  );
}
