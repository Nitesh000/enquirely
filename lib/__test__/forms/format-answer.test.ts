import { describe, expect, it } from "vitest";

import { formatAnswerValue } from "@/lib/forms/format-answer";
import type { FormBlock } from "@/lib/forms/schema";

const singleChoice: FormBlock = {
  id: "q1",
  title: "How did you hear about us?",
  required: false,
  type: "single_choice",
  singleChoice: {
    options: [
      { id: "google", label: "Google" },
      { id: "friend", label: "Friend" },
    ],
  },
};

const multiChoice: FormBlock = {
  id: "q2",
  title: "Which features do you use?",
  required: false,
  type: "multi_choice",
  multiChoice: {
    options: [
      { id: "forms", label: "Forms" },
      { id: "logic", label: "Logic" },
    ],
  },
};

const rating: FormBlock = {
  id: "q3",
  title: "Rate us",
  required: false,
  type: "rating",
  rating: { max: 5, style: "star" },
};

const yesNo: FormBlock = {
  id: "q4",
  title: "Would you recommend us?",
  required: false,
  type: "yes_no",
};

const shortText: FormBlock = {
  id: "q5",
  title: "Name?",
  required: false,
  type: "short_text",
  shortText: {},
};

describe("formatAnswerValue", () => {
  it("resolves a single_choice id to its label", () => {
    expect(formatAnswerValue(singleChoice, "google")).toBe("Google");
  });

  it("falls back to the raw id for an unknown option", () => {
    expect(formatAnswerValue(singleChoice, "ghost")).toBe("ghost");
  });

  it("joins multi_choice labels", () => {
    expect(formatAnswerValue(multiChoice, ["forms", "logic"])).toBe(
      "Forms, Logic",
    );
  });

  it("formats yes_no as Yes/No, not true/false", () => {
    expect(formatAnswerValue(yesNo, true)).toBe("Yes");
    expect(formatAnswerValue(yesNo, false)).toBe("No");
  });

  it("formats rating as a fraction of the scale", () => {
    expect(formatAnswerValue(rating, 4)).toBe("4 / 5");
  });

  it("passes short text through unchanged", () => {
    expect(formatAnswerValue(shortText, "Alice")).toBe("Alice");
  });

  it("returns an empty string for an undefined answer", () => {
    expect(formatAnswerValue(shortText, undefined)).toBe("");
  });
});
