import { describe, expect, it } from "vitest";

import {
  createTemplateGraph,
  runTemplate,
  streamTemplate,
  type TemplateDeps,
} from "@/lib/ai/graphs/generate-form/TEMPLATE";

/**
 * The template is documentation, so it is tested like code --- a reference
 * that silently stopped working would be worse than no reference.
 */
function deps(outputs: string[]): TemplateDeps {
  let call = 0;
  return {
    produce: async () => outputs[Math.min(call++, outputs.length - 1)],
  };
}

describe("LangGraph template", () => {
  it("runs straight through when the check passes", async () => {
    const state = await runTemplate(deps(["good"]), "hello");

    expect(state.result).toBe("good");
    expect(state.attempts).toBe(1);
    expect(state.log).toContain("finished");
  });

  it("appends to log fields instead of overwriting them", async () => {
    const state = await runTemplate(deps(["good"]), "hello");

    // Four nodes each wrote one line; an accidental REPLACE reducer here
    // would leave exactly one.
    expect(state.log).toHaveLength(4);
    expect(state.log[0]).toBe("prepared: hello");
  });

  it("loops back on a failed check and succeeds on the retry", async () => {
    const state = await runTemplate(deps(["bad", "good"]), "hello");

    expect(state.result).toBe("good");
    expect(state.attempts).toBe(2);
    expect(state.issues).toEqual([]);
  });

  it("gives up at the attempt budget instead of looping forever", async () => {
    const state = await runTemplate(deps(["bad"]), "hello");

    expect(state.attempts).toBe(2);
    expect(state.issues).toEqual(["output was bad"]);
    expect(state.log).not.toContain("finished");
  });

  it("feeds the previous failure back into the retry", async () => {
    const seen: string[][] = [];
    let call = 0;
    const spyDeps: TemplateDeps = {
      produce: async (_input, issues) => {
        seen.push(issues);
        return call++ === 0 ? "bad" : "good";
      },
    };

    await runTemplate(spyDeps, "hello");

    expect(seen[0]).toEqual([]);
    // The second attempt is told what was wrong with the first.
    expect(seen[1]).toEqual(["output was bad"]);
  });

  it("streams one chunk per node", async () => {
    const nodes: string[] = [];
    await streamTemplate(deps(["good"]), "hello", (node) => nodes.push(node));

    expect(nodes).toEqual(["prepare", "produce", "check", "finish"]);
  });

  it("compiles", () => {
    expect(typeof createTemplateGraph(deps(["good"])).invoke).toBe("function");
  });
});
