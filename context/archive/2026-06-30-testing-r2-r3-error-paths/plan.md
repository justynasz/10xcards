# R2/R3 Error-Path Tests Implementation Plan

## Overview

Add tests that prove: (a) when batch-save returns an error the UI shows it and does NOT show success; (b) when the AI output is malformed or the OpenRouter call fails the API propagates a descriptive error and the UI shows it with a Retry option.

Risks covered: **R2** (cichy błąd batch-save) and **R3** (błąd AI output → utrata sesji).

## Current State Analysis

Service-layer error paths are already tested:
- `batchCreateFlashcards` throws on Supabase error — `flashcards.test.ts:200-203` ✓
- `generateFlashcards` throws on malformed JSON, HTTP error, timeout — `openrouter.test.ts:37-59` ✓

What is NOT tested:
- API route `/api/flashcards/generate` — error propagation (throw → 500, timeout throw → 504)
- API route `/api/flashcards/batch-create` — auth guard (no user → 401) + error propagation (throw → 500)
- `GenerateView` component — whether the UI actually enters `error` state (not `success`/`review`) when either fetch call returns non-2xx

RTL (`@testing-library/react`) is not yet installed; the test-plan deferred it to Phase 2. This plan installs it in Phase 1 because R2/R3 require component-level coverage.

## Desired End State

- Running `npm test` executes 3 new test files (8 new test cases total) alongside the existing suite — all green.
- The API route tests confirm that error shapes land correctly at the HTTP boundary.
- The `GenerateView` RTL tests confirm that non-2xx from `/generate` or `/batch-create` transitions the component to `error` ViewState and renders the error message, never entering `review` or `success`.
- `test-plan.md` §4 reflects RTL installed in Phase 1 (not Phase 2).

### Key Discoveries:

- `generate.ts:38` — timeout detection is message-based: `if (message.includes("timed out"))`. Tests must supply the exact string from `openrouter/index.ts` ("Generation timed out after 10 seconds").
- `batch-create.ts:17-18` — `createClient` is called after the auth guard; `createClient` can return `null`; the route already guards this case (returns 500 "Supabase is not configured"). Our scope is the throw-from-service path (line 38-42).
- `generate.ts:15` — reads `OPENROUTER_API_KEY` from `astro:env/server`. Route tests must `vi.mock("astro:env/server", ...)` with a non-empty key so execution reaches the service call.
- `GenerateView.tsx:47` — generate error: `throw new Error(data.error ?? "Generowanie nie powiodło się")` catches non-2xx and transitions to `error`. Path is exercised but untested.
- `GenerateView.tsx:71` — save error: `throw new Error(data.error ?? "Zapisanie nie powiodło się")` — same pattern.
- `CardReviewItem.tsx:104` — accept button text: **"Akceptuj"** (needed to locate it in RTL tests).
- `GenerateView.tsx:125` — save button text prefix: **"Zapisz"** (dynamic: "Zapisz 1 fiszkę"). Use `getByRole("button", { name: /Zapisz/ })` in RTL.
- RTL tests must `vi.stubGlobal("fetch", ...)` — consistent with existing pattern in `openrouter.test.ts:30`.

## What We're NOT Doing

- Not testing the `GenerateView` happy path (generate + save success) — not in R2/R3 scope.
- Not testing the `handleRetry` click that resets state to `idle` — that is R4 scope (Phase 2).
- Not adding `@testing-library/jest-dom` — plain `toBeInTheDocument()` from RTL is sufficient; custom matchers add dependency weight.
- Not testing `generate.ts` auth guard (no user → 401) — same mechanism as `batch-create.ts`; one proof is enough per the cost × signal principle.
- Not adding E2E tests.

## Implementation Approach

Three phases in dependency order: set up the test infrastructure first (Phase 1), then add pure-function route tests that don't need a DOM (Phase 2), then add component tests that require jsdom (Phase 3). Each phase is independently verifiable.

Route tests call the exported `POST` function directly with a minimal `APIContext` stub — no HTTP server needed. Service/module dependencies are mocked with `vi.mock`. Component tests use RTL with `vi.stubGlobal("fetch", ...)`.

## Critical Implementation Details

- **`environmentMatchGlobs` nie działa w vitest 4 z pełną ścieżką** (impl-review F1): glob `"src/components/**"` nie matchuje absolutnej ścieżki pliku w vitest 4. Użyj zamiast tego docblock `// @vitest-environment jsdom` na górze każdego pliku testowego komponentu. Każdy nowy plik w `src/components/**/__tests__/` musi dodać ten docblock ręcznie.
- **`astro:env/server` mock placement**: `vi.mock("astro:env/server", ...)` must be at module scope (top of file, before imports) so vitest hoists it before the route module is loaded.

---

## Phase 1: RTL & Vitest Setup

### Overview

Install the missing test packages and configure vitest to use jsdom only for component test files. Update `test-plan.md` to reflect the change.

### Changes Required:

#### 1. Install packages

**File**: `package.json` (devDependencies) — run via shell

**Intent**: Add RTL, user-event, and jsdom so component tests can render React trees in a simulated DOM.

**Contract**: Run `npm install --save-dev @testing-library/react @testing-library/user-event jsdom`. Packages to add: `@testing-library/react`, `@testing-library/user-event`, `jsdom`.

#### 2. Update vitest config

**File**: `vitest.config.ts`

**Intent**: Restrict jsdom to component test files; leave service and route tests in the default node environment.

**Contract**: Add `environmentMatchGlobs` option inside `test`:
```ts
environmentMatchGlobs: [["src/components/**", "jsdom"]]
```

#### 3. Update test-plan.md §4 Stack table

**File**: `context/foundation/test-plan.md`

**Intent**: Reflect that RTL is installed in Phase 1 so the table doesn't mislead future readers.

**Contract**: In the `@testing-library/react + @testing-library/user-event` row, change `none yet — see §3 Phase 2` to `installed in Phase 1 (testing-r2-r3-error-paths); see §3 Phase 1 for component test cookbook (§6.3)`.

### Success Criteria:

#### Automated Verification:

- `npm install` exits 0; `package.json` and `package-lock.json` updated
- `npm test` passes — existing tests still green, no new failures
- `npm run lint` passes

---

## Phase 2: API Route Unit Tests

### Overview

Test the two API route handlers directly by importing and calling their exported `POST` function with a minimal stubbed `APIContext`. Covers: `generate` error propagation (generic throw → 500, timeout throw → 504) and `batch-create` auth guard + error propagation (no user → 401, throw → 500).

### Changes Required:

#### 1. Generate route tests

**File**: `src/pages/api/flashcards/__tests__/generate.test.ts` (new file)

**Intent**: Prove that when `generateFlashcards` throws, the route returns the correct HTTP status and error body — specifically that a timeout throw produces 504 (not a generic 500) and a generic throw produces 500.

**Contract**:
- `vi.mock("astro:env/server", () => ({ OPENROUTER_API_KEY: "test-key" }))` at module scope.
- `vi.mock("@/lib/openrouter", ...)` — mock `generateFlashcards` to throw controlled errors.
- Build a minimal `APIContext` stub: `{ locals: { user: { id: "u1" } }, request: new Request(url, { method: "POST", body: JSON.stringify({ text: "a".repeat(50) }), headers: { "Content-Type": "application/json" } }), cookies: {} }`.
- Test 1 — `generateFlashcards throws generic error → 500`:
  mock throws `new Error("AI returned invalid JSON: ...")`;
  assert `response.status === 500` and `(await response.json()).error` includes "Generation failed".
- Test 2 — `generateFlashcards throws timeout error → 504`:
  mock throws `new Error("Generation timed out after 10 seconds")`;
  assert `response.status === 504` and `(await response.json()).error` includes "timed out".

#### 2. Batch-create route tests

**File**: `src/pages/api/flashcards/__tests__/batch-create.test.ts` (new file)

**Intent**: Prove the auth guard returns 401 for unauthenticated requests, and that a Supabase throw from `batchCreateFlashcards` returns 500 — not a silent success.

**Contract**:
- `vi.mock("@/lib/supabase", () => ({ createClient: vi.fn().mockReturnValue({}) }))` — return a non-null client stub so execution reaches the service.
- `vi.mock("@/lib/flashcards", ...)` — mock `batchCreateFlashcards`.
- Build `APIContext` stubs: one with `locals: { user: null }` (no auth), one with a user + valid body.
- Test 1 — `no user → 401`:
  use context with `user: null`;
  assert `response.status === 401`.
- Test 2 — `batchCreateFlashcards throws → 500`:
  mock throws `new Error("db error")`;
  assert `response.status === 500` and `(await response.json()).error` includes "Failed to save cards".

### Success Criteria:

#### Automated Verification:

- `npm test` — 4 new tests pass (2 per file)
- `npm run lint` passes

---

## Phase 3: GenerateView Component Tests (RTL)

### Overview

Use RTL with a mocked `fetch` to render `GenerateView` and assert that non-2xx responses from both API calls land the component in `error` ViewState — not in `review` or `success`. Covers R3 (generate fails → error) and R2 (save fails → error).

### Changes Required:

#### 1. GenerateView component test file

**File**: `src/components/generate/__tests__/GenerateView.test.tsx` (new file)

**Intent**: Prove at the UI layer that GenerateView never shows `success` or `review` when an API call fails — confirming the silent-fail and lost-session risks are protected.

**Contract**:
- Use `vi.stubGlobal("fetch", ...)` and `vi.unstubAllGlobals()` in `afterEach` — consistent with `openrouter.test.ts` pattern.
- Helper `makeJsonResponse(body, ok, status)` builds a `Response`-like object with `.ok`, `.status`, and `.json()`.
- `render(<GenerateView />)` from RTL; no props needed.

**R3 test — generate error → `error` ViewState**:
1. Stub `fetch` to return `{ ok: false, status: 500, json: () => { error: "Generation failed. Please try again." } }`.
2. Fill textarea (min 50 chars) via `fireEvent.change`.
3. Click "Generuj fiszki" button.
4. `await screen.findByText(/Generowanie nie powiodło się/i)` — confirms error state panel is visible.
5. Assert `screen.queryByText(/Przejrzyj fiszki/i)` is null — `review` state never rendered.

**R2 test — save error → `error` ViewState** (two-fetch scenario):
1. Stub `fetch` to:
   - First call (POST `/api/flashcards/generate`) → `{ ok: true, status: 200, json: () => { cards: [{ front: "Q", back: "A" }] } }`
   - Second call (POST `/api/flashcards/batch-create`) → `{ ok: false, status: 500, json: () => { error: "Failed to save cards. Please try again." } }`
   Use `vi.fn().mockResolvedValueOnce(...).mockResolvedValueOnce(...)`.
2. Fill textarea, click "Generuj fiszki".
3. `await screen.findByText(/Przejrzyj fiszki/i)` — confirm review state reached.
4. Click "Akceptuj" button (first card).
5. Click button matching `/Zapisz/` regex (save button, text is dynamic).
6. `await screen.findByText(/Generowanie nie powiodło się/i)` — confirms error state panel.
7. Assert `screen.queryByText(/Dodano/i)` is null — `success` state never rendered.

### Success Criteria:

#### Automated Verification:

- `npm test` — 2 new component tests pass
- `npm run lint` passes

---

## Testing Strategy

### Unit Tests (Phase 2):

- Route handler called directly with `APIContext` stub — no HTTP layer, no framework overhead
- Mocks scoped to each `describe` via `vi.mock` at module scope + `vi.mocked(...).mockResolvedValueOnce(...)` per test
- Error messages asserted with `.toContain(...)` not strict equality — protects against minor wording changes

### Component Tests (Phase 3):

- `fetch` stubbed globally — consistent with existing pattern; no MSW needed for 2 tests
- Assertions on visible text, not on React state directly — RTL best practice
- `findBy*` (async) for elements that appear after async state transitions; `queryBy*` for absence assertions
- Each test is independent: stubGlobal in setup, unstubAllGlobals in afterEach

## References

- Test-plan risk guidance: `context/foundation/test-plan.md` §2 (R2 and R3 rows)
- Existing service tests (patterns to follow): `src/lib/flashcards/__tests__/flashcards.test.ts`, `src/lib/openrouter/__tests__/openrouter.test.ts`
- Source under test: `src/pages/api/flashcards/generate.ts`, `src/pages/api/flashcards/batch-create.ts`, `src/components/generate/GenerateView.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: RTL & Vitest Setup

#### Automated

- [x] 1.1 `npm install` exits 0; package.json updated with three new devDependencies — e8f71be
- [x] 1.2 `npm test` passes — existing tests green, no regressions — e8f71be
- [x] 1.3 `npm run lint` passes — e8f71be

### Phase 2: API Route Unit Tests

#### Automated

- [x] 2.1 `npm test` — 4 new tests pass (generate: 2, batch-create: 2) — 6bc6e42
- [x] 2.2 `npm run lint` passes — 6bc6e42

### Phase 3: GenerateView Component Tests (RTL)

#### Automated

- [x] 3.1 `npm test` — 2 new RTL tests pass (R3 generate error, R2 save error) — c333c67
- [x] 3.2 `npm run lint` passes — c333c67
