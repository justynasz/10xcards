<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Testing UI State + Auth Boundary

- **Plan**: context/changes/testing-ui-state-auth-boundary/plan.md
- **Scope**: All phases (Phase 1–4 of 4)
- **Date**: 2026-06-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 5 observations (3 fixed, 1 skipped, 1 fixed)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Error heading hardcoded to "Generowanie" even for save errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/generate/GenerateView.tsx (error view heading)
- **Detail**: The error heading always showed "Generowanie nie powiodło się" regardless of whether the error came from generate or save. After adding `errorSource` state to fix `handleRetry`, the heading was not updated to branch on it. Save errors showed the wrong message.
- **Fix**: Branch the heading on `errorSource === "save"` to show "Zapisanie nie powiodło się" for save errors. Update R2/R4a/R4b test assertions accordingly.
- **Decision**: FIXED — heading now branches on errorSource; 3 test assertions updated.

### F2 — Middleware test missing authenticated-user path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/__tests__/middleware.test.ts
- **Detail**: Two tests cover unauthenticated paths (redirect + API pass-through) but the authenticated-user branch (`locals.user` assignment) had no test. A regression in the `getUser` → `locals.user` assignment would be invisible.
- **Fix**: Add a third test: mock `createClient` to return a fake Supabase client with `auth.getUser` resolving to a user, call handler on `/generate`, assert `next()` called and `ctx.locals.user` equals the fake user.
- **Decision**: FIXED — third test added; 39/39 pass.

### F3 — R4b assertion used `.toBeDefined()` instead of `findByText`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/generate/__tests__/GenerateView.test.tsx:86
- **Detail**: `expect(screen.getByText(/Zapisz 1/i)).toBeDefined()` is a synchronous query on async state — always passes even before the DOM updates. The R4b test proved "Zapisz 1" appeared but didn't wait for it to actually render.
- **Fix**: Replace with `await screen.findByText(/Zapisz 1/i)` — async findBy waits up to the timeout and fails clearly if the element never appears.
- **Decision**: FIXED

### F4 — Double `unknown` cast in middleware.test.ts

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/__tests__/middleware.test.ts:19
- **Detail**: `const handler = onRequest as unknown as TestHandler`. Hand-rolled `TestHandler` type means if `onRequest`'s signature changes, the cast silently keeps tests passing. `MiddlewareHandler` from `astro` would be the canonical target type.
- **Fix**: Import `MiddlewareHandler` from `'astro'` and use it instead of `TestHandler`.
- **Decision**: SKIPPED — `TestHandler` is readable and sufficient for the test scope; `MiddlewareHandler` has a more complex signature that complicates stubs.

### F5 — No `@vitest-environment` directive on middleware.test.ts

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/__tests__/middleware.test.ts:1
- **Detail**: `GenerateView.test.tsx` pins `// @vitest-environment jsdom`. The middleware test uses `Request`/`Response` without pinning `node`. If the vitest default environment changes, test assumptions break silently.
- **Fix**: Add `// @vitest-environment node` at line 1.
- **Decision**: FIXED
