import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/utils/time";

const now = new Date("2026-01-10T12:00:00Z");

describe("formatRelativeTime", () => {
  it("collapses anything under a minute to 'just now'", () => {
    expect(formatRelativeTime(new Date("2026-01-10T11:59:30Z"), now)).toBe(
      "just now",
    );
  });

  it("formats minutes", () => {
    expect(formatRelativeTime(new Date("2026-01-10T11:55:00Z"), now)).toBe(
      "5 minutes ago",
    );
  });

  it("formats hours", () => {
    expect(formatRelativeTime(new Date("2026-01-10T09:00:00Z"), now)).toBe(
      "3 hours ago",
    );
  });

  it("formats days", () => {
    expect(formatRelativeTime(new Date("2026-01-08T12:00:00Z"), now)).toBe(
      "2 days ago",
    );
  });

  it("formats future dates", () => {
    expect(formatRelativeTime(new Date("2026-01-10T13:00:00Z"), now)).toBe(
      "in 1 hour",
    );
  });
});
