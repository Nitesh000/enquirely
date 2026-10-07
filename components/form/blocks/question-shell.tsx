import type { ReactNode } from "react";

import { cn } from "@/lib/utils/utils";

/**
 * Shared frame for every block: title, optional description, the control
 * itself, an error region and a keyboard hint.
 *
 * Note what is *not* here: question number, progress, and navigation. Those
 * belong to `FormRenderer`, because a block has no business knowing where it
 * sits in the form (`steps.md` M2.3).
 */
export function QuestionShell({
  blockId,
  title,
  description,
  required,
  error,
  hint,
  children,
  onTitleChange,
  onDescriptionChange,
}: {
  blockId: string;
  title: string;
  description?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  /**
   * Present only in the builder. When set, the title renders as a real
   * input instead of static text --- "editing the title edits in place on
   * the real component" (`steps.md` M3.4). The respondent runtime never
   * passes this, so it never pays for it: no extra import, just one prop
   * that's always `undefined` on that path.
   */
  onTitleChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        {onTitleChange ? (
          <div className="flex items-start gap-1.5">
            <textarea
              id={`${blockId}-label`}
              rows={1}
              value={title}
              onChange={(event) =>
                onTitleChange(event.target.value.replace(/\n/g, " "))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Question title"
              className="w-full resize-none overflow-hidden border-b border-transparent bg-transparent font-heading text-2xl font-semibold tracking-tight text-balance outline-none transition-colors field-sizing-content placeholder:text-muted-foreground/50 hover:border-border focus-visible:border-brand sm:text-[1.75rem] sm:leading-[1.2]"
            />
            {required ? (
              <span aria-hidden className="pt-1 text-base text-brand">
                *
              </span>
            ) : null}
          </div>
        ) : (
          <h2
            id={`${blockId}-label`}
            className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem] sm:leading-[1.2]"
          >
            {title}
            {required ? (
              <span
                aria-hidden
                className="ml-1.5 align-super text-base text-brand"
              >
                *
              </span>
            ) : null}
            {required ? <span className="sr-only"> (required)</span> : null}
          </h2>
        )}

        {onDescriptionChange ? (
          <textarea
            id={`${blockId}-description`}
            rows={1}
            value={description ?? ""}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Description (optional)"
            className="w-full resize-none border-b border-transparent bg-transparent text-[0.9375rem] text-pretty text-muted-foreground outline-none transition-colors field-sizing-content max-h-40 placeholder:text-muted-foreground/50 hover:border-border focus-visible:border-brand"
          />
        ) : description ? (
          <p
            id={`${blockId}-description`}
            className="max-w-prose text-[0.9375rem] text-pretty text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
      </div>

      {children}

      {/* Reserve the row so the layout does not jump when an error appears. */}
      <div className="min-h-5">
        {error ? (
          <p
            id={`${blockId}-error`}
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {error}
          </p>
        ) : hint ? (
          // Plain inline flow, not flex+gap: a flex gap spaces the text nodes
          // too, which pushes punctuation away from the keycap it follows
          // ("5 , or use"). Keycaps carry their own margin instead.
          <p className="text-xs leading-6 text-muted-foreground [&_kbd]:mx-0.5">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** A keycap, for the "press Enter" style hints and choice accelerators. */
export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-grid h-5 min-w-5 place-items-center rounded border bg-muted px-1 font-mono text-[11px] font-medium text-foreground/80",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * The oversized text field the runtime uses --- deliberately not
 * `components/ui/input.tsx`, which is sized for dense dashboard forms
 * (`h-8`). A question the respondent is reading one at a time gets room.
 */
export const runtimeFieldClasses = cn(
  "w-full bg-transparent pb-2.5 text-xl outline-none transition-colors",
  "border-b-2 border-border placeholder:text-muted-foreground/60",
  "hover:border-muted-foreground/40",
  "focus-visible:border-brand",
  "aria-[invalid=true]:border-destructive",
  "sm:text-2xl",
);

/**
 * Option / rating / yes-no hit area. 44px minimum per `steps.md` M2.8 --- a
 * respondent on a phone should never have to aim.
 */
export const optionBaseClasses = cn(
  "group flex w-full items-center gap-3 rounded-xl border px-4 text-left transition-all",
  "min-h-[3.25rem] py-3",
  // Focus sits on the individual option (roving tabindex), never on the
  // group --- a ring around the whole list reads as a stray nested box.
  "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  "hover:border-brand/50 hover:bg-brand/[0.04]",
);
