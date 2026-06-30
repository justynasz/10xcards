# Testing UI State + Auth Boundary — Implementation Plan

## Overview

Phase 2 of the test rollout plan. Fixes a discovered bug in GenerateView's error recovery and adds tests for R4 (state machine regression) and R5 (auth boundary mechanism). Four phases: fix the component, test the fix, test the middleware, update the test-plan cookbook.

## Current State Analysis

### GenerateView state machine (R4)

`handleRetry()` in `GenerateView.tsx:80` always sets `viewState("idle")`, sending the user back to the text-input screen regardless of whether the error came from generate or save. Per the test plan, after a batch-save error the user should return to `review` state with their accepted cards preserved.

Current flow:
- `handleGenerate` error → `viewState("error")` → `handleRetry()` → `viewState("idle")` ✓ correct
- `handleSave` error → `viewState("error")` → `handleRetry()` → `viewState("idle")` ✗ should go to `"review"`

### Auth boundary (R5)

`src/middleware.ts` exports `onRequest = defineMiddleware(fn)`. `defineMiddleware` from `astro:middleware` is an identity wrapper so `onRequest` can be unit-tested by:
1. Mocking `astro:middleware` (`defineMiddleware: (fn) => fn`)
2. Mocking `@/lib/supabase` (`createClient` returning `null` → user becomes `null`)
3. Calling `onRequest(fakeContext, fakeNext)` and asserting the response

`PROTECTED_ROUTES` (currently): `["/dashboard", "/generate", "/review", "/flashcards", "/account"]`  
API routes (`/api/flashcards/...`) are NOT in `PROTECTED_ROUTES` — they use their own `user === null → 401` guard (already tested in Phase 1 of the rollout).

### Existing test infrastructure (carry-overs from Phase 1)

- `// @vitest-environment jsdom` docblock required per component test file (vitest 4 glob doesn't match absolute paths)
- `vi.mock(...)` calls must appear before imports (vitest hoisting)
- `cleanup()` from RTL required in `afterEach` (not automatic in vitest)
- `vi.clearAllMocks()` in `afterEach` for route/mock-heavy files
- `.disabled` DOM property instead of `.toBeDisabled()` (jest-dom not installed)

## Desired End State

1. `GenerateView` returns to `review` state after a batch-save error, with accepted cards visible
2. R4 component tests cover saving→error recovery and accepted-status preservation
3. R5 middleware test proves unauthenticated requests to protected page routes get redirected
4. `test-plan.md` Phase 2 marked "change opened"; §6.3 + §6.4 cookbook filled in
5. `npm test` → all tests green; `npm run lint` → 0 errors

### Key Discoveries:

- `GenerateView.tsx:80` — `handleRetry` always returns to idle; needs `errorSource` state to differentiate
- `CardReviewItem.tsx:93` — accepted cards render `✓ Zaakceptowano` span; good RTL assertion target
- Save button text format: `Zapisz ${acceptedCount} ${cardForm(acceptedCount)}` — count assertable
- `middleware.ts:4` PROTECTED_ROUTES — `/generate` is in the list; `/api/flashcards/generate` is not

## What We're NOT Doing

- Not adding `jest-dom` — existing pattern uses `.disabled` DOM property
- Not testing `handleGenerateMore` (goes to idle, clears cards — intended, not a regression risk)
- Not adding a 401 auth test to `generate.test.ts` — Phase 1 scope decision: "same mechanism as batch-create; one proof is enough"; R5 middleware test is the mechanism proof
- Not testing the full Supabase session flow (integration with real Supabase) — null-client mock is sufficient

## Implementation Approach

Fix the component first (Phase 1), then verify the fix with tests (Phase 2), then add the middleware test (Phase 3), then close out the test-plan documentation (Phase 4). Each phase is a clean commit.

## Critical Implementation Details

- **errorSource reset**: `handleRetry` must reset `errorSource` to `null` after branching, so a subsequent generate error after a save-error-recovery doesn't mistakenly go to review.
- **Middleware mock ordering**: both `vi.mock("astro:middleware", ...)` and `vi.mock("@/lib/supabase", ...)` must appear before `import { onRequest }` due to vitest hoisting.
- **context.redirect stub**: middleware calls `return context.redirect("/auth/signin")`. The stub must return a `Response` so assertions on `response.status` work: `redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } })`.

---

## Phase 1: Fix GenerateView state machine

### Overview

Add `errorSource` state to `GenerateView` to distinguish save errors from generate errors. Fix `handleRetry` to return to `review` when recovering from a save error, and to `idle` when recovering from a generate error.

### Changes Required:

#### 1. GenerateView — add errorSource state and fix handleRetry

**File**: `src/components/generate/GenerateView.tsx`

**Intent**: The component needs to remember which step failed so `handleRetry` can route the user to the right previous state.

**Contract**:
- New `useState<"generate" | "save" | null>(null)` field `errorSource`.
- `handleGenerate` catch block: add `setErrorSource("generate")` before `setViewState("error")`.
- `handleSave` catch block: add `setErrorSource("save")` before `setViewState("error")`.
- `handleRetry`: if `errorSource === "save"` call `setViewState("review")`; else call `setViewState("idle")`; then `setErrorSource(null)`.

### Success Criteria:

#### Automated Verification:

- All existing tests still pass: `npm test`
- No lint errors: `npm run lint`

#### Manual Verification:

- Generate cards → accept one → click Save → simulate 500 response from batch-create → error panel appears → click "Spróbuj ponownie" → lands on "Przejrzyj fiszki" with the same card showing "✓ Zaakceptowano"
- Generate cards → simulate 500 from generate → error panel appears → click "Spróbuj ponownie" → lands on text-input (idle), NOT on review

**Implementation Note**: After all automated checks pass, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: R4 component tests

### Overview

Extend the existing `GenerateView.test.tsx` with two R4 tests that verify the state-machine fix: saving→error Retry goes to review (not idle), and accepted-status text is still visible after the round-trip.

### Changes Required:

#### 1. Extend GenerateView test suite with R4a and R4b

**File**: `src/components/generate/__tests__/GenerateView.test.tsx`

**Intent**: Add two tests inside the existing `describe("GenerateView")` block. R4a verifies that after a save error, clicking Retry returns the user to the review screen. R4b additionally checks that the accepted card still shows "✓ Zaakceptowano" — proving accepted status survived the error cycle.

**Contract**:
- Both tests use existing `ENOUGH_TEXT`, `makeJsonResponse`, and `vi.stubGlobal("fetch", ...)` pattern.
- R4a fetch stub: first call returns `{ cards: [{ front: "Q", back: "A" }] }` (200 ok); second returns `{ error: "Failed to save..." }` (500). Flow: render → type → Generuj → await "Przejrzyj fiszki" → Akceptuj → Zapisz → await error message → click "Spróbuj ponownie" → assert `findByText(/Przejrzyj fiszki/i)`.
- R4b: same fetch stub and flow as R4a, then additionally assert `findByText(/Zaakceptowano/i)` after retry.

### Success Criteria:

#### Automated Verification:

- All tests including new R4a + R4b pass: `npm test`
- No lint errors: `npm run lint`

#### Manual Verification:

- R4a test fails if `handleRetry` is reverted to always call `setViewState("idle")`
- R4b test fails if `cards` state is cleared on retry

**Implementation Note**: After all automated checks pass, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: R5 middleware unit test

### Overview

New test file for the middleware module. Proves that unauthenticated requests to protected page routes get a 302 redirect, and that API routes fall through middleware without being caught by `PROTECTED_ROUTES`.

### Changes Required:

#### 1. New middleware test file

**File**: `src/__tests__/middleware.test.ts`

**Intent**: Unit-test `onRequest` in isolation — no HTTP server, no Astro runtime. Two scenarios: (a) `/generate` without session → redirect 302; (b) `/api/flashcards/generate` without session → `next()` called (not a protected route).

**Contract**:
```
vi.mock("astro:middleware", () => ({ defineMiddleware: (fn) => fn }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn().mockReturnValue(null) }));
import { onRequest } from "../../middleware";

function makeContext(pathname: string): unknown {
  return {
    url: new URL("http://localhost" + pathname),
    locals: {},
    request: new Request("http://localhost" + pathname),
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    cookies: {},
  };
}

// test (a): expect(response.status).toBe(302); expect(response.headers.get("location")).toContain("/auth/signin")
// test (b): expect(next).toHaveBeenCalled();
```
`next` is `vi.fn().mockResolvedValue(new Response("ok", { status: 200 }))`.

### Success Criteria:

#### Automated Verification:

- All tests including new middleware tests pass: `npm test`
- No lint errors: `npm run lint`

#### Manual Verification:

- Test (a) fails if `/generate` is removed from `PROTECTED_ROUTES` in `middleware.ts`
- Test (b) fails if `/api` is added to `PROTECTED_ROUTES`

**Implementation Note**: After all automated checks pass, pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Update test-plan.md

### Overview

Mark Phase 2 of the rollout as "change opened" in the §3 table, and fill in the previously-TBD cookbook sections §6.3 (component tests) and §6.4 (API route + middleware tests) with patterns from the two phases.

### Changes Required:

#### 1. §3 Phased Rollout — Phase 2 row

**File**: `context/foundation/test-plan.md`

**Intent**: Update the Phase 2 table row: set Status to `change opened` and fill in Change folder as `context/changes/testing-ui-state-auth-boundary`.

#### 2. §6.3 — component test cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the TBD with a concise cookbook covering: file location pattern, `// @vitest-environment jsdom` docblock, `vi.stubGlobal("fetch", ...)` mock, `cleanup()` in `afterEach`, and `.disabled` DOM property.

#### 3. §6.4 — API route + middleware cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the TBD with two sub-patterns: (a) Astro API route unit test (import `POST` + minimal `APIContext` stub, from Phase 1); (b) middleware unit test (`defineMiddleware` mock + null-client mock, from Phase 3 of this change).

### Success Criteria:

#### Automated Verification:

- No test regressions: `npm test`
- Lint passes on updated markdown: `npm run lint`

#### Manual Verification:

- §6.3 and §6.4 contain working, copy-pasteable patterns
- Phase 2 row in §3 shows correct status and change folder

---

## References

- Test plan: `context/foundation/test-plan.md`
- Prior change (rollout Phase 1): `context/changes/testing-r2-r3-error-paths/plan.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fix GenerateView state machine

#### Automated

- [x] 1.1 npm test — all existing tests pass
- [x] 1.2 npm run lint — 0 errors

#### Manual

- [x] 1.3 Save error → Retry → lands on review with accepted card visible
- [x] 1.4 Generate error → Retry → lands on idle (text input)

### Phase 2: R4 component tests

#### Automated

- [ ] 2.1 npm test — R4a and R4b pass
- [ ] 2.2 npm run lint — 0 errors

#### Manual

- [ ] 2.3 R4a fails if handleRetry reverted to always-idle
- [ ] 2.4 R4b fails if cards state reset on retry

### Phase 3: R5 middleware unit test

#### Automated

- [ ] 3.1 npm test — middleware tests pass
- [ ] 3.2 npm run lint — 0 errors

#### Manual

- [ ] 3.3 Test (a) fails if /generate removed from PROTECTED_ROUTES
- [ ] 3.4 Test (b) fails if /api added to PROTECTED_ROUTES

### Phase 4: Update test-plan.md

#### Automated

- [ ] 4.1 npm test — no regressions
- [ ] 4.2 npm run lint — 0 errors

#### Manual

- [ ] 4.3 §6.3 and §6.4 contain working copy-pasteable patterns
- [ ] 4.4 Phase 2 row in §3 shows correct status and change folder
