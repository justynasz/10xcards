# Testing CRUD UI and SR Session Error Paths — Plan Brief

> Full plan: `context/changes/testing-crud-sr-error-paths/plan.md`

## What & Why

Add 7 tests across 4 new files to cover the three risk areas surfaced in Phase 4 of the test rollout: silent CRUD errors in FlashcardsListView (R7), SR session state after a rating failure in SessionView (R8), and missing 401 coverage for list/create API routes (R9). S-03 shipped manual card management with no tests; this phase closes that gap.

## Starting Point

FlashcardsListView, SessionView, list.ts, and index.ts were all implemented correctly — error handling exists in the code — but zero tests cover their failure paths. Component test infrastructure (RTL, `vi.stubGlobal`) and API route unit test patterns are already established from Phases 1–3.

## Desired End State

`npm test` passes with 7 new green tests. Any regression in FlashcardsListView create/edit/delete error handling, SessionView rating failure, or list/create auth guards will immediately fail CI.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| FlashcardsListView scope | Create + edit + delete error (R7a/b/c) | All three mutation paths have the same risk; excluding any would leave a blind spot |
| SessionView scope | GET load error + handleRate error (R8a/b) | Both failure modes present to the user; the load error path is structurally distinct from the rate error path |
| API route scope | 401 + 500 for list, 401 + 400 + 500 for index | Matches batch-create.test.ts precedent; 400 added for index because it has Zod validation |
| Phase count | 3 phases | Component tests (2 files) are one commit each; API route tests (2 files) share one commit |

## Scope

**In scope:** FlashcardsListView error tests, SessionView error tests, list.ts unit tests, index.ts unit tests

**Out of scope:** Happy-path CRUD tests, review.ts API route tests, e2e flows, FlashcardsListView initial load error test

## Architecture / Approach

All tests follow §6.3 (component tests) and §6.4 (API route unit tests) from the cookbook — no new infrastructure. Component tests use `vi.stubGlobal("fetch")` with chained `mockResolvedValueOnce` (first call = initial load success, second call = mutation error). API route tests import handlers directly and mock `createClient` + service functions.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. FlashcardsListView tests | 3 RTL tests — create/edit/delete error paths (R7) | Label disambiguation: create + edit forms share "Przód"/"Tył" labels in DOM during edit mode |
| 2. SessionView tests | 2 RTL tests — GET load error + handleRate error (R8) | Mock chain ordering: GET success must be first, POST error second |
| 3. API route tests | 5 unit tests — list 401/500, index 401/400/500 (R9) | Vitest mock hoisting: `vi.mock(...)` must precede imports |

**Prerequisites:** none — RTL and vitest already configured  
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- FlashcardsListView and SessionView tests depend on aria attributes and label text staying stable — a UI redesign would require test updates
- `MOCK_CARD` for SessionView must include all Flashcard SR fields; TypeScript will catch missing fields at compile time

## Success Criteria (Summary)

- `npm test` green with 7 new tests across 4 files
- `npm run lint` clean
- Zero regressions in existing test suite
