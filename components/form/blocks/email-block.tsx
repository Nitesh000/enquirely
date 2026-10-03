"use client";

import { Kbd, QuestionShell, runtimeFieldClasses } from "./question-shell";
import { asString, describedBy, type BlockProps } from "./types";

export function EmailBlock({
  block,
  value,
  onChange,
  onSubmit,
  autoFocus,
  error,
  onTitleChange,
  onDescriptionChange,
}: BlockProps<"email">) {
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
        // type + inputMode + autoComplete together are what summon the
        // right phone keyboard, with the @ key one tap away.
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="next"
        autoFocus={autoFocus}
        value={asString(value)}
        aria-labelledby={`${block.id}-label`}
        aria-describedby={describedBy(block, error)}
        aria-invalid={error ? true : undefined}
        className={runtimeFieldClasses}
        placeholder="name@example.com"
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
