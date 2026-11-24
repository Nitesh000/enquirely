"use client";

import { Loader2Icon, SendIcon, SparklesIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const streamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    node: z.string(),
    label: z.string(),
    tool: z.string().nullable().default(null),
  }),
  z.object({
    type: z.literal("result"),
    answer: z.string(),
    citations: z.array(z.string()).default([]),
    truncated: z.boolean().default(false),
    lowConfidence: z.boolean().default(false),
    total: z.number().default(0),
  }),
  z.object({
    type: z.literal("error"),
    issues: z.array(z.string()).default([]),
    code: z.string().optional(),
    retryAfterSeconds: z.number().optional(),
  }),
]);

type Turn = {
  question: string;
  answer: string;
  citations: string[];
  truncated: boolean;
  lowConfidence: boolean;
};

const MIN_QUESTION = 3;

export function ResponseChat({ formId }: { formId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reducedMotion = useReducedMotion();
  const tooShort = question.trim().length < MIN_QUESTION;

  async function ask(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || tooShort) return;

    const asked = question.trim();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(`/api/forms/${formId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: asked,
          // Only the last few turns: enough for "and what about designers?"
          // to resolve, without the prompt growing all session.
          history: turns.slice(-3).map((t) => ({
            question: t.question,
            answer: t.answer,
          })),
        }),
      });

      if (!res.ok || !res.body) {
        const message =
          res.status === 409
            ? "No responses to analyse yet."
            : res.status === 503
              ? "AI isn't configured on this server."
              : "Couldn't start. Try again.";
        toast.error(message);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const parsed = streamEventSchema.safeParse(JSON.parse(line));
          if (!parsed.success) continue;
          const event = parsed.data;

          if (event.type === "progress") {
            setStatus(event.label);
            continue;
          }

          if (event.type === "error") {
            if (event.code === "all_keys_exhausted") {
              const mins = Math.ceil((event.retryAfterSeconds ?? 60) / 60);
              toast.error(`AI quota is used up. Try again in about ${mins} min.`);
            } else {
              toast.error(event.issues.join(", ") || "Couldn't answer that.");
            }
            return;
          }

          setTurns((prev) => [
            ...prev,
            {
              question: asked,
              answer: event.answer,
              citations: event.citations,
              truncated: event.truncated,
              lowConfidence: event.lowConfidence,
            },
          ]);
          setQuestion("");
        }
      }
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <section className="rounded-xl border bg-background p-4">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
        <SparklesIcon className="size-4 text-brand" />
        Ask about these responses
      </h2>

      <AnimatePresence initial={false}>
        {turns.map((turn, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
            className="mt-4 space-y-2"
          >
            <p className="text-sm font-medium">{turn.question}</p>
            <p className="text-sm text-pretty text-muted-foreground">
              {turn.answer}
            </p>

            {turn.lowConfidence || turn.truncated ? (
              <p className="text-xs text-muted-foreground/80">
                {turn.lowConfidence
                  ? "Based on very few responses — treat as indicative only."
                  : "Based on the most recent responses, not the full set."}
              </p>
            ) : null}

            {turn.citations.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-xs text-muted-foreground">
                  Based on {turn.citations.length}{" "}
                  {turn.citations.length === 1 ? "response" : "responses"}
                </span>
                {turn.citations.map((id, n) => (
                  <Link
                    key={id}
                    href={`/forms/${formId}/responses/${id}`}
                    // Numbered, not a truncated id: eight hex characters of a
                    // UUID identify nothing to a reader, and the point of a
                    // citation is that it can be followed.
                    title={`Open response ${id}`}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground tabular-nums hover:bg-muted/70 hover:text-foreground"
                  >
                    {n + 1}
                  </Link>
                ))}
              </div>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {status ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2Icon className="size-3.5 animate-spin text-brand" />
            {status}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <form onSubmit={ask} className="mt-4 flex items-end gap-2">
        <Textarea
          rows={1}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="What are developers who rated below 3 complaining about?"
          disabled={loading}
          className="field-sizing-content max-h-32 min-h-9 resize-none"
        />
        <Button type="submit" variant="brand" size="sm" disabled={loading || tooShort}>
          {loading ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          Ask
        </Button>
      </form>

      <span className="sr-only" aria-live="polite">
        {status ?? turns.at(-1)?.answer ?? ""}
      </span>
    </section>
  );
}
