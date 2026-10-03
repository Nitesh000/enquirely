"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useBuilderStore } from "./builder-context";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

const DEBOUNCE_MS = 800;

/**
 * Debounced autosave with optimistic locking (`steps.md` M3.7).
 *
 * A save already in flight when the debounce fires again doesn't get
 * dropped --- it's queued and re-run with the latest definition once the
 * current request finishes, the same chaining `use-response-submission.ts`
 * uses for the respondent runtime's answer saves. Without that, a save that
 * lands mid-flight would silently never make it to the server.
 *
 * On a 409 (another tab published or saved first), autosave stops retrying
 * with the stale `expectedUpdatedAt` --- surfacing "conflict" and waiting
 * for the caller to reload is safer than guessing which draft should win.
 */
export function useAutosave(formId: string, initialUpdatedAt: string) {
  const definition = useBuilderStore((s) => s.definition);
  const dirty = useBuilderStore((s) => s.dirty);
  const markSaved = useBuilderStore((s) => s.markSaved);

  const [status, setStatus] = useState<SaveStatus>("idle");

  const definitionRef = useRef(definition);
  // Synced in an effect, not assigned during render --- React's hooks lint
  // now flags writing a ref outside an effect/handler even for an
  // always-keep-latest ref. `useLayoutEffect` so it's current before the
  // debounce timer in the effect below could possibly fire.
  useLayoutEffect(() => {
    definitionRef.current = definition;
  });

  const updatedAtRef = useRef(initialUpdatedAt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pendingAfterFlight = useRef(false);

  async function runSave() {
    if (inFlight.current) {
      pendingAfterFlight.current = true;
      return;
    }

    inFlight.current = true;
    setStatus("saving");

    try {
      const response = await fetch(`/api/forms/${formId}/definition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: definitionRef.current,
          expectedUpdatedAt: updatedAtRef.current,
        }),
      });

      if (response.status === 409) {
        setStatus("conflict");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }

      const data = (await response.json()) as { updatedAt: string };
      updatedAtRef.current = data.updatedAt;
      markSaved();
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
      if (pendingAfterFlight.current) {
        pendingAfterFlight.current = false;
        void runSave();
      }
    }
  }

  useEffect(() => {
    if (!dirty) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSave(), DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Deliberately keyed on `definition` + `dirty` only --- `runSave` closes
    // over refs, not state, so it doesn't need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, dirty]);

  return { status, flush: runSave };
}
