<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Inquirely

Plan: `.agents/plan.md` (what). Build order + exit criteria: `.agents/steps.md`
(how, in what order). Receipt of what is actually built: `.agents/done.md`.
How to approach what is left: `.agents/next-steps.md`. Read `steps.md` §1
before adding a dependency — several choices are locked with reasons, and §2
explains why the build order differs from the plan's phases.

Current state: **M0, M1 complete. M2 built and verified** except haptics,
the Playwright suite and the mobile `visualViewport` pass. **M6 steps 1–4**
(AI models, schemas, the LangGraph generation graph, its streaming route)
landed early because they depend only on M1. **M3, the builder, is core-done**
and verified end-to-end in a real browser — create, edit, reorder, autosave,
publish, answer at the public URL. Preview mode, the theme panel, and the
share panel (QR) are the deliberately-deferred tail; see `next-steps.md` §1.
**M5 is partial**: a sortable/filterable response **table** (one column per
question, sorted and filtered in SQL) plus a per-response detail view,
workspace-scoped. Status filter and substring search are in; the GIN
full-text search, per-block predicate filters, `form_events`, analytics and
exports are not.
Next: that M3 tail, the rest of M5, or M6 steps 5–6, which M3 was the only
blocker for.

## Rules

- Parse every boundary with Zod: HTTP bodies, env vars, LLM output.
- `lib/` is pure and React-free. If it needs React it belongs in `components/`.
- Never read `process.env` outside `lib/env.ts`.
- Every form/response/analytics query is scoped by `workspace_id`.
- `app/f/[slug]` is the respondent runtime: never import dashboard or builder
  code into it, or that code ships to every respondent.
- Builder mutations and AI edits share one `FormOperation` vocabulary
  (steps.md §1). Adding a second mutation path is the mistake to avoid.
- Do not build (plan.md §27): teams UI, permissions, billing, webhooks,
  integrations, templates, i18n.

## Before committing

`pnpm typecheck && pnpm lint && pnpm test && pnpm build`
