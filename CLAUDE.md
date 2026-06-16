# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

**10xCards** — an AI-powered flashcard generator with spaced repetition. The core loop: user pastes text → AI generates question/answer card proposals → user accepts/edits/discards each → accepted cards enter a spaced-repetition study queue. See `context/foundation/prd.md` for full requirements.

The codebase is currently at the starter-template stage. The auth scaffold is complete; the flashcard generation, deck management, and spaced-repetition features are not yet implemented.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier
- `npm test` — run tests once (vitest)
- `npm run test:watch` — vitest in watch mode

Pre-commit hooks (husky + lint-staged): ESLint on `*.{ts,tsx,astro}`, Prettier on `*.{json,css,md}`.

## Architecture

**Astro 6 SSR** with React 19 islands, Tailwind 4, Supabase auth, shadcn/ui. Deployed to Cloudflare Workers.

All pages are server-rendered (`output: "server"`). API routes must export `const prerender = false`.

### Supabase client

`src/lib/supabase.ts` exports `createClient()` which **returns `null`** when `SUPABASE_URL` / `SUPABASE_KEY` are missing. Every caller must guard against null before using the client.

### Env vars

Env vars are declared via Astro's typed `astro:env/server` schema (configured in `astro.config.mjs`), not `import.meta.env` or `process.env`. Import them as:

```ts
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
```

For local dev: copy `.env.example` to `.dev.vars` (Cloudflare workerd reads `.dev.vars`). For Node-only use, copy to `.env`.

### Request lifecycle

1. `src/middleware.ts` runs on every request — creates a Supabase client, resolves `user` from the session cookie, attaches it to `context.locals.user`. Routes in `PROTECTED_ROUTES` redirect unauthenticated users to `/auth/signin`.
2. Pages access the resolved user via `Astro.locals.user` (typed in `src/env.d.ts` as `User | null`).
3. API routes create their own Supabase client via `createClient(context.request.headers, context.cookies)`.

### Auth

- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Auth errors are returned as URL query params: `?error=<encoded-message>`
- Protected routes are declared in the `PROTECTED_ROUTES` array in `src/middleware.ts`

### Key conventions

- **Path alias**: `@/*` → `./src/*`
- **Astro components** for static content/layout; **React components** only when interactivity is needed
- **Tailwind class merging**: always use `cn()` from `@/lib/utils` — never concatenate class strings manually
- **shadcn/ui**: components in `src/components/ui/`, "new-york" variant. Add with `npx shadcn@latest add [name]`
- **API routes**: uppercase `GET`/`POST` exports; validate input with Zod
- **Hooks**: extract to `src/components/hooks/`
- **Module structure**: every module under `src/lib/` must contain `index.ts`, `types.ts`, and `__tests__/`
- **Services/helpers**: `src/lib/` or `src/lib/services/` for extracted business logic
- **Shared types**: `src/types.ts`
- **Supabase migrations**: `supabase/migrations/` with `YYYYMMDDHHmmss_description.sql`. Always enable RLS with per-operation, per-role policies

### Missing config banner

`src/layouts/Layout.astro` renders error banners for missing env vars using `missingConfigs` from `src/lib/config-status.ts`. When adding new required env vars, register them there.

## Deploy

```bash
npm run build
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as Cloudflare secrets via `npx wrangler secret put` or the dashboard.

## CI

`.github/workflows/ci.yml` — lint + build on every push/PR to `master`. Requires `SUPABASE_URL` and `SUPABASE_KEY` as GitHub repository secrets.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
