# Testing UI State + Auth Boundary — Plan Brief

> Full plan: `context/changes/testing-ui-state-auth-boundary/plan.md`

## What & Why

Phase 2 of the test rollout. Covers risks R4 (GenerateView state-machine regression) and R5 (auth boundary for new routes). Adds a component fix and tests to prove that a save failure doesn't destroy the user's accepted cards, and a middleware unit test to prove that unauthenticated requests to protected page routes get redirected.

## Starting Point

Phase 1 (`testing-r2-r3-error-paths`) established RTL, vitest config, API route unit tests, and component tests for the error-path layer. A code review during that phase discovered that `handleRetry()` in `GenerateView.tsx` always returns to `idle` — even after a save error — which silently discards the user's accepted cards.

## Desired End State

After this plan: save-error Retry returns the user to the review screen with their accepted cards intact; two RTL tests lock that behavior; a new middleware unit test proves the `PROTECTED_ROUTES` redirect mechanism works for unauthenticated users; §6.3 and §6.4 of the test-plan cookbook are filled in.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Fix component or only test | Fix + test | Test plan defines desired behavior (review on retry), not current behavior — testing current behavior protects the bug | Plan |
| Error-source tracking | `errorSource: "generate" \| "save" \| null` state | Clean, testable, doesn't change ViewState type used elsewhere | Plan |
| R5 test approach | Middleware unit test | Tests the mechanism once rather than each individual route — protects future routes from S-03 | Plan |
| jest-dom | Not installed | `.disabled` DOM property is sufficient; avoid adding a new dep | Plan (carries Plan 1 decision) |

## Scope

**In scope:**
- Fix `GenerateView.handleRetry` to go to review (not idle) after a save error
- R4 tests: saving→error preserves cards in review + accepted status visible after retry
- R5 test: middleware redirects `/generate` without session; passes `/api/flashcards/generate` through
- test-plan.md: Phase 2 status + §6.3 + §6.4 cookbook

**Out of scope:**
- `generate.test.ts` 401 test (Phase 1 decision: same mechanism, one proof enough)
- Installing `jest-dom`
- Full Supabase session integration test for middleware
- `handleGenerateMore` behavior (intended, not a regression risk)

## Architecture / Approach

`GenerateView` adds one `useState<"generate" | "save" | null>` field (`errorSource`). Both `handleGenerate` and `handleSave` catch blocks set it before transitioning to `"error"`. `handleRetry` reads it, branches to `"review"` or `"idle"`, resets to null. Middleware test mocks `defineMiddleware` as identity and `createClient` as returning null, then calls `onRequest` directly.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Fix GenerateView | `errorSource` state + fixed handleRetry | Test breaks if we don't reset errorSource after retry |
| 2. R4 component tests | R4a (review visible after retry) + R4b (✓ Zaakceptowano visible) | Tests pass trivially if assertions are too weak |
| 3. R5 middleware test | Redirect proof for `/generate`; passthrough proof for `/api/...` | `context.redirect` stub must return a Response (not void) |
| 4. test-plan.md update | Phase 2 status + §6.3 + §6.4 cookbook | Cookbook must be copy-pasteable, not just descriptive |

**Prerequisites:** Phase 1 of the rollout (`testing-r2-r3-error-paths`) complete — RTL installed, vitest config in place.  
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- `Response` constructor is available in vitest Node environment — assumed true (Node 18+); if not, the middleware test file may need `// @vitest-environment happy-dom` or a polyfill.
- `astro:middleware`'s `defineMiddleware` is truly an identity function at runtime — confirmed by reading the source; mock is safe.

## Success Criteria (Summary)

- `npm test` → all tests green after Phase 3 (no new failures)
- Save-error Retry visibly returns to review screen with accepted cards (manual, Phase 1)
- Middleware test fails when `/generate` is removed from `PROTECTED_ROUTES` (regression guard, Phase 3)
