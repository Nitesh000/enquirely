"use client";

import { ArrowLeftIcon, ArrowRightIcon, CornerDownLeftIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useReducer, useRef } from "react";

import { Button } from "@/components/ui/button";
import { answerSchemaForBlock, type AnswerValue } from "@/lib/forms/answers";
import {
  back as engineBack,
  next as engineNext,
  progress as engineProgress,
  start,
  type RuntimeState,
} from "@/lib/forms/engine";
import type { FormDefinition } from "@/lib/forms/schema";

import { BlockRenderer } from "./blocks";
import { CompletionScreen } from "./completion-screen";
import {
  readStoredDraft,
  useResponseSubmission,
  type StoredDraft,
} from "./use-response-submission";

type RendererState = {
  runtime: RuntimeState;
  errors: Record<string, string>;
  status: "filling" | "complete";
  /** Drives direction-aware motion: forward slides up, back slides down. */
  direction: 1 | -1;
};

type RendererAction =
  | { type: "change"; value: AnswerValue | undefined }
  | { type: "submit" }
  | { type: "back" }
  | { type: "restore"; draft: StoredDraft };

function currentBlock(runtime: RuntimeState) {
  const block = runtime.definition.blocks.find(
    (candidate) => candidate.id === runtime.currentBlockId,
  );

  if (!block) {
    throw new Error(`Unknown block id: ${runtime.currentBlockId}`);
  }

  return block;
}

function reducer(state: RendererState, action: RendererAction): RendererState {
  switch (action.type) {
    case "change": {
      const { currentBlockId } = state.runtime;
      const answers = { ...state.runtime.answers };

      if (action.value === undefined) {
        delete answers[currentBlockId];
      } else {
        answers[currentBlockId] = action.value;
      }

      // Clear the error as soon as they start fixing it --- re-validating on
      // every keystroke would scold them mid-word.
      const errors = { ...state.errors };
      delete errors[currentBlockId];

      return { ...state, runtime: { ...state.runtime, answers }, errors };
    }

    case "submit": {
      const block = currentBlock(state.runtime);
      const value = state.runtime.answers[block.id];
      const result = answerSchemaForBlock(block).safeParse(value);

      if (!result.success) {
        return {
          ...state,
          errors: {
            ...state.errors,
            [block.id]: result.error.issues[0]?.message ?? "Invalid answer",
          },
        };
      }

      const advanced = engineNext(state.runtime);

      if ("done" in advanced) {
        return { ...state, status: "complete", direction: 1 };
      }

      return { ...state, runtime: advanced, direction: 1 };
    }

    case "back":
      return {
        ...state,
        runtime: engineBack(state.runtime),
        direction: -1,
      };

    case "restore": {
      const { answers, visited, currentBlockId } = action.draft;

      // Trust nothing from storage: a definition can be republished, and a
      // stale block id would crash `currentBlock`.
      const ids = new Set(state.runtime.definition.blocks.map((b) => b.id));
      if (!ids.has(currentBlockId)) return state;

      return {
        ...state,
        runtime: {
          ...state.runtime,
          answers,
          visited: visited.filter((id) => ids.has(id)),
          currentBlockId,
        },
      };
    }
  }
}

export function FormRenderer({
  definition,
  slug,
  formId,
  versionId,
}: {
  definition: FormDefinition;
  slug: string;
  formId: string;
  versionId: string;
}) {
  const reducedMotion = useReducedMotion();
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    runtime: start(definition),
    errors: {},
    status: "filling" as const,
    direction: 1 as const,
  }));

  const { save, persistLocally, status: saveStatus } = useResponseSubmission({
    slug,
    formId,
    versionId,
  });

  // Restore after mount rather than in the reducer's initialiser: reading
  // localStorage during render would disagree with the server-rendered HTML
  // and trip a hydration mismatch.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const draft = readStoredDraft(formId, versionId);
    if (draft) dispatch({ type: "restore", draft });
  }, [formId, versionId]);

  const { answers } = state.runtime;
  const answerCount = Object.keys(answers).length;
  const isComplete = state.status === "complete";

  // Save on every navigation, but only once there is something to save ---
  // writing a row for everyone who merely opens the form would make M5's
  // drop-off numbers meaningless.
  useEffect(() => {
    if (answerCount === 0) return;

    persistLocally({
      answers,
      visited: state.runtime.visited,
      currentBlockId: state.runtime.currentBlockId,
    });

    void save(answers, isComplete);
    // Intentionally keyed on position and completion, not on `answers`:
    // saving per keystroke would hammer the endpoint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.runtime.currentBlockId, isComplete, answerCount > 0]);

  if (isComplete) {
    return <CompletionScreen title={definition.title} status={saveStatus} />;
  }

  const block = currentBlock(state.runtime);
  const { current, total } = engineProgress(state.runtime);
  const error = state.errors[block.id];
  const canGoBack = state.runtime.visited.length > 0;
  const isLast = current === total;

  const offset = reducedMotion ? 0 : 14 * state.direction;

  return (
    // `flex-1`, not `min-h-dvh`: the respondent layout already owns the
    // viewport height, and claiming it twice adds a scrollbar.
    <div className="flex flex-1 flex-col">
      {/* Progress --- thin, fixed to the top, never competes with the question. */}
      <div
        className="h-1 w-full shrink-0 bg-muted"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label="Form progress"
      >
        <motion.div
          className="h-full bg-brand"
          initial={false}
          animate={{ width: `${(current / total) * 100}%` }}
          transition={{ duration: reducedMotion ? 0 : 0.35, ease: "easeOut" }}
        />
      </div>

      {/* Screen-reader announcement of each new question. */}
      <div aria-live="polite" aria-atomic className="sr-only">
        {`Question ${current} of ${total}: ${block.title}`}
      </div>

      {/* Centred on desktop, but sat higher on phones: dead-centre on a tall
          viewport buries the question under the on-screen keyboard. */}
      <main className="flex flex-1 items-start justify-center px-5 pt-[12vh] pb-12 sm:items-center sm:px-8 sm:pt-12">
        <div className="w-full max-w-xl">
          <p className="mb-5 font-mono text-xs text-brand">
            {current}
            <span className="text-muted-foreground"> / {total}</span>
          </p>

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: offset }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -offset }}
              transition={{
                duration: reducedMotion ? 0 : 0.22,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <BlockRenderer
                block={block}
                value={state.runtime.answers[block.id]}
                error={error}
                autoFocus
                onChange={(value) => dispatch({ type: "change", value })}
                onSubmit={() => dispatch({ type: "submit" })}
              />
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center gap-3">
            <Button
              variant="brand"
              size="xl"
              onClick={() => dispatch({ type: "submit" })}
            >
              {isLast ? "Submit" : "Next"}
              {isLast ? <ArrowRightIcon /> : <CornerDownLeftIcon />}
            </Button>

            {canGoBack ? (
              <Button
                variant="ghost"
                size="xl"
                onClick={() => dispatch({ type: "back" })}
              >
                <ArrowLeftIcon />
                Back
              </Button>
            ) : null}

            {!block.required ? (
              <button
                type="button"
                className="ml-auto rounded-md px-2 py-1 text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => dispatch({ type: "submit" })}
              >
                Skip
              </button>
            ) : null}
          </div>

          {saveStatus === "error" ? (
            <p className="mt-4 text-xs text-muted-foreground">
              We couldn&apos;t reach the server. Your answers are saved on this
              device and will be sent when you continue.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
