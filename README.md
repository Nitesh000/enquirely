# Inquirely

A survey platform built around the person answering: describe what you want
to learn, get a form that is genuinely pleasant to fill in, then ask the
responses what they mean.

- **What** we are building: [`.agents/plan.md`](.agents/plan.md)
- **In what order**, with exit criteria per milestone:
  [`.agents/steps.md`](.agents/steps.md)

Status: **M0 complete** (skeleton, database, auth, app shell, landing page).
Next up is M1 — the form schema and engine in `lib/forms/`.

## Getting started

Requires Node 22+, pnpm, and Docker (for local Postgres).

```bash
pnpm install
cp .env.example .env.local        # then fill in BETTER_AUTH_SECRET
openssl rand -base64 32           # ^ use this for the secret

pnpm db:up                        # Postgres on localhost:5433
pnpm db:migrate                   # apply migrations
pnpm dev                          # http://localhost:3000
```

GitHub OAuth is optional. Leave `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`
empty and the button hides itself; email and password works either way.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest over `lib/**/*.test.ts` |
| `pnpm db:up` / `db:down` | Local Postgres container |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:reset` | Destroy the volume and re-migrate from scratch |

`db:reset` deletes all local data.

## Layout

```
app/
  (marketing)/      public site --- landing page
  (auth)/           sign-in, sign-up (redirects out if already signed in)
  (dashboard)/      authenticated shell --- forms, settings
  f/[slug]/         respondent runtime. Keep this bundle small: no
                    dashboard or builder imports, ever.
  api/auth/         Better Auth handler
components/
  brand/            logo --- PLACEHOLDER MARK, swap when artwork lands
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
```

## Conventions

- Parse anything crossing a boundary (HTTP body, env, LLM output) with Zod.
- Pure logic lives in `lib/` and does not import React.
- Every form, response and analytics query is scoped by `workspace_id`.
  Write the scope into the first version of the query, not the second.
- Read [`.agents/steps.md`](.agents/steps.md) §1 before adding a dependency;
  several choices are already locked with reasons.
