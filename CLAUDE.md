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

## 10xDevs AI Toolkit - Module 2, Lesson 4

Prepare for a harder implementation stream with the **research-backed planning chain**:

```
internal research (/10x-research) + external research (exa.ai, Context7) -> /10x-plan -> /10x-implement -> success
```

The lesson focus is distinguishing internal from external research and using evidence to back planning decisions.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Internal research (lesson focus)** | |
| `/10x-research <change-id>` | You need evidence from the existing codebase — patterns, conventions, integration points, or existing implementations. Runs parallel sub-agents over the repo and writes structured findings to `research.md`. |
| **External research (lesson focus)** | |
| exa.ai | You need AI-native web search for library comparisons, best practices, or ecosystem context that the codebase cannot answer. |
| Context7 (`resolve-library-id` → `get-library-docs`) | You need live, current documentation for a specific library or framework. Resolves a library ID first, then fetches relevant doc pages. |
| **Framing spare wheel** | |
| `/10x-frame <change-id>` | The plan won't converge, the plan doesn't deliver expected results, or persistent drift keeps breaking the implementation. Use as an escape hatch on a separate problem (demonstrated on Space Explorers example), not as pre-research ritual. |
| **Planning and execution** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Use the same planning and execution chain from Lesson 2, now with upstream research evidence feeding the plan. |

### Research discipline

- Internal research (`/10x-research`) answers "what does our codebase already do?" — patterns, schemas, conventions, integration points.
- External research (exa.ai, Context7) answers "what should we do?" — library capabilities, API docs, ecosystem best practices.
- Combine both as evidence-backed input to `/10x-plan`. A plan without research evidence on a non-trivial stream is a guess.
- Agent-friendly docs (`llms.txt`, markdown-for-agents, `/md` endpoints) are a quality signal for library selection — libraries that publish agent-readable docs integrate faster.

### `/10x-frame` as spare wheel

Three triggers for reaching for `/10x-frame`:
1. The plan won't converge — research keeps opening more questions instead of narrowing to a contract.
2. The plan doesn't deliver — implementation repeatedly fails to meet success criteria.
3. Persistent drift — the implementation keeps diverging from the plan in ways that suggest the problem was mis-framed.

Demonstrated on a Space Explorers example, not the SRS path. It is an escape hatch, not a mandatory step.

### Paths used by this lesson

- `context/changes/<change-id>/research.md` - internal research output
- `context/changes/<change-id>/frame.md` - framing output when needed
- `context/changes/<change-id>/plan.md` - evidence-backed implementation contract
- `context/foundation/lessons.md` - recurring rules and pitfalls

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
