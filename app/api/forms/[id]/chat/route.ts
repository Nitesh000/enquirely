import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createResponseChatGraph,
  type ChatStateType,
} from "@/lib/ai/graphs/response-chat/response-chat";
import {
  AiNotConfiguredError,
  AllKeysExhaustedError,
  getModel,
} from "@/lib/ai/models";
import { MIN_ROWS_FOR_CONFIDENCE } from "@/lib/ai/tools/responses";
import { aiEnabled } from "@/lib/config/env";
import { getSessionWorkspace } from "@/lib/db/auth/session";
import { loadResponsesForAnalysis } from "@/lib/db/responses/analytics";

const bodySchema = z.object({
  question: z.string().trim().min(3).max(500),
  /**
   * Prior turns, sent by the client. Capped: the classifier only needs
   * enough context to resolve a follow-up, and an unbounded transcript is a
   * prompt-size bill that grows for the rest of the session.
   */
  history: z
    .array(
      z.object({
        question: z.string().max(500),
        answer: z.string().max(4000),
      }),
    )
    .max(6)
    .default([]),
});

const NODE_LABELS: Record<string, string> = {
  classify: "Working out what to look up",
  gather: "Reading responses",
  synthesise: "Writing the answer",
};

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/forms/[id]/chat">,
) {
  const auth = await getSessionWorkspace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!aiEnabled) {
    return NextResponse.json(
      { error: "AI is not configured on this server" },
      { status: 503 },
    );
  }

  const { id } = await params;

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

  // Workspace-scoped at the query: a form id from another workspace loads
  // nothing here, so no tool the model calls can reach it either.
  const dataset = await loadResponsesForAnalysis({
    formId: id,
    workspaceId: auth.workspace.id,
  });

  if (!dataset) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  if (dataset.total === 0) {
    return NextResponse.json(
      { error: "This form has no responses to analyse yet" },
      { status: 409 },
    );
  }

  let graph: ReturnType<typeof createResponseChatGraph>;
  try {
    graph = createResponseChatGraph(
      { fast: getModel("fast"), smart: getModel("smart") },
      dataset,
    );
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: "AI is not configured on this server" },
        { status: 503 },
      );
    }
    throw error;
  }

  const encoder = new TextEncoder();

  // A reader that goes away --- navigation, a closed tab, a refresh ---
  // leaves the controller closed. Enqueueing after that throws
  // `ERR_INVALID_STATE`, which previously surfaced as a failed generation
  // even though the only thing that had failed was the delivery.
  let clientGone = false;
  request.signal.addEventListener("abort", () => {
    clientGone = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown): boolean => {
        if (clientGone) return false;

        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          return true;
        } catch {
          // Nobody is listening any more. Stop, but do not treat it as an
          // error in answering the question.
          clientGone = true;
          return false;
        }
      };

      try {
        let last: Record<string, unknown> = {};

        for await (const chunk of await graph.stream(
          { question: parsed.data.question, history: parsed.data.history },
          { streamMode: "updates" },
        )) {
          for (const [node, update] of Object.entries(
            chunk as Record<string, Record<string, unknown>>,
          )) {
            last = { ...last, ...update };

            send({
              type: "progress",
              node,
              label: NODE_LABELS[node] ?? node,
              // Surfacing the chosen tool is what lets the UI say
              // "Reading responses -> 2 matched" instead of spinning.
              tool:
                node === "classify"
                  ? ((last.intent as { tool?: string } | null)?.tool ?? null)
                  : null,
            });
          }

          // No reader left: finishing the graph would spend tokens on an
          // answer nobody can receive.
          if (clientGone) break;
        }

        const state = last as unknown as ChatStateType;

        if (state.error || !state.answer) {
          send({
            type: "error",
            issues: [state.error ?? "No answer was produced"],
          });
        } else {
          send({
            type: "result",
            answer: state.answer.answer,
            citations: state.answer.citations,
            matched: dataset.loaded,
            total: dataset.total,
            truncated: dataset.truncated,
            lowConfidence: dataset.total < MIN_ROWS_FOR_CONFIDENCE,
          });
        }
      } catch (error) {
        if (error instanceof AllKeysExhaustedError) {
          send({
            type: "error",
            code: "all_keys_exhausted",
            retryAfterSeconds: error.retryAfterSeconds,
            issues: [error.message],
          });
        } else {
          // Provider errors carry their own internals --- organisation ids,
          // upgrade URLs, raw JSON. Log them, do not stream them: the user
          // can act on "try again", not on an org id.
          console.error("[chat] graph failed", error);

          send({
            type: "error",
            issues: ["Something went wrong answering that. Try again."],
          });
        }
      } finally {
        if (!clientGone) {
          try {
            controller.close();
          } catch {
            // Already closed by the client going away.
          }
        }
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
