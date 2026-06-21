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

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
