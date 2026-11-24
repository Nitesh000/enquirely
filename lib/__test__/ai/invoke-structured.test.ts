import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  invokeStructured,
  isTransientStructuredOutputFailure,
} from "@/lib/ai/invoke-structured";

const schema = z.object({ tool: z.string() });

/** A model whose bound runnable fails `failures` times, then succeeds. */
function flakyModel(errors: Error[], result: unknown = { tool: "ok" }) {
  const calls = { count: 0 };

  const model = {
    withStructuredOutput: () => ({
      invoke: async () => {
        const error = errors[calls.count];
        calls.count++;
        if (error) throw error;
        return result;
      },
    }),
  } as never;

  return { model, calls };
}

const toolUseFailed = () =>
  new Error(
    '400 {"error":{"message":"Tool choice is none, but model called a tool","code":"tool_use_failed"}}',
  );

/** The real shape: the envelope is rejected, the contents come back intact. */
const toolUseFailedWithOutput = (args: Record<string, unknown>) =>
  new Error(
    "400 " +
      JSON.stringify({
        error: {
          message: "Tool choice is none, but model called a tool",
          code: "tool_use_failed",
          failed_generation: JSON.stringify({ name: "tool_json", arguments: args }),
        },
      }),
  );

describe("isTransientStructuredOutputFailure", () => {
  it("recognises the failures that clear on a retry", () => {
    expect(isTransientStructuredOutputFailure(toolUseFailed())).toBe(true);
    expect(
      isTransientStructuredOutputFailure(new Error("Failed to parse. Text: ...")),
    ).toBe(true);
  });

  it("does not claim unrelated failures", () => {
    // Retrying these is either pointless or actively wrong.
    expect(isTransientStructuredOutputFailure(new Error("401 invalid api key"))).toBe(false);
    expect(isTransientStructuredOutputFailure(new Error("429 rate limit"))).toBe(false);
    expect(isTransientStructuredOutputFailure(undefined)).toBe(false);
  });
});

describe("invokeStructured", () => {
  it("returns the first successful result without retrying", async () => {
    const { model, calls } = flakyModel([]);

    await expect(invokeStructured(model, schema, [], { name: "t" })).resolves.toEqual({
      tool: "ok",
    });
    expect(calls.count).toBe(1);
  });

  it("retries past a transient tool_use_failed", async () => {
    vi.useFakeTimers();
    const { model, calls } = flakyModel([toolUseFailed()]);

    const promise = invokeStructured(model, schema, [], { name: "t" });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ tool: "ok" });
    expect(calls.count).toBe(2);
    vi.useRealTimers();
  });

  it("gives up after the attempt budget and rethrows the last error", async () => {
    vi.useFakeTimers();
    const { model, calls } = flakyModel([toolUseFailed(), toolUseFailed(), toolUseFailed()]);

    const promise = invokeStructured(model, schema, [], { name: "t", attempts: 3 });
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/tool_use_failed/);
    expect(calls.count).toBe(3);
    vi.useRealTimers();
  });

  it("recovers the model's output from failed_generation instead of retrying", async () => {
    const { model, calls } = flakyModel([
      toolUseFailedWithOutput({ tool: "get_question_results" }),
    ]);

    // Groq rejects the wrapper while handing back correct contents. Retrying
    // reproduces the same wrapper; the answer is already in the error.
    await expect(invokeStructured(model, schema, [], { name: "t" })).resolves.toEqual({
      tool: "get_question_results",
    });
    expect(calls.count).toBe(1);
  });

  it("does not accept recovered output that fails the schema", async () => {
    vi.useFakeTimers();
    const { model, calls } = flakyModel([
      toolUseFailedWithOutput({ wrong: "shape" }),
      toolUseFailedWithOutput({ wrong: "shape" }),
      toolUseFailedWithOutput({ wrong: "shape" }),
    ]);

    const promise = invokeStructured(model, schema, [], { name: "t", attempts: 3 });
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/tool_use_failed/);
    expect(calls.count).toBe(3);
    vi.useRealTimers();
  });

  it("rethrows a non-transient failure immediately", async () => {
    const { model, calls } = flakyModel([new Error("401 invalid api key")]);

    await expect(invokeStructured(model, schema, [], { name: "t" })).rejects.toThrow(/401/);
    // Retrying a rejected key wastes the budget and cannot succeed.
    expect(calls.count).toBe(1);
  });
});
