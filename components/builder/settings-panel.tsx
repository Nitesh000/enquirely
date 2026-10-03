"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/utils";
import { randomSuffix } from "@/lib/utils/slug";
import type { FormBlock } from "@/lib/forms/schema";

import { useBuilderStore } from "./builder-context";
import { ToggleRow } from "./toggle-row";

/**
 * Local echo of a prop value, committed on blur rather than per keystroke
 * --- a settings field has no live-preview urgency the way the canvas
 * title does.
 *
 * Syncs to an external change (switching blocks, undo) by comparing during
 * render and calling `setState` conditionally, not inside a `useEffect` ---
 * React's own documented pattern for "adjust state when a prop changes"
 * without the extra render pass an effect would cost.
 */
function useLocalValue<T>(value: T) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  return [local, setLocal] as const;
}

function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
}: {
  label: string;
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  min?: number;
  max?: number;
}) {
  const [local, setLocal] = useLocalValue(value === undefined ? "" : String(value));

  function commit() {
    const trimmed = local.trim();
    if (trimmed === "") {
      onCommit(undefined);
      return;
    }
    const parsed = Number(trimmed);
    onCommit(Number.isFinite(parsed) ? parsed : undefined);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="text"
        inputMode="numeric"
        value={local}
        min={min}
        max={max}
        placeholder="None"
        onChange={(event) => setLocal(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </div>
  );
}

type Option = { id: string; label: string };

function OptionsEditor({
  options,
  onChange,
}: {
  options: Option[];
  onChange: (next: Option[]) => void;
}) {
  function updateLabel(id: string, label: string) {
    onChange(options.map((o) => (o.id === id ? { ...o, label } : o)));
  }

  function remove(id: string) {
    if (options.length <= 2) return; // schema requires at least 2
    onChange(options.filter((o) => o.id !== id));
  }

  function add() {
    onChange([
      ...options,
      { id: `o_${randomSuffix()}`, label: `Option ${options.length + 1}` },
    ]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">Options</Label>
      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <div key={option.id} className="flex items-center gap-1.5">
            <Input
              value={option.label}
              onChange={(event) => updateLabel(option.id, event.target.value)}
              placeholder="Option label"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={options.length <= 2}
              onClick={() => remove(option.id)}
              aria-label={`Remove ${option.label || "option"}`}
              className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            >
              <XIcon />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <PlusIcon />
        Add option
      </Button>
    </div>
  );
}

/**
 * Right pane: everything about the selected block that isn't its title or
 * body copy (those are edited in place on the canvas). One explicit form
 * per block type, mirroring `BlockRenderer`'s exhaustive switch --- not a
 * generic schema-driven renderer (`steps.md` M3.6 asks for one; this trades
 * that generality for a dozen fields that are fully typed and don't need a
 * runtime Zod-introspection layer to add an eighth field type).
 */
export function SettingsPanel() {
  const blocks = useBuilderStore((s) => s.definition.blocks);
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId);
  const dispatch = useBuilderStore((s) => s.dispatch);

  const block = blocks.find((b) => b.id === selectedBlockId);

  if (!block) {
    return (
      <p className="text-xs text-muted-foreground">
        Select a question to edit its settings.
      </p>
    );
  }

  function update(changes: Partial<FormBlock>) {
    dispatch([{ type: "update_block", id: block!.id, changes }]);
  }

  return (
    // Keyed by block id for the same reason the canvas is: these fields keep
    // local state that only commits on blur, and an unkeyed panel would carry
    // one block's half-typed value over to the next block --- then write it
    // there on the next blur.
    <div key={block.id} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Settings
        </h2>
      </div>

      <ToggleRow
        label="Required"
        hint="Respondents must answer to continue"
        checked={block.required}
        onChange={(required) => update({ required })}
      />

      {block.type === "short_text" ? (
        <NumberField
          label="Max length"
          value={block.shortText.maxLength}
          onCommit={(maxLength) => update({ shortText: { maxLength } })}
        />
      ) : null}

      {block.type === "long_text" ? (
        <NumberField
          label="Max length"
          value={block.longText.maxLength}
          onCommit={(maxLength) => update({ longText: { maxLength } })}
        />
      ) : null}

      {block.type === "number" ? (
        <>
          <NumberField
            label="Minimum"
            value={block.number.min}
            onCommit={(min) => update({ number: { ...block.number, min } })}
          />
          <NumberField
            label="Maximum"
            value={block.number.max}
            onCommit={(max) => update({ number: { ...block.number, max } })}
          />
        </>
      ) : null}

      {block.type === "single_choice" ? (
        <OptionsEditor
          options={block.singleChoice.options}
          onChange={(options) => update({ singleChoice: { options } })}
        />
      ) : null}

      {block.type === "multi_choice" ? (
        <>
          <OptionsEditor
            options={block.multiChoice.options}
            onChange={(options) =>
              update({ multiChoice: { ...block.multiChoice, options } })
            }
          />
          <NumberField
            label="Min selections"
            value={block.multiChoice.minSelected}
            onCommit={(minSelected) =>
              update({ multiChoice: { ...block.multiChoice, minSelected } })
            }
          />
          <NumberField
            label="Max selections"
            value={block.multiChoice.maxSelected}
            onCommit={(maxSelected) =>
              update({ multiChoice: { ...block.multiChoice, maxSelected } })
            }
          />
        </>
      ) : null}

      {block.type === "rating" ? (
        <>
          <NumberField
            label="Scale (2-10)"
            value={block.rating.max}
            min={2}
            max={10}
            onCommit={(next) =>
              update({
                rating: {
                  ...block.rating,
                  max: Math.min(10, Math.max(2, next ?? 5)),
                },
              })
            }
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Style</Label>
            <div className="flex gap-1.5">
              {(["star", "number"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() =>
                    update({ rating: { ...block.rating, style } })
                  }
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-1.5 text-sm capitalize outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    block.rating.style === style
                      ? "border-brand bg-brand/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
