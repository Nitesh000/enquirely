/**
 * ============================================================================
 * LangGraph template — read this before writing a new graph.
 * ============================================================================
 *
 * This file is a working reference, not dead code: `TEMPLATE.test.ts` runs it.
 * Copy it, rename the state fields and nodes, delete what you don't need.
 *
 * WHEN TO REACH FOR A GRAPH AT ALL
 * --------------------------------
 * `plan.md` §9 is blunt about this: LangGraph is for genuinely agentic work.
 * Do not put a graph in front of ordinary CRUD. A graph earns its complexity
 * when at least one of these is true:
 *
 *   1. A step's output must be CHECKED, and failure means going back —
 *      that loop is the thing a single prompt cannot do.
 *   2. The path branches on content ("is this a search or a stats question?").
 *   3. You need per-step progress surfaced to a user.
 *   4. Steps need to resume after interruption.
 *
 * If it's "prompt in, text out", call the model directly. A graph around one
 * node is just a slower function call.
 *
 * THE FOUR CONCEPTS
 * -----------------
 * STATE    One object threaded through every node. Nodes return a PARTIAL
 *          update, never the whole thing.
 * REDUCER  Per-field rule for merging that partial update into state. This is
 *          where most confusion lives — see `log` vs `step` below.
 * NODE     An async function: (state) => partial update. Plain TypeScript.
 * EDGE     What runs next. Fixed (`addEdge`) or chosen at runtime
 *          (`addConditionalEdges`) — conditional edges are what make loops
 *          and branches possible.
 */

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

/**
 * ---------------------------------------------------------------------------
 * 1. STATE
 * ---------------------------------------------------------------------------
 * Each field needs a `reducer` (how to merge an update) and a `default`
 * (the value before anything runs).
 *
 * The two reducers you will use constantly:
 *
 *   (_, next) => next        REPLACE. Last write wins. Use for scalars.
 *   (prev, next) => prev.concat(next)   APPEND. Use for logs, messages,
 *                                       collected evidence.
 *
 * Getting this wrong is the classic first bug: give a log field a REPLACE
 * reducer and each node silently erases the previous node's entries.
 */
const TemplateState = Annotation.Root({
  /** REPLACE: the input, set once at invoke time. */
  input: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  /** REPLACE: a counter the loop guard reads. */
  attempts: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  /** APPEND: every node adds to this; nothing is lost. */
  log: Annotation<string[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  /** REPLACE: problems found by the check node, fed back on a retry. */
  issues: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  /** REPLACE: the thing being built. `null` until a node produces it. */
  result: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

/** The inferred state type. Use this for node signatures and callers. */
export type TemplateStateType = typeof TemplateState.State;

/**
 * Dependencies are INJECTED, never imported inside the graph.
 *
 * `lib/` is pure (`AGENTS.md`), and more practically: a graph that reaches
 * for its own API key cannot be unit tested. Pass models in, and tests swap
 * in a stub — which is exactly how `generate-form.test.ts` exercises the
 * retry loop with no network and no key.
 */
export type TemplateDeps = {
  /** Stand-in for a model call. Replace with `BaseChatModel`. */
  produce: (input: string, issues: string[]) => Promise<string>;
};

/** Stop runaway loops. Always have one of these. */
const MAX_ATTEMPTS = 2;

export function createTemplateGraph(deps: TemplateDeps) {
  const graph = new StateGraph(TemplateState)
    /**
     * -----------------------------------------------------------------------
     * 2. NODES
     * -----------------------------------------------------------------------
     * A node is just an async function returning a PARTIAL state update.
     * Return only what changed — the reducers handle merging.
     */
    .addNode("prepare", async (state) => {
      return { log: [`prepared: ${state.input}`] };
    })

    .addNode("produce", async (state) => {
      // On a retry, the previous failure's issues are passed back in. This is
      // the whole point of looping: the second attempt knows what was wrong.
      const result = await deps.produce(state.input, state.issues);

      return {
        result,
        attempts: state.attempts + 1,
        log: [`produced (attempt ${state.attempts + 1})`],
      };
    })

    .addNode("check", async (state) => {
      // Validate with REAL product code, not a second AI-specific checker.
      // In the form graph this line is `validateDefinition(state.draft)`.
      const issues = state.result?.includes("bad") ? ["output was bad"] : [];

      return { issues, log: [`checked: ${issues.length} issue(s)`] };
    })

    .addNode("finish", async () => {
      return { log: ["finished"] };
    })

    /**
     * -----------------------------------------------------------------------
     * 3. EDGES
     * -----------------------------------------------------------------------
     * START and END are the graph's entry and exit. Fixed edges are a
     * straight line.
     */
    .addEdge(START, "prepare")
    .addEdge("prepare", "produce")
    .addEdge("produce", "check")

    /**
     * Conditional edges: a function reads state and returns a KEY; the map
     * turns that key into the next node. Returning the name of an EARLIER
     * node is what makes a loop — there is no special "loop" construct.
     *
     * Always include a give-up branch. Without the `attempts` guard this
     * cycles until the recursion limit, burning tokens on every pass.
     */
    .addConditionalEdges(
      "check",
      (state) => {
        if (state.issues.length === 0) return "ok";
        return state.attempts >= MAX_ATTEMPTS ? "giveUp" : "retry";
      },
      {
        ok: "finish",
        retry: "produce", // ← backwards edge = the loop
        giveUp: END,
      },
    )
    .addEdge("finish", END);

  /**
   * `.compile()` validates the shape (unreachable nodes, dangling edges) and
   * returns something with `.invoke()` and `.stream()`.
   *
   * Pass `{ checkpointer: new MemorySaver() }` here when a graph needs to
   * pause and resume across requests — not needed for one-shot runs.
   */
  return graph.compile();
}

/**
 * ---------------------------------------------------------------------------
 * 4. RUNNING IT
 * ---------------------------------------------------------------------------
 * `invoke` → final state only.
 * `stream({ streamMode: "updates" })` → one chunk per node, shaped
 *   `{ [nodeName]: partialUpdate }`. That is what the generate-form route
 *   turns into "Writing questions…" progress lines.
 *
 * Keep HTTP out of the graph. The route owns the transport; the graph owns
 * the state machine (`steps.md` §1).
 */
export async function runTemplate(deps: TemplateDeps, input: string) {
  const graph = createTemplateGraph(deps);
  return graph.invoke({ input });
}

export async function streamTemplate(
  deps: TemplateDeps,
  input: string,
  onNode: (node: string, update: Record<string, unknown>) => void,
) {
  const graph = createTemplateGraph(deps);

  for await (const chunk of await graph.stream(
    { input },
    { streamMode: "updates" },
  )) {
    for (const [node, update] of Object.entries(
      chunk as Record<string, Record<string, unknown>>,
    )) {
      onNode(node, update);
    }
  }
}
