import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createFormGenerationGraph,
  MAX_BLOCKS,
} from "@/lib/ai/graphs/generate-form";
import {
  AiNotConfiguredError,
  AllKeysExhaustedError,
  getModel,
} from "@/lib/ai/models";
import { aiEnabled } from "@/lib/config/env";
import { getSession } from "@/lib/db/auth/session";

/**
 * Streaming form generation (`steps.md` M6.4).
 *
 * Emits one NDJSON line per graph node so the UI can say "Writing
 * questions…" instead of spinning. The graph itself knows nothing about
 * HTTP — it is handed models and returns state, and this handler owns the
 * transport (`steps.md` §1: don't make LangGraph do HTTP).
 */
const bodySchema = z.object({
  // Capped per M6.7: a prompt this size is already far more than a brief.
  brief: z.string().min(10).max(2000),
});

/** Progress copy per node, so the client does not hard-code graph internals. */
const NODE_LABELS: Record<string, string> = {
  understandIntent: "Understanding what you want to learn",
  generateBlocks: "Writing questions",
  validate: "Checking the form holds together",
  improveWording: "Tightening the wording",
};

export async function POST(request: Request) {
  // Generation costs money, so it is gated on a real session even though the
  // respondent runtime is anonymous. `getSession`, not `requireSession` ---
  // the latter redirects to /sign-in, which is right for a page and wrong
  // for an API client expecting JSON.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!aiEnabled) {
    return NextResponse.json(
      { error: "AI is not configured. Set GROQ_API_KEYS to enable it." },
      { status: 503 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  let graph: ReturnType<typeof createFormGenerationGraph>;
  try {
    graph = createFormGenerationGraph({
      fast: getModel("fast"),
      smart: getModel("smart", { temperature: 0.4 }),
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));

      try {
        let lastState: Record<string, unknown> = {};

        for await (const chunk of await graph.stream(
          { brief: parsed.data.brief },
          { streamMode: "updates" },
        )) {
          for (const [node, update] of Object.entries(
            chunk as Record<string, Record<string, unknown>>,
          )) {
            lastState = { ...lastState, ...update };
            send({
              type: "progress",
              node,
              label: NODE_LABELS[node] ?? node,
              // Surfacing retries matters: a silent second attempt looks
              // like the request simply hung.
              attempt: lastState.attempts ?? 0,
            });
          }
        }

        const draft = lastState.draft ?? null;
        const issues = (lastState.issues ?? []) as string[];

        if (!draft || issues.length > 0) {
          send({
            type: "error",
            issues: issues.length > 0 ? issues : ["Generation failed"],
          });
        } else {
          // Always a complete, valid definition or a clean error --- never a
          // half-built form (`steps.md` M6.7).
          send({ type: "result", definition: draft, maxBlocks: MAX_BLOCKS });
        }
      } catch (error) {
        // Every key spent is a distinct, temporary condition --- say so, and
        // say roughly when it is worth trying again, rather than reporting a
        // generic failure the user cannot act on.
        if (error instanceof AllKeysExhaustedError) {
          send({
            type: "error",
            code: "all_keys_exhausted",
            retryAfterSeconds: error.retryAfterSeconds,
            issues: [error.message],
          });
        } else {
          send({
            type: "error",
            issues: [
              error instanceof Error ? error.message : "Generation failed",
            ],
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
