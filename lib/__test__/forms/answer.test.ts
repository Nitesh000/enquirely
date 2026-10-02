import { answerValueSchema } from "@/lib/forms/answers";
import { blockSchema } from "@/lib/forms/schema";
import { describe, expect, it } from "vitest";

describe("answerSchema", () => {
  const answerCases: Array<[input: unknown, output: boolean]> = [
    ["hello", true],
    [[22], false],
    [["case 1", "case 2"], true],
    [{ name: "test" }, false],
    [11, true],
    [true, true],
  ];

  it.each(answerCases)("answer cases check", (input, output) => {
    expect(answerValueSchema.safeParse(input).success).toEqual(output);
  });

  const commonSchemaBlock = {
    id: "q1",
    title: "test",
  };

  const answerSchemaForBlockCases: Array<[input: unknown, output: boolean]> = [
    [{ ...commonSchemaBlock, type: "email" }, true],
    [{ ...commonSchemaBlock, type: "whatever" }, false],
    [
      {
        ...commonSchemaBlock,
        type: "short_text",
        shortText: { maxLength: 50 },
      },
      true,
    ],
    [
      {
        ...commonSchemaBlock,
        type: "short_text",
        shortText: { minLength: 50 },
      },
      false,
    ],
    [
      {
        ...commonSchemaBlock,
        type: "number",
        number: {
          max: 10,
          min: 7,
        },
      },
      true,
    ],
    [
      {
        ...commonSchemaBlock,
        type: "single_choice",
        singleChoice: {
          options: [
            {
              id: "a",
              label: "opt 1",
            },
          ],
        },
      },
      false,
    ],
    [
      {
        ...commonSchemaBlock,
        type: "single_choice",
        singleChoice: { options: [] },
      },
      false,
    ],
    [
      {
        ...commonSchemaBlock,
        type: "rating",
        rating: {
          max: 10,
        },
      },
      true,
    ],
    [
      {
        ...commonSchemaBlock,
        type: "rating",
        rating: {
          theme: "test",
        },
      },
      false,
    ],
  ];

  it.each(answerSchemaForBlockCases)(
    "answer schema for block",
    (input, output) => {
      expect(blockSchema.safeParse(input).success).toBe(output);
    },
  );
});
