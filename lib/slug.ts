/**
 * Slug helpers. Pure and dependency-free so they work anywhere --- workspace
 * slugs today, form slugs (`/f/[slug]`) in M2.
 */

const MAX_SLUG_LENGTH = 40;

/** Lowercase, hyphenated, ASCII-safe. Falls back to `fallback` if empty. */
export function slugify(input: string, fallback = "untitled"): string {
  const slug = input
    .normalize("NFKD")
    // Strip combining marks left behind by NFKD, so "Zoë" becomes "zoe".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    // A trailing hyphen can reappear after the slice.
    .replace(/-+$/g, "");

  return slug || fallback;
}

/** Short random suffix for resolving slug collisions. */
export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
