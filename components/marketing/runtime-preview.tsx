"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * MARKETING MOCK --- not the form runtime.
 *
 * This is a scripted loop that shows what answering an Enquirely form feels
 * like. It has no engine, no validation and no state machine behind it.
 * The real runtime arrives in M2 under `components/form/` and must never
 * import from here (nor this from there): letting a marketing animation and
 * the product share code is how the product ends up serving the animation.
 */

type PreviewQuestion = {
  index: number;
  kind: "choice" | "rating" | "text";
  prompt: string;
  hint: string;
  options?: string[];
  answer: string;
};

const script: PreviewQuestion[] = [
  {
    index: 1,
    kind: "choice",
    prompt: "What best describes your role?",
    hint: "Press a letter to choose",
    options: ["Developer", "Designer", "Product manager", "Something else"],
    answer: "Developer",
  },
  {
    index: 2,
    kind: "rating",
    prompt: "How easy was it to get started?",
    hint: "Press 1–5, or use the arrow keys",
    answer: "4",
  },
  {
    index: 3,
    kind: "text",
    prompt: "What nearly made you give up?",
    hint: "Press Enter to continue",
    answer: "Honestly, nothing. It took about a minute.",
  },
];

const LETTERS = ["A", "B", "C", "D"];
const STEP_MS = 3600;

export function RuntimePreview() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [step, paused]);

  const question = script[step % script.length];
  const progress = ((step % script.length) + 1) / script.length;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-card shadow-xl shadow-black/[0.06] dark:shadow-black/40"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Browser chrome, so it reads as "a real form at a real URL". */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <div className="ml-2 truncate rounded-md bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
          Enquirely.com/f/onboarding-check
        </div>
      </div>

      {/* Fixed height so the card does not resize between questions --- tall
          enough for the longest step (four choices plus the hint). */}
      <div className="relative h-[24rem] px-6 py-8 sm:px-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-6 top-8 sm:inset-x-10"
          >
            <p className="mb-3 font-mono text-xs text-brand">
              {question.index} &rarr;
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              {question.prompt}
            </h3>

            <div className="mt-6">
              {question.kind === "choice" ? (
                <ul className="grid gap-2">
                  {question.options?.map((option, i) => (
                    <li key={option}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                          option === question.answer
                            ? "border-brand bg-brand/10 text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        <kbd
                          className={cn(
                            "grid size-6 place-items-center rounded-md border font-mono text-[11px]",
                            option === question.answer
                              ? "border-brand bg-brand text-brand-foreground"
                              : "bg-muted",
                          )}
                        >
                          {LETTERS[i]}
                        </kbd>
                        {option}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {question.kind === "rating" ? (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <div
                      key={value}
                      className={cn(
                        "grid size-12 place-items-center rounded-xl border text-sm font-medium transition-colors",
                        value <= Number(question.answer)
                          ? "border-brand bg-brand/10 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {value}
                    </div>
                  ))}
                </div>
              ) : null}

              {question.kind === "text" ? (
                <div className="border-b-2 border-brand pb-2 text-lg">
                  <TypedAnswer text={question.answer} instant={!!reducedMotion} />
                </div>
              ) : null}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">{question.hint}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="h-1 w-full bg-muted">
        <motion.div
          className="h-full bg-brand"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function TypedAnswer({ text, instant }: { text: string; instant: boolean }) {
  // Remounted on every step (the parent keys on `step`), so the count always
  // starts at zero without an effect resetting it.
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (instant || typed >= text.length) return;
    const timer = setTimeout(() => setTyped(typed + 1), 34);
    return () => clearTimeout(timer);
  }, [instant, typed, text.length]);

  const shown = instant ? text : text.slice(0, typed);

  return (
    <span>
      {shown}
      {!instant && shown.length < text.length ? (
        <span className="ml-0.5 inline-block h-5 w-px animate-pulse bg-brand align-middle" />
      ) : null}
    </span>
  );
}
