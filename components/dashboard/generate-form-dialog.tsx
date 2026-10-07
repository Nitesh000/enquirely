"use client";

import { CheckIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils/utils";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";

type PropType = {
  variant: "brand" | "outline";
};

const streamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    node: z.string(),
    label: z.string(),
    attempt: z.number().default(0),
  }),
  z.object({ type: z.literal("result"), definition: z.unknown() }),
  z.object({
    type: z.literal("error"),
    issues: z.array(z.string()).default([]),
    code: z.string().optional(),
    retryAfterSeconds: z.number().optional(),
  }),
]);

type Step = { node: string; label: string; attempt: number };

const MIN_BRIEF = 10;

export function GenerateFormDialog({ variant }: PropType) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const tooShort = query.trim().length < MIN_BRIEF;

  function recordStep(step: Step) {
    setSteps((prev) => {
      const seen = prev.findIndex((s) => s.node === step.node);
      return seen === -1 ? [...prev, step] : [...prev.slice(0, seen), step];
    });
  }

  function reset() {
    setSteps([]);
    setLoading(false);
  }

  async function sendQuery(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || tooShort) return;

    setLoading(true);
    setSteps([]);

    try {
      const res = await fetch("/api/ai/generate-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: query }),
      });

      if (!res.ok || !res.body) {
        toast.error(
          res.status === 401
            ? "Sign in to use AI generation."
            : res.status === 503
              ? "AI isn't configured on this server."
              : "Couldn't start generation. Try again.",
        );
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
            recordStep(event);
            continue;
          }

          if (event.type === "error") {
            if (event.code === "all_keys_exhausted") {
              const mins = Math.ceil((event.retryAfterSeconds ?? 60) / 60);
              toast.error(
                `AI quota is used up. Try again in about ${mins} min.`,
              );
            } else {
              toast.error(event.issues.join(", ") || "Generation failed.");
            }
            return;
          }

          const created = await fetch("/api/forms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ definition: event.definition }),
          });

          if (!created.ok) {
            toast.error("Generated the form but couldn't save it. Try again.");
            return;
          }

          const { id } = (await created.json()) as { id: string };
          router.push(`/forms/${id}/edit`);
          return;
        }
      }
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant}>
          <SparklesIcon />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg! w-[90vw]! md:w-[70vw]! lg:w-[60vw]!">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <motion.span
              aria-hidden
              animate={
                loading && !reducedMotion
                  ? { rotate: [0, 12, -8, 0], scale: [1, 1.12, 1] }
                  : {}
              }
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="text-brand"
            >
              <SparklesIcon className="size-4" />
            </motion.span>
            AI Survey Generation
          </DialogTitle>
          <DialogDescription>
            Add your requirement with simple language for the survey generation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={sendQuery}>
          <div className="relative">
            <Textarea
              name="query"
              placeholder="build crazy survey questions!!"
              rows={4}
              className={cn(
                "h-32 transition-all duration-300",
                loading && "pointer-events-none opacity-40 blur-[1px]",
              )}
              onChange={(e) => setQuery(e.target.value)}
              value={query}
              disabled={loading}
              minLength={MIN_BRIEF}
            />

            <AnimatePresence>
              {loading && !reducedMotion ? (
                <motion.div
                  aria-hidden
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-hidden absolute inset-0 rounded-md pointer-events-none"
                >
                  <motion.div
                    animate={{ x: ["-120%", "220%"] }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-1/3 h-full bg-gradient-to-r from-transparent to-transparent via-brand/15"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <AnimatePresence initial={false}>
            {steps.length > 0 ? (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.25 }}
                className="overflow-hidden mt-4 space-y-2"
              >
                {steps.map((step, i) => {
                  const active = i === steps.length - 1 && loading;

                  return (
                    <motion.li
                      key={step.node}
                      layout={!reducedMotion}
                      initial={{ opacity: 0, x: reducedMotion ? 0 : -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: reducedMotion ? 0 : 8 }}
                      transition={{ duration: reducedMotion ? 0 : 0.25 }}
                      className={cn(
                        "relative flex items-center gap-2.5 overflow-hidden rounded-md px-2.5 py-1.5 text-sm",
                        active
                          ? "bg-brand/5 text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      <span className="grid place-items-center size-4 shrink-0">
                        {active ? (
                          <Loader2Icon className="animate-spin size-3.5 text-brand" />
                        ) : (
                          <motion.span
                            initial={{ scale: reducedMotion ? 1 : 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 28,
                            }}
                          >
                            <CheckIcon className="size-3.5 text-brand" />
                          </motion.span>
                        )}
                      </span>

                      <span className="flex-1">{step.label}</span>

                      {step.attempt > 1 ? (
                        <span className="py-0.5 px-1.5 font-medium rounded-full bg-muted text-[0.6875rem] text-muted-foreground">
                          attempt {step.attempt}
                        </span>
                      ) : null}

                      {active && !reducedMotion ? (
                        <motion.span
                          aria-hidden
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{
                            duration: 1.8,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent to-transparent via-brand/10"
                        />
                      ) : null}
                    </motion.li>
                  );
                })}
              </motion.ul>
            ) : null}
          </AnimatePresence>

          <span className="sr-only" aria-live="polite">
            {steps.at(-1)?.label ?? ""}
          </span>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={loading}>
                Close
              </Button>
            </DialogClose>
            <Button
              disabled={loading || tooShort}
              variant={variant}
              type="submit"
            >
              {loading ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <SparklesIcon />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
