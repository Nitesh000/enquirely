import { blockSchema, formDefinitionSchema } from "@/lib/forms/schema";
import { describe, expect, it } from "vitest";

describe("blockSchema", () => {
  const validCaes: Array<[name: string, block: unknown]> = [
    ["short_text", { id: "q1", title: "Name?", type: "short_text" }],
    [
      "long_text",
      {
        id: "q2",
        title: "Describe yourself?",
        type: "long_text",
        longText: {
          maxLength: 100,
        },
      },
    ],
    ["email", { id: "q3", title: "Email?", type: "email", required: true }],
    [
      "number",
      {
        id: "q4",
        title: "Phone Number?",
        type: "number",
        required: true,
        number: {
          min: 10,
          max: 10,
        },
      },
    ],
    [
      "single_choice",
      {
        id: "q5",
        title: "Role?",
        type: "single_choice",
        singleChoice: {
          options: [
            { id: "a", label: "Dev" },
            { id: "b", label: "Design" },
            { id: "c", label: "Manager" },
            { id: "d", label: "All of the above" },
          ],
        },
      },
    ],
    [
      "multi_choice",
      {
        id: "q6",
        title: "Tech Stack?",
        type: "multi_choice",
        multiChoice: {
          options: [
            { id: "a", label: "Typescript" },
            { id: "b", label: "Python" },
            { id: "c", label: "Golang" },
            { id: "d", label: "MERN" },
          ],
          minSelected: 1,
          maxSelected: 4,
        },
      },
    ],
    [
      "rating",
      {
        id: "q7",
        title: "Review of last company?",
        type: "rating",
        rating: {
          max: 10,
          style: "number",
        },
      },
    ],

    [
      "yes_no",
      {
        id: "q8",
        title: "Availble to work?",
        type: "yes_no",
      },
    ],
  ];

  it.each(validCaes)("accept a valid %s block", (_name, block) => {
    expect(blockSchema.safeParse(block).success).toBe(true);
  });

  it("fills in rating defualts when ommited", () => {
    const result = blockSchema.safeParse({
      id: "q4",
      title: "Rate?",
      type: "rating",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "rating") {
      expect(result.data.rating).toEqual({ max: 5, style: "star" });
    }
  });

  it("rejects single_choice with fewer than 2 options", () => {
    const result = blockSchema.safeParse({
      id: "q5",
      title: "Tech Stack?",
      type: "single_choice",
      singleChoice: {
        options: [{ id: "a", label: "MERN" }],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknow type literal", () => {
    expect(
      blockSchema.safeParse({ id: "q6", title: "?", type: "not_a_real_type" })
        .success,
    ).toBe(false);
  });
});

describe("formDefinitionSchema", () => {
  it("fills in logic and theme defaults when omitted", () => {
    const result = formDefinitionSchema.safeParse({
      version: 1,
      title: "First form",
      blocks: [],
    });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.logic).toEqual([]);
      expect(result.data.theme.preset).toEqual("minimal");
    }
  });
});
