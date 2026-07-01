<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: FSRS Scheduling Correctness (R1)

- **Plan**: context/changes/testing-core-loop-integrity/plan.md
- **Scope**: Phase 1–2 of 2
- **Date**: 2026-06-19
- **Verdict**: APPROVED
- **Findings**: 0 critical · 1 warning · 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — scheduled_days=8 pins a weight-derived FSRS constant

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts:61
- **Detail**: `expect(result.scheduled_days).toBe(8)` asserts an exact value that FSRS computes from the default weight vector (`w`). If ts-fsrs ships new default weights in a minor release, this test silently mirrors the new behaviour. The date-range assertion (±1d) already covers the meaningful schedule-drift risk.
- **Fix A ⭐ Recommended**: Replace `toBe(8)` with `toBeGreaterThan(0)`
  - Strength: Removes weight-dependency; semantic "Easy → Review with days>0" still asserted.
  - Tradeoff: Loses the exact-integer signal.
  - Confidence: HIGH — date-range already covers the meaningful risk.
  - Blind spot: None significant.
- **Fix B**: Keep `toBe(8)`, add a pinning comment
  - Strength: Makes the assumption explicit in code.
  - Tradeoff: Comment doesn't prevent silent-mirror risk on ts-fsrs upgrade.
  - Confidence: LOW
  - Blind spot: Haven't audited ts-fsrs release history for default-weight changes.
- **Decision**: FIXED via Fix A — `toBe(8)` → `toBeGreaterThan(0)`

### F2 — reps not asserted for Again and Hard

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts:24–42
- **Detail**: Good and Easy assert `reps > 0`; Again and Hard had no `reps` assertion. Confirmed from ts-fsrs source (index.umd.js:399): `reps` is incremented in `init()` before rating branching — valid for all ratings.
- **Fix**: Add `expect(result.reps).toBeGreaterThan(0)` to Again and Hard tests.
- **Decision**: FIXED

### F3 — lapses not asserted to stay 0 for non-Again ratings

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts:44–82
- **Detail**: The "Review + Again → lapses+1" test relies on the initial value being 0. No test asserted that Good/Easy from New leave lapses at 0. A DTO mapping regression that always increments lapses would pass all prior tests.
- **Fix**: Add `expect(result.lapses).toBe(0)` to Good and Easy new-card tests.
- **Decision**: FIXED

### F4 — No edge case for invalid rating input

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/index.ts:21
- **Detail**: `Rating[rating as keyof typeof Rating] as Grade` had no runtime guard. An invalid string produced `undefined as Grade` with undefined ts-fsrs behaviour. Pre-existing (flagged as F3 in Phase 1 review).
- **Fix**: Add runtime guard to index.ts + companion test `expect(() => computeNextCard(newCard(), "invalid" as SRRating)).toThrow(...)`.
- **Decision**: FIXED — guard added to index.ts; test added (25 total tests now pass)

### F5 — newCard() factory lacked override parameter

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: spaced-repetition.test.ts:5 vs flashcards.test.ts:13
- **Detail**: `flashcards.test.ts` defines `makeCard(overrides?: Partial<Flashcard>)`. The spaced-repetition file used `newCard()` with no overrides — the "Review + Again" test worked around it with spread syntax. Inconsistent pattern across sibling test files.
- **Fix**: Add `overrides?: Partial<Flashcard>` to `newCard()`; update line 67 to use `newCard({ state: 2, reps: 5, stability: 4, difficulty: 3 })`.
- **Decision**: FIXED

### F6 — elapsed_days eslint-disable comment (pre-existing)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/index.ts:28
- **Detail**: `elapsed_days` is `@deprecated` in ts-fsrs v5. eslint-disable suppresses the warning. No action until ts-fsrs v6 drops the field. Pre-existing (F4 in Phase 1 review).
- **Decision**: SKIPPED — re-check at next ts-fsrs upgrade
