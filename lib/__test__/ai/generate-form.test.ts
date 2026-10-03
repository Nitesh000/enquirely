import { describe, expect, it } from "vitest";

import {
  createFormGenerationGraph,
  generateForm,
  type GenerateFormDeps,
} from "@/lib/ai/graphs/generate-form";

/**
 * The graph takes its models as dependencies, so the whole thing is testable
 * with no API key and no network: a stub stands in for the model and we
 * assert on the control flow — above all, that an invalid form sends the
 * graph back round the retry loop instead of out the door.
 */
type StubCall = { name: string };

function stubModel(
  responders: Record<string, (callIndex: number) => unknown>,
  calls: StubCall[] = [],
) {
  const counts: Record<string, number> = {};

  return {
    calls,
    withStructuredOutput(_schema: unknown, options: { name: string }) {
      return {
        invoke: async () => {
          const name = options.name;
          counts[name] = (counts[name] ?? 0) + 1;
          calls.push({ name });
          const responder = responders[name];
          if (!responder) throw new Error(`No stub for "${name}"`);
          return responder(counts[name] - 1);
        },
      };
    },
  };
}

const intent = {
  goal: "Understand churn",
  audience: "Cancelling customers",
  tone: "friendly" as const,
  targetBlockCount: 2,
};

const validForm = {
  title: "Cancellation survey",
  blocks: [
    { id: "q1", type: "short_text", title: "Why are you leaving?" },
    {
      id: "q2",
      type: "single_choice",
      title: "How long were you a customer?",
      singleChoice: {
        options: [
          { id: "lt1", label: "Less than a year" },
          { id: "gt1", label: "More than a year" },
        ],
      },
    },
  ],
};

/** Two blocks sharing an id --- caught by the real `validateDefinition`. */
const duplicateIdForm = {
  title: "Cancellation survey",
  blocks: [
    { id: "q1", type: "short_text", title: "Why are you leaving?" },
    { id: "q1", type: "short_text", title: "Anything else?" },
  ],
};

function makeDeps(
  formResponses: unknown[],
  calls: StubCall[] = [],
): GenerateFormDeps {
  const fast = stubModel(
    {
      intent: () => intent,
      wording: () => ({ blocks: [{ id: "q1", title: "Why did you cancel?" }] }),
    },
    calls,
  );

  const smart = stubModel(
    {
      form: (index) => formResponses[Math.min(index, formResponses.length - 1)],
    },
    calls,
  );

  return {
    fast: fast as unknown as GenerateFormDeps["fast"],
    smart: smart as unknown as GenerateFormDeps["smart"],
  };
}

describe("form generation graph", () => {
  it("returns a valid definition on a clean first pass", async () => {
    const result = await generateForm(makeDeps([validForm]), "Why do people cancel?");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition.blocks).toHaveLength(2);
    expect(result.definition.version).toBe(1);
  });

  it("applies schema defaults to model output", async () => {
    const result = await generateForm(makeDeps([validForm]), "brief");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The model never mentioned a theme or `required`; the real schema fills them.
    expect(result.definition.theme.preset).toBe("minimal");
    expect(result.definition.blocks[0].required).toBe(false);
  });

  it("loops back and regenerates when validation fails, then succeeds", async () => {
    const calls: StubCall[] = [];
    const result = await generateForm(
      makeDeps([duplicateIdForm, validForm], calls),
      "brief",
    );

    expect(result.ok).toBe(true);
    // Two generation calls: the rejected one, then the corrected one.
    expect(calls.filter((c) => c.name === "form")).toHaveLength(2);
  });

  it("gives up with issues rather than returning a broken form", async () => {
    const result = await generateForm(
      makeDeps([duplicateIdForm, duplicateIdForm, duplicateIdForm]),
      "brief",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("Duplicate block id");
  });

  it("stops after the retry budget instead of looping forever", async () => {
    const calls: StubCall[] = [];
    await generateForm(makeDeps([duplicateIdForm], calls), "brief");

    // MAX_VALIDATION_RETRIES = 2, so exactly two generation attempts.
    expect(calls.filter((c) => c.name === "form")).toHaveLength(2);
  });

  it("rewrites wording without changing the block set", async () => {
    const result = await generateForm(makeDeps([validForm]), "brief");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition.blocks).toHaveLength(2);
    expect(result.definition.blocks[0].title).toBe("Why did you cancel?");
    // q2 had no rewrite offered, so it keeps its original title.
    expect(result.definition.blocks[1].title).toBe(
      "How long were you a customer?",
    );
  });

  it("compiles into a runnable graph", () => {
    const graph = createFormGenerationGraph(makeDeps([validForm]));
    expect(typeof graph.invoke).toBe("function");
  });
});
