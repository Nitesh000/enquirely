"use client";

import { useCallback, useRef, useState } from "react";

import type { AnswerValue } from "@/lib/forms/answers";

export type SubmissionStatus = "idle" | "saving" | "saved" | "error";

type Answers = Record<string, AnswerValue>;

/** One key per form *version*: a republished form is a different questionnaire. */
export function draftStorageKey(formId: string, versionId: string) {
  return `enquirely:draft:${formId}:${versionId}`;
}

export type StoredDraft = {
  answers: Answers;
  visited: string[];
  currentBlockId: string;
  responseId?: string;
};

export function readStoredDraft(
  formId: string,
  versionId: string,
): StoredDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(draftStorageKey(formId, versionId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft;
  } catch {
    // A corrupt draft must never block answering --- drop it and move on.
    return null;
  }
}

export function clearStoredDraft(formId: string, versionId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftStorageKey(formId, versionId));
  } catch {
    // Private mode / quota. Nothing useful to do.
  }
}

async function postWithRetry(
  url: string,
  body: unknown,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // 4xx means *we* are wrong; retrying sends the same bad payload again.
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      lastError = new Error(`Server responded ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    // 300ms, 600ms, 1200ms --- enough to ride out a dropped connection
    // without making a respondent wait on a visibly frozen screen.
    await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
  }

  throw lastError ?? new Error("Submission failed");
}

/**
 * Persistence for one respondent's run through a form.
 *
 * Writes to `localStorage` first and the server second, deliberately: a
 * typed answer must survive a refresh even if the network never comes back
 * (`plan.md` §24). The server row is created on the first answer so that
 * abandoned forms still produce drop-off data (`steps.md` M2.12).
 */
export function useResponseSubmission({
  slug,
  formId,
  versionId,
  initialResponseId,
}: {
  slug: string;
  formId: string;
  versionId: string;
  initialResponseId?: string;
}) {
  const responseIdRef = useRef<string | undefined>(initialResponseId);
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  /**
   * Saves run strictly one after another.
   *
   * Without this, the first few answers each fire before any response has
   * come back, every one of them sees an empty `responseIdRef`, and every one
   * takes the "create" branch --- one respondent ends up as several rows, and
   * the orphans look like abandoned forms to M5's drop-off maths.
   */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const persistLocally = useCallback(
    (draft: StoredDraft) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          draftStorageKey(formId, versionId),
          JSON.stringify({ ...draft, responseId: responseIdRef.current }),
        );
      } catch {
        // Quota or private mode --- the server copy still covers us.
      }
    },
    [formId, versionId],
  );

  const runSave = useCallback(
    async (answers: Answers, completed: boolean) => {
      setStatus("saving");

      try {
        const response = await postWithRetry(`/api/f/${slug}/respond`, {
          responseId: responseIdRef.current,
          answers,
          completed,
        });

        if (!response.ok) {
          setStatus("error");
          return { ok: false as const, status: response.status };
        }

        const data = (await response.json()) as { responseId?: string };
        if (data.responseId) responseIdRef.current = data.responseId;

        if (completed) clearStoredDraft(formId, versionId);

        setStatus("saved");
        return { ok: true as const, responseId: data.responseId };
      } catch {
        setStatus("error");
        return { ok: false as const, status: 0 };
      }
    },
    [slug, formId, versionId],
  );

  const save = useCallback(
    (answers: Answers, completed: boolean) => {
      const run = queueRef.current.then(() => runSave(answers, completed));
      // Swallow rejections on the chain itself, or one failed save would
      // poison every later one.
      queueRef.current = run.catch(() => undefined);
      return run;
    },
    [runSave],
  );

  return { save, persistLocally, status, responseIdRef };
}
