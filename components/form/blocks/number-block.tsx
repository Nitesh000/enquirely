"use client";

import { useState } from "react";

import { Kbd, QuestionShell, runtimeFieldClasses } from "./question-shell";
import { asNumber, describedBy, type BlockProps } from "./types";

export function NumberBlock({
  block,
  value,
  onChange,
  onSubmit,
  autoFocus,
  error,
}: BlockProps<"number">) {
  /**
   * Local text mirror of the numeric answer. Needed because "-", "" and "3."
   * are all legitimate things to have typed on the way to a number, and none
   * of them survive a round trip through `number`. The renderer keys blocks
   * by id, so this resets correctly on every question change.
   */
  const [text, setText] = useState(() => {
    const initial = asNumber(value);
    return initial === undefined ? "" : String(initial);
  });

  const { min, max } = block.number;

  return (
    <QuestionShell
      blockId={block.id}
      title={block.title}
      description={block.description}
      required={block.required}
      error={error}
      hint={
        <>
          {min !== undefined || max !== undefined ? (
            <span className="mr-1">
              {min !== undefined && max !== undefined
                ? `Between ${min} and ${max}.`
                : min !== undefined
                  ? `${min} or more.`
                  : `${max} or less.`}
            </span>
          ) : null}
          Press <Kbd>Enter</Kbd> to continue
        </>
      }
    >
      <input
        // Not `type="number"`: it hijacks the scroll wheel, ignores
        // maxLength, and gives inconsistent mobile keyboards. `inputMode`
        // gets the numeric keypad without any of that.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        autoFocus={autoFocus}
        value={text}
        aria-labelledby={`${block.id}-label`}
        aria-describedby={describedBy(block, error)}
        aria-invalid={error ? true : undefined}
        className={runtimeFieldClasses}
        placeholder="0"
        onChange={(event) => {
          const next = event.target.value;
          setText(next);

          const trimmed = next.trim();
          if (trimmed === "") {
            onChange(undefined);
            return;
          }

          const parsed = Number(trimmed);
          // Leave partial input ("-", "1.") alone rather than emitting NaN:
          // the answer simply stays un-set until it parses.
          onChange(Number.isFinite(parsed) ? parsed : undefined);
        }}
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
