import { describe, expect, it } from "vitest";

import { randomSuffix, slugify } from "../utils/slug";

describe("slugify", () => {
  const cases: Array<[input: string, expected: string]> = [
    ["Ada Lovelace", "ada-lovelace"],
    ["  leading and trailing  ", "leading-and-trailing"],
    ["Zoë Müller", "zoe-muller"],
    ["Customer Feedback 2026!", "customer-feedback-2026"],
    ["multiple---separators___here", "multiple-separators-here"],
    ["UPPER CASE", "upper-case"],
    ["trailing hyphen -", "trailing-hyphen"],
  ];

  it.each(cases)("slugifies %j to %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("falls back when nothing survives normalisation", () => {
    expect(slugify("!!!")).toBe("untitled");
    expect(slugify("", "workspace")).toBe("workspace");
    expect(slugify("你好", "workspace")).toBe("workspace");
  });

  it("truncates long input without leaving a trailing hyphen", () => {
    const slug = slugify("a".repeat(30) + " " + "b".repeat(30));

    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("is idempotent", () => {
    for (const [input] of cases) {
      expect(slugify(slugify(input))).toBe(slugify(input));
    }
  });
});

describe("randomSuffix", () => {
  it("returns a short lowercase alphanumeric string", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomSuffix()).toMatch(/^[a-z0-9]{1,6}$/);
    }
  });
});
