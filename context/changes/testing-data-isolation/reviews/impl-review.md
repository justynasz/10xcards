<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Data Isolation + CI Quality Gates

- **Plan**: context/changes/testing-data-isolation/plan.md
- **Scope**: All Phases (Phase 1–3 of 3)
- **Date**: 2026-06-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  2 warnings  4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Guard test silently misses future API subdirectories

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/__tests__/security.test.ts:22
- **Detail**: Guard scanned only `src/pages/api/flashcards/`. If a new API directory is added (e.g. `src/pages/api/decks/`), it would be silently outside the guard. Fixed by scanning `src/pages/api/` and filtering out the known-allowlisted `auth/` directory via `ALLOWLISTED_DIRS`.
- **Fix**: Scan `src/pages/api/`, filter out `auth/` via allowlist constant.
- **Decision**: FIXED

### F2 — Guard scans __tests__ subdirs (mock imports could false-positive)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/__tests__/security.test.ts (collectTsFiles)
- **Detail**: `collectTsFiles` recursed into `__tests__/` subdirectories. A test mock like `vi.mock("@/lib/supabase", () => ({ createAdminClient: ... }))` would have triggered the guard as a false positive. Fixed by skipping `__tests__` dirs and `*.test.ts` / `*.spec.ts` files in `collectTsFiles`.
- **Fix**: Skip `__tests__` dirs and test/spec files in `collectTsFiles`.
- **Decision**: FIXED

### F3 — Verbose conditional type cast in id.test.ts

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/flashcards/__tests__/id.test.ts
- **Detail**: Mock return values used `as ReturnType<typeof getFlashcard> extends Promise<infer T> ? T : never` — verbose and fragile. Replaced with `as unknown as Flashcard` (imported from `@/lib/flashcards/types`), matching the pattern used in `batch-create.test.ts`.
- **Fix**: Replace verbose conditional cast with `as unknown as Flashcard`.
- **Decision**: FIXED

### F4 — .catch(() => null) converts all getFlashcard errors to 404

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards/[id].ts:44,77
- **Detail**: A transient Supabase network error or misconfigured env returned 404 instead of 500, indistinguishable from "card not found" on the client. Fixed by adding `console.error` in the catch callback before returning null, matching the error-logging pattern used in the same file's update/delete catch blocks.
- **Fix**: Add `console.error` in `.catch()` before returning null.
- **Decision**: FIXED
