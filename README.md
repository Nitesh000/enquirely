<div align="center">

<img src="public/android-chrome-192x192.png" alt="Enquirely" width="96" height="96">

# Enquirely

**Forms worth answering.**

Describe the survey you need in a sentence. Enquirely writes it, makes it a
joy to answer on any device, and then tells you what the answers mean.

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16.3-000?logo=next.js&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19.2-087ea4?logo=react&logoColor=white">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Postgres 17" src="https://img.shields.io/badge/Postgres-17-4169e1?logo=postgresql&logoColor=white">
  <img alt="Status: M0" src="https://img.shields.io/badge/status-M0%20complete-8b5cf6">
</p>

</div>

---

## What this is

A personal project built around one idea:

> Create a survey in seconds. Answer it beautifully. Understand the results
> intelligently. Export the data however you want.

Not a Typeform clone. The bet is that the **respondent** experience is the
product — one question at a time, keyboard-first, fast on a phone — and that
everything else (builder, logic, analytics) exists to serve it.

Three experiences, in priority order:

| | |
| --- | --- |
| **Respondent runtime** | One question at a time. Enter to advance, letter keys to pick, number keys to rate. Real mobile keyboards, real tap targets, motion that guides rather than decorates. |
| **Form builder** | Describe the outcome, get a finished form, then edit anything you disagree with. Branching stored as structured rules, not nested conditions. |
| **Response analysis** | Completion and drop-off computed from your own event rows. Ask questions about the answers in plain language. Export to CSV, JSON, and real Excel workbooks. |

---

## Status

**M0 is complete** — skeleton, Postgres, auth, app shell, landing page, dark
mode, error boundaries. The one thing outstanding from M0 is the Vercel + Neon
deploy. **M1 is next**: the form schema and engine in `lib/forms/`.

| | Milestone | What lands |
| --- | --- | --- |
| ✅ | **M0** Skeleton | Repo, database, auth, route groups, app shell *(deploy pending)* |
| ▶ | **M1** Schema + engine | `FormDefinition`, answer validation, operations, navigation — pure TS, zero UI |
| | **M2** Runtime slice | Hardcoded form → answered → row in the database. **The north star.** |
| | **M3** Builder | Authoring UI over the same operations |
| | **M4** Logic | Branching in the engine and the builder |
| | **M5** Responses | Explorer, analytics, CSV/JSON/XLSX |
| | **M6** AI generation | Form generation and AI editing |
| | **M7** AI analysis | Analysis graph, response chat, charts |
| | **M8** Advanced exports | XLSX charts, AI reports, PDF |

The build order is deliberately not the plan's layering. A tracer bullet gets
one form rendering, answerable and submitted end to end *before* any authoring
UI exists, because the runtime is the part that has to be excellent and so it
should be the part iterated on longest.

Full detail: [`.agents/plan.md`](.agents/plan.md) is **what** we're building.
[`.agents/steps.md`](.agents/steps.md) is **in what order**, with exit criteria
per milestone.

---

## Getting started

Requires **Node 22+**, **pnpm**, and **Docker** for local Postgres.

```bash
pnpm install

cp .env.example .env.local   # then fill in BETTER_AUTH_SECRET
openssl rand -base64 32      # ^ use this for the secret

pnpm db:up                   # Postgres on localhost:5433
pnpm db:migrate              # apply migrations
pnpm dev                     # http://localhost:3000
```

Sign up, and you land on an empty dashboard with a personal workspace row
already created for you.

`pnpm db:up` also brings up pgAdmin on <http://localhost:5050> if you prefer it
to `pnpm db:studio`.

GitHub OAuth is optional — leave `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
empty and the button hides itself. Email and password works either way.

Every environment variable is parsed by Zod in `lib/env.ts` at module load, so
a missing or malformed value fails the boot loudly instead of at 3am.

---

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` · `pnpm start` | Production build and serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` · `pnpm test:watch` | Vitest over `lib/**/*.test.ts` |
| `pnpm db:up` · `pnpm db:down` | Local Postgres container |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push schema without a migration (dev only) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:reset` | ⚠️ Destroys the volume and re-migrates from scratch |

Before committing: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

## Layout

```
app/
  (marketing)/      public site — landing page
  (auth)/           sign-in, sign-up (redirects out if already signed in)
  (dashboard)/      authenticated shell — forms, settings
  f/[slug]/         respondent runtime. Keep this bundle small: no
                    dashboard or builder imports, ever.
  api/auth/         Better Auth handler
components/
  brand/            logo and wordmark — nothing else draws the mark
  marketing/        landing page only. `runtime-preview.tsx` is a scripted
                    mock, not the real runtime.
  dashboard/        authenticated chrome
  ui/               shadcn primitives
lib/
  env.ts            Zod-parsed environment. Never read process.env elsewhere.
  db/               Drizzle client, schema, migrations
  auth.ts           Better Auth server config
  session.ts        getSession / requireSession / requireWorkspace
  workspaces.ts     workspace bootstrap and membership checks
  forms/            (M1) schema, answers, operations, engine — pure TS
```

---

## The one architectural bet

**Builder mutations and AI edits share a single operation vocabulary.**

```ts
// lib/forms/operations.ts
type FormOperation =
  | { type: "add_block"; block: FormBlock; index: number }
  | { type: "update_block"; id: string; changes: Partial<FormBlock> }
  | { type: "delete_block"; id: string }
  | { type: "move_block"; id: string; toIndex: number }
  | { type: "add_logic"; rule: LogicRule }
  | { type: "delete_logic"; ruleId: string }
  | { type: "update_theme"; changes: Partial<FormTheme> };

function applyOperations(
  def: FormDefinition,
  ops: FormOperation[],
): FormDefinition;
```

Every UI action, every AI proposal, every undo entry is a list of
`FormOperation`. Undo/redo, AI diff preview and an audit log all fall out of
one reducer instead of three systems. Building a second mutation path for the
builder UI is the mistake this project is most likely to make.

---

## Conventions

- **Parse every boundary with Zod** — HTTP bodies, env vars, LLM output. Never
  trust a shape you did not parse.
- **`lib/` is pure and React-free.** If it needs React it belongs in
  `components/`.
- **Never read `process.env` outside `lib/env.ts`.**
- **Every form, response and analytics query is scoped by `workspace_id`** —
  written into the first version of the query, not the second.
- **`app/f/[slug]` is the respondent runtime.** Anything imported there ships
  to every respondent, so dashboard and builder code stays out.
- Vitest for `lib/` (fast, pure). Playwright for the respondent runtime only.
  No component-level suite — it won't earn its keep on a solo project.
- TypeScript `strict`, no `any` in committed code. Commit per step.
- Read [`.agents/steps.md`](.agents/steps.md) §1 before adding a dependency —
  several choices are already locked with reasons.

**Explicitly not building** ([`plan.md`](.agents/plan.md) §27): teams UI,
permissions, billing, webhooks, integrations, templates, i18n.

---

## Stack

| | | |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19 | ✅ |
| Styling | Tailwind CSS v4, shadcn/ui, Radix, Motion | ✅ |
| Database | Postgres 17, Drizzle ORM | ✅ |
| Auth | Better Auth — owns its own tables, no provider lock-in | ✅ |
| Validation | Zod v4 at every boundary | ✅ |
| Builder state | Zustand + Immer — undo/redo needs patches, Context would rerender the world | M3 |
| Charts | Recharts in the UI, ExcelJS for native chart export | M5 |
| AI | Vercel AI SDK owns the stream, LangGraph JS owns the graphs | M6 |
| Hosting | Vercel + Neon | M0 |

`✅` = installed and in use. Everything else is a locked decision, not yet a
dependency.
