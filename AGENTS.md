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
landed early because they depend only on M1. Next is **M3, the builder** —
it blocks the rest of M6.

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
