# Data Isolation + CI Quality Gates — Implementation Plan

## Overview

Phase 3 of the test rollout plan. Adds an app-level ownership check to the flashcard mutation routes (protection against IDOR when RLS is the sole isolation layer), unit tests that prove cross-user requests get 403, a guard test that enforces no API route accidentally bypasses RLS via the service-role client, and wires `npm test` into CI. Closes the test rollout with test-plan documentation.

## Current State Analysis

All flashcard API routes use the anon Supabase client (`createClient()` in `src/lib/supabase.ts`) — this is correct: the anon client respects RLS policies. However:

- `src/pages/api/flashcards/[id].ts:70` — `deleteFlashcard(supabase, id)` deletes by `id` only; no app-level check that the card belongs to the authenticated user. If RLS silently filters the row (0 rows deleted), the route still returns `200 {}` — a silent no-op instead of 404.
- `src/pages/api/flashcards/[id].ts:45` — `updateFlashcard(supabase, id, dto)` — same issue: no ownership check; cross-user update silently succeeds or no-ops.
- `src/lib/supabase.ts:27–32` — `createAdminClient()` (service-role client) exists and bypasses RLS. It is not imported anywhere today, but has no enforcement preventing a future developer from accidentally using it in a route.
- `.github/workflows/ci.yml:20–21` — CI runs `npm run lint` and `npm run build` but **no `npm test`** — Vitest suite never runs on push/PR.

## Desired End State

1. `DELETE /api/flashcards/[id]` and `PUT /api/flashcards/[id]` return 403 when the authenticated user does not own the target card — not a silent no-op.
2. Unit tests cover the cross-user 403 path for both DELETE and PUT, plus a guard test that enforces no API route file imports `createAdminClient`.
3. `npm test` runs in CI before the build step — a failing test blocks the merge.
4. `test-plan.md` Phase 3 row updated to `change opened`; §6.5 cookbook filled.

### Key Discoveries

- `src/lib/flashcards/index.ts:12–16` — `getFlashcard(supabase, id)` fetches a single card by id (`.single()` — throws if not found). This is the cheapest way to implement the ownership check: fetch → compare `card.user_id !== user.id` → 403.
- `src/pages/api/flashcards/__tests__/batch-create.test.ts` — existing pattern: `vi.mock("@/lib/flashcards", ...)` before imports, `makeContext(user, body)` helper returning `APIContext` stub, `vi.clearAllMocks()` in `afterEach`.
- `[id].ts` routes need `context.params.id` — the `makeContext` helper must include a `params` field.
- Admin-client guard test uses Node `fs` module to read route files; must run in node environment.
- `ci.yml:19–21` — `npm test` goes between `npx astro sync` (line 19) and `npm run lint` (line 20); tests don't need `SUPABASE_URL`/`SUPABASE_KEY` env vars (Supabase is mocked in all tests).

## What We're NOT Doing

- Not adding ownership check to `listFlashcards` or `listDueFlashcards` — these are filtered by RLS; no destructive IDOR risk (read-only, and RLS should filter by session user).
- Not adding ownership check to `review.ts` POST (`updateFlashcardSR`) — same as above; spaced-repetition state mutation is low-stakes for cross-user in current usage.
- Not adding integration tests against a real Supabase instance — RLS verification via Supabase Studio is noted as a manual step.
- Not changing the service functions in `src/lib/flashcards/index.ts` — ownership check lives in the route handlers, keeping service functions generic/reusable.
- Not splitting `createAdminClient` into a separate module — it stays in `supabase.ts`; the guard test is sufficient protection.

## Implementation Approach

Phase 1: Add `getFlashcard` call before each mutation in `[id].ts` and return 403 on mismatch; write the corresponding test file following the `batch-create.test.ts` pattern; add the admin-client guard test.

Phase 2: Add `run: npm test` to `ci.yml` between `astro sync` and `lint`.

Phase 3: Update `test-plan.md` (Phase 3 row + §6.5 cookbook).

## Critical Implementation Details

- **Import `getFlashcard` in `[id].ts`**: the route currently imports `updateFlashcard, deleteFlashcard` from `@/lib/flashcards` (line 4). Add `getFlashcard` to that import.
- **`getFlashcard` throws on not-found**: `.single()` in Supabase errors when 0 rows are returned. Wrap the fetch in a try/catch and return 404 on error — before the ownership comparison. This way the route handles both "card does not exist" and "card belongs to other user" with distinct status codes.
- **`context.locals.user` narrowing**: after the `if (!context.locals.user)` guard at line 18/55, TypeScript narrows `user` to non-null — `context.locals.user.id` is safe without additional null checks.
- **Admin-client guard environment**: the guard test reads files from disk using Node `fs` — add `// @vitest-environment node` at line 1 (same pattern as `middleware.test.ts`).

---

## Phase 1: Ownership check + IDOR tests + admin-client guard

### Overview

Add an app-level ownership check to the `DELETE` and `PUT` handlers in `[id].ts`, then write unit tests that prove the 403 path and the happy path. Add a guard test that enforces `createAdminClient` is never imported in API routes.

### Changes Required:

#### 1. Add ownership check to DELETE and PUT in `[id].ts`

**File**: `src/pages/api/flashcards/[id].ts`

**Intent**: Before executing a destructive operation, fetch the card and verify it belongs to the authenticated user. Return 403 if it doesn't, 404 if the card doesn't exist.

**Contract**:
- Add `getFlashcard` to the import on line 4.
- In the DELETE handler (after `id` is validated, before `deleteFlashcard` call): call `getFlashcard(supabase, id)` in a try/catch. On throw → return 404. If `card.user_id !== context.locals.user.id` → return 403.
- In the PUT handler (after body parse, before `updateFlashcard` call): same fetch-and-check pattern.
- The 403 body: `{ error: "Forbidden" }`.
- The 404 body: `{ error: "Fiszka nie istnieje." }`.

#### 2. New test file for `[id].ts`

**File**: `src/pages/api/flashcards/__tests__/id.test.ts`

**Intent**: Unit-test the ownership-check paths for PUT and DELETE. Four tests: cross-user DELETE → 403, cross-user PUT → 403, own-card DELETE → 200, own-card PUT → 200. Follows the `batch-create.test.ts` pattern exactly.

**Contract**:
```
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/flashcards", () => ({
  getFlashcard: vi.fn(),
  updateFlashcard: vi.fn(),
  deleteFlashcard: vi.fn(),
}));

import { getFlashcard, updateFlashcard, deleteFlashcard } from "@/lib/flashcards";
import { PUT, DELETE } from "../[id]";

function makeContext(user, params = { id: "card-1" }, body?): APIContext

// cross-user: getFlashcard resolves { id: "card-1", user_id: "other-user" }
// own-card: getFlashcard resolves { id: "card-1", user_id: "current-user" }
// context.locals.user = { id: "current-user" }
```
`context.params` must include `id`.

#### 3. Admin-client guard test

**File**: `src/__tests__/security.test.ts`

**Intent**: Structural assertion — no TypeScript file under `src/pages/api/` (recursively) may import `createAdminClient`. Catches accidental bypass of RLS before it reaches production.

**Contract**:
```
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// collect all .ts files under src/pages/api/ recursively
// for each: assert content does not include "createAdminClient"
```
Use `process.cwd()` to build the absolute path to `src/pages/api/`.

### Success Criteria:

#### Automated Verification:

- `npm test` — all tests pass (39 existing + 4 IDOR + 1 guard = 44 tests)
- `npm run lint` — 0 errors

#### Manual Verification:

- Revert the 403 check from DELETE temporarily → the `cross-user DELETE → 403` test must FAIL
- Restore → all 44 green

**Implementation Note**: After all automated checks pass, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: CI gate — wire npm test

### Overview

Add `npm test` to the `ci` job in `.github/workflows/ci.yml` so the Vitest suite runs on every push and PR.

### Changes Required:

#### 1. Add test step to ci.yml

**File**: `.github/workflows/ci.yml`

**Intent**: Insert `- run: npm test` between `- run: npx astro sync` (line 19) and `- run: npm run lint` (line 20). No env vars needed — Supabase is mocked in all tests.

**Contract**: The step has no `env:` block. Order: `npm ci` → `astro sync` → `npm test` → `npm run lint` → `npm run build`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes locally (regression check before pushing)
- `npm run lint` passes

#### Manual Verification:

- Intentionally break one test locally → `npm test` exits non-zero → CI would block
- Restore → green

**Implementation Note**: After checks pass, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Update test-plan.md

### Overview

Mark Phase 3 of the rollout as "change opened" in §3, fill §6.5 IDOR test cookbook, and update the freshness ledger.

### Changes Required:

#### 1. §3 Phased Rollout — Phase 3 row

**File**: `context/foundation/test-plan.md`

**Intent**: Update the Phase 3 table row: set Status to `change opened` and fill Change folder as `context/changes/testing-data-isolation`.

#### 2. §6.5 — cross-user isolation test cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the TBD placeholder with a concise pattern showing how to write an IDOR test: mock `getFlashcard` to return a card with mismatched `user_id`, assert 403. Also document the admin-client guard pattern (structural file-read assertion).

### Success Criteria:

#### Automated Verification:

- `npm test` — no regressions
- `npm run lint` — passes

#### Manual Verification:

- §6.5 contains a copy-pasteable IDOR test stub and a guard test stub
- Phase 3 row in §3 shows correct status and change folder

---

## References

- Test plan: `context/foundation/test-plan.md`
- Prior changes: `context/changes/testing-r2-r3-error-paths/plan.md`, `context/changes/testing-ui-state-auth-boundary/plan.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Ownership check + IDOR tests + admin-client guard

#### Automated

- [x] 1.1 npm test — all tests pass (44 total) — 8a63565
- [x] 1.2 npm run lint — 0 errors — 8a63565

#### Manual

- [x] 1.3 Revert 403 check → cross-user test fails; restore → all green — 8a63565

### Phase 2: CI gate — wire npm test

#### Automated

- [x] 2.1 npm test passes locally — 6e4012e
- [x] 2.2 npm run lint passes — 6e4012e

#### Manual

- [x] 2.3 Break one test → npm test exits non-zero; restore → green — 6e4012e

### Phase 3: Update test-plan.md

#### Automated

- [x] 3.1 npm test — no regressions
- [x] 3.2 npm run lint — passes

#### Manual

- [x] 3.3 §6.5 contains copy-pasteable IDOR + guard stubs
- [x] 3.4 Phase 3 row in §3 shows correct status and change folder
