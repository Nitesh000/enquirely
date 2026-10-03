"use client";

import { CheckIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export function CompletionScreen({
  title,
  status,
}: {
  title: string;
  status?: "idle" | "saving" | "saved" | "error";
}) {
  const reducedMotion = useReducedMotion();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.3, ease: "easeOut" }}
        className="grid size-14 place-items-center rounded-2xl bg-brand text-brand-foreground"
      >
        <CheckIcon className="size-7" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion ? 0 : 0.3,
          delay: reducedMotion ? 0 : 0.1,
        }}
      >
        <h1 className="font-heading mt-7 text-2xl font-semibold tracking-tight">
          Thanks for answering
        </h1>
        <p className="mt-2.5 max-w-sm text-[0.9375rem] text-pretty text-muted-foreground">
          {status === "error"
            ? `We couldn't send your response to ${title} just yet. It is saved on this device --- reopen this link to retry.`
            : `Your response to ${title} has been recorded. You can close this tab.`}
        </p>
      </motion.div>
    </main>
  );
}
