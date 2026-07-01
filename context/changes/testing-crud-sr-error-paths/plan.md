# Testing CRUD UI and SR Session Error Paths — Implementation Plan

## Overview

Add component tests for FlashcardsListView and SessionView error paths, and API route unit tests for list.ts and index.ts — covering risks R7, R8, and R9 from the test plan. All tests follow established cookbook patterns (§6.3 and §6.4).

## Current State Analysis

- **FlashcardsListView** (`src/components/flashcards/FlashcardsListView.tsx`): Three mutation paths (create POST, edit PUT, delete DELETE) each have `role="alert"` error messages and correct state preservation on failure — but zero tests.
- **SessionView** (`src/components/review/SessionView.tsx`): `handleRate()` catches POST `/api/flashcards/review` errors and restores `viewState = "flipped"` with `errorMessage` — but zero tests. Initial GET error also sets `errorMessage` in empty state.
- **list.ts** (`src/pages/api/flashcards/list.ts`): `context.locals.user` guard → 401, service error → 500. No tests.
- **index.ts** (`src/pages/api/flashcards/index.ts`): Same guard pattern, Zod validation → 400, service error → 500. No tests.
- **Established patterns**: `GenerateView.test.tsx` (§6.3) and `batch-create.test.ts` (§6.4) are the reference templates.

## Desired End State

Seven new tests across four files. `npm test` passes green. Error paths for all three CRUD mutations in FlashcardsListView are proven to show alerts without losing user-typed text. SessionView handleRate failure and initial load failure are both covered. list.ts and index.ts return 401 when unauthenticated.

### Key Discoveries

- FlashcardsListView create/edit forms share label text "Przód"/"Tył" — during edit mode both the create and edit textareas are in the DOM simultaneously. In R7b (edit error test), use `getAllByLabelText(/Przód/i)[1]` to target the edit form's textarea (create form is always first in DOM order).
- FlashcardsListView uses `role="alert"` on all three error paragraphs — reliable RTL selector.
- SessionView reads cards from GET `/api/flashcards/review` on mount; component tests must mock this first fetch call to return cards before testing handleRate error.
- SessionView `errorMessage` renders as `<p className="text-center text-sm text-red-600">{errorMessage}</p>` at the bottom of the component (in the flipped/saving view) — use `findByText(/Nie udało się zapisać/i)`.
- API route tests follow `batch-create.test.ts` exactly: mock `createClient` → `{}`, mock the service function, import handler after mocks.

## What We're NOT Doing

- Happy-path tests for FlashcardsListView (create success, edit success, delete success) — not in the risk map; no budget for it now.
- Tests for `review.ts` endpoints — user excluded from R9 scope; GET/POST review have their own risk (R8) covered via component test.
- Full e2e flows — no Playwright framework.
- FlashcardsListView initial load error test — covered by the component's simple `viewState = "error"` which is structurally identical to SessionView's load error (already tested in Phase 2).

## Implementation Approach

Three sequential phases following §6.3 and §6.4 patterns. Each phase produces one commit. No new test infrastructure — RTL and `vi.stubGlobal("fetch")` are already installed.

## Critical Implementation Details

**Label disambiguation in R7b (edit error test)**: In edit mode, the create form and edit form both render "Przód"/"Tył" labels in the DOM. Use `getAllByLabelText(/Przód/i)` — index `[0]` is the create form, `[1]` is the edit form textarea. Set edit textarea value to a distinct string so the assertion is unambiguous.

**Mock chain ordering**: For any FlashcardsListView or SessionView component test, the first `mockResolvedValueOnce` must be the initial load (GET list or GET review) returning success. Mutation error mocks come second.

**Flashcard mock object**: SessionView tests need a complete `Flashcard` object (all SR fields). Import `Flashcard` from `@/lib/flashcards/types` and construct a factory constant at the top of the file — same pattern as spaced-repetition tests.

---

## Phase 1: FlashcardsListView component tests (R7)

### Overview

Create `src/components/flashcards/__tests__/FlashcardsListView.test.tsx` with three tests covering create error (R7a), edit error (R7b), and delete error (R7c).

### Changes Required

#### 1. New test file — FlashcardsListView

**File**: `src/components/flashcards/__tests__/FlashcardsListView.test.tsx`

**Intent**: Prove that when POST, PUT, or DELETE returns a non-2xx response, FlashcardsListView shows a `role="alert"` error message and does NOT clear user-typed text from the affected form.

**Contract**: Three `it(...)` blocks inside `describe("FlashcardsListView")`. File starts with `// @vitest-environment jsdom` (required per §6.3). Uses `vi.stubGlobal("fetch", ...)` with chained `mockResolvedValueOnce` — first call always the initial GET list success, second call the mutation error. `afterEach` runs `cleanup()` and `vi.unstubAllGlobals()`.

Test R7a — create error:
- Mock: GET `/list` → `{cards: []}` 200, POST `/` → `{error: "Nie udało się dodać fiszki."}` 500
- Flow: render → wait for "Nowa fiszka" heading → fill `getByLabelText(/Przód/i)` and `getByLabelText(/Tył/i)` → click "Dodaj fiszkę" → `findByRole("alert")` → assert textarea values still equal the typed text

Test R7b — edit error:
- Mock: GET `/list` → `{cards: [MOCK_CARD]}` 200, PUT `/:id` → `{error: "Nie udało się zaktualizować fiszki."}` 500
- Flow: render → wait → click "Edytuj" → type new value into `getAllByLabelText(/Przód/i)[1]` → click "Zapisz" → `findByRole("alert")` → assert edit textarea value equals the newly typed value (not the original)

Test R7c — delete error:
- Mock: GET `/list` → `{cards: [MOCK_CARD]}` 200, DELETE `/:id` → `{error: "Nie udało się usunąć fiszki."}` 500
- Flow: render → wait → click "Usuń" → click "Tak" → `findByRole("alert")` → assert "Na pewno?" text still in DOM (confirmation state preserved)

### Success Criteria

#### Automated Verification

- `npm test` passes with 3 new tests green in `FlashcardsListView.test.tsx`
- `npm run lint` passes with no new errors

#### Manual Verification

- Skim the test output: each test name maps clearly to R7a/R7b/R7c

---

## Phase 2: SessionView component tests (R8)

### Overview

Create `src/components/review/__tests__/SessionView.test.tsx` with two tests: GET load error (R8a) and handleRate error (R8b).

### Changes Required

#### 1. New test file — SessionView

**File**: `src/components/review/__tests__/SessionView.test.tsx`

**Intent**: Prove that SessionView surfaces errors to the user in both failure modes — initial load failure (errorMessage in empty state) and rating failure (errorMessage + viewState restored to flipped).

**Contract**: Two `it(...)` blocks inside `describe("SessionView")`. Same file header and afterEach pattern as Phase 1. `MOCK_CARD` factory constant typed as `Flashcard` (imported from `@/lib/flashcards/types`) with all SR fields populated.

Test R8a — GET load error:
- Mock: GET `/review` → `{}` 500 (non-ok response)
- Flow: render → `findByText(/Nie udało się załadować sesji/i)` → assert error paragraph visible
- Key: the component sets `errorMessage` and `viewState = "empty"` on GET error; the empty state conditionally renders `<p>{errorMessage}</p>` when `errorMessage` is truthy

Test R8b — handleRate error:
- Mock: GET `/review` → `{cards: [MOCK_CARD], nextDue: null}` 200, POST `/review` → `{}` 500
- Flow: render → `findByText(/Pytanie/i)` (session state, card front visible) → click "Pokaż odpowiedź" → click "Nie umiem" → `findByText(/Nie udało się zapisać oceny/i)` → assert `getByText(/Odpowiedź/i)` visible (back still shown = viewState is flipped)

### Success Criteria

#### Automated Verification

- `npm test` passes with 2 new tests green in `SessionView.test.tsx`
- `npm run lint` passes

#### Manual Verification

- Skim: R8a name references GET load error, R8b references handleRate error path

---

## Phase 3: API route unit tests (R9)

### Overview

Create `src/pages/api/flashcards/__tests__/list.test.ts` and `__tests__/index.test.ts` with 401, 400, and 500 coverage matching the `batch-create.test.ts` pattern.

### Changes Required

#### 1. New test file — list.ts

**File**: `src/pages/api/flashcards/__tests__/list.test.ts`

**Intent**: Prove GET `/api/flashcards/list` returns 401 when unauthenticated and 500 when `listFlashcards` throws.

**Contract**: `vi.mock("@/lib/supabase", ...)` + `vi.mock("@/lib/flashcards", () => ({ listFlashcards: vi.fn() }))` before imports (vitest hoisting). `makeContext(user)` factory builds a GET `APIContext` with `locals.user` set. Two tests: 401 and 500.

#### 2. New test file — index.ts

**File**: `src/pages/api/flashcards/__tests__/index.test.ts`

**Intent**: Prove POST `/api/flashcards` returns 401 when unauthenticated, 400 on invalid body, and 500 when `createFlashcard` throws.

**Contract**: Same mock pattern but imports `POST` from `../index` and mocks `createFlashcard`. `makeContext(user, body)` factory builds a POST `APIContext`. Three tests: 401, 400 (body missing `back`), 500.

### Success Criteria

#### Automated Verification

- `npm test` passes with 5 new tests green across `list.test.ts` (2) and `index.test.ts` (3)
- `npm run lint` passes

#### Manual Verification

- Full suite run (`npm test`): confirm zero regressions in existing tests

---

## References

- Test-plan risk guidance: `context/foundation/test-plan.md` §2 R7, R8, R9
- Component test cookbook: `context/foundation/test-plan.md` §6.3
- API route test cookbook: `context/foundation/test-plan.md` §6.4
- Reference component test: `src/components/generate/__tests__/GenerateView.test.tsx`
- Reference API route test: `src/pages/api/flashcards/__tests__/batch-create.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: FlashcardsListView component tests (R7)

#### Automated

- [x] 1.1 npm test passes — 3 new FlashcardsListView tests green
- [x] 1.2 npm run lint passes

#### Manual

- [x] 1.3 Test names clearly map to R7a / R7b / R7c

### Phase 2: SessionView component tests (R8)

#### Automated

- [ ] 2.1 npm test passes — 2 new SessionView tests green
- [ ] 2.2 npm run lint passes

#### Manual

- [ ] 2.3 Test names clearly map to R8a (load error) / R8b (handleRate error)

### Phase 3: API route unit tests (R9)

#### Automated

- [ ] 3.1 npm test passes — 5 new API route tests green (list: 2, index: 3)
- [ ] 3.2 npm run lint passes
- [ ] 3.3 Full suite: zero regressions in existing tests

#### Manual

- [ ] 3.4 Full suite run confirms no regressions
