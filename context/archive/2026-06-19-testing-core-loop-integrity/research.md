---
date: 2026-06-19T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: 7b4781d841f90354113fa1b27f03fcb06e419249
branch: main
repository: 10xcards
topic: "R1 — FSRS scheduling correctness: oracle grounding for due_date interval assertions"
tags: [research, spaced-repetition, fsrs, ts-fsrs, testing, R1]
status: complete
last_updated: 2026-06-19
last_updated_by: Claude Sonnet 4.6
---

# Research: R1 — FSRS scheduling correctness

**Date**: 2026-06-19  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: [7b4781d](https://github.com/justynasz/10xcards/blob/7b4781d841f90354113fa1b27f03fcb06e419249)  
**Branch**: main  
**Repository**: 10xcards

---

## Research Question

Ground the oracle for R1: *"FSRS scheduluje błędnie — `due_date` po ocenie ląduje w złym przedziale."*

Specifically:
1. What intervals does FSRS (ts-fsrs v5.4.1) produce for each Rating from a New card?
2. How does `Card.due` flow from ts-fsrs → ISO 8601 → `timestamptz` → deserialization? Is anything lost?
3. What do existing tests assert, and what gap exists?

---

## Summary

The date pipeline is **lossless**: `toISOString()` → `timestamptz` → `new Date()` round-trip preserves UTC to millisecond precision. No timezone bug exists in the pipeline itself.

The gap is entirely in the **test oracle**: current tests assert only `reps > 0`, `state ∈ {1,3}`, and `due_date > Date.now() - 1000`. A scheduler returning a due date years in the future — or the wrong learning step — would pass every existing test. The missing assertions are **date-range checks per Rating** and `lapses++` verification for the Again rating.

---

## Detailed Findings

### 1. ts-fsrs Interval Contracts (the oracle)

**Library**: ts-fsrs v5.4.1 (`node_modules/ts-fsrs/`)  
**Spec**: FSRS 6.0  
**Scheduler**: `BasicScheduler` with `BasicLearningStepsStrategy`

#### Rating Enum
```ts
Rating.Again = 1
Rating.Hard  = 2
Rating.Good  = 3
Rating.Easy  = 4
```
Source: `node_modules/ts-fsrs/dist/index.d.ts` line 9-15

#### State Enum
```ts
State.New        = 0
State.Learning   = 1
State.Review     = 2
State.Relearning = 3
```

#### Default parameters that determine intervals
| Parameter | Value |
|-----------|-------|
| `learning_steps` | `["1m", "10m"]` |
| `relearning_steps` | `["10m"]` |
| `request_retention` | `0.9` |
| `enable_fuzz` | `false` |
| `w[0]` (Again init_stability) | `0.212` |
| `w[1]` (Hard init_stability) | `1.2931` |
| `w[2]` (Good init_stability) | `2.3065` |
| `w[3]` (Easy init_stability) | `8.2956` |

Source: `node_modules/ts-fsrs/dist/index.umd.js` lines 535–574

#### Intervals for a brand-new card (State.New, all metrics = 0)

| Rating | State after | Due | `scheduled_days` |
|--------|------------|-----|-----------------|
| **Again (1)** | Learning | now + **1 minute** | 0 |
| **Hard (2)** | Learning | now + **6 minutes** | 0 |
| **Good (3)** | Learning | now + **10 minutes** | 0 |
| **Easy (4)** | **Review** | now + **8 days** | 8 |

**How Easy graduates directly to Review**: `BasicLearningStepsStrategy` produces `scheduled_minutes = 0` for Easy; the scheduler then calls `next_interval(stability=8.2956, elapsed_days=0)` which yields `round(8.2956 × 1.012) = 8 days` and sets state to Review.  
Source: `node_modules/ts-fsrs/dist/index.umd.js` lines 288-341, 1054-1104, 860-866

**Key insight**: Again/Hard/Good stay in short-term learning (minutes, `scheduled_days = 0`). Easy skips learning entirely and schedules 8 days out. A scheduler bug that uses days instead of minutes for Again/Hard/Good would go undetected by the current test `due_date > Date.now() - 1000`.

#### After "Again" on an existing Review card
- `lapses` increments by exactly 1
- `state` → Relearning (3)
- Due = now + 10 minutes (relearning_steps)

---

### 2. Card.due Pipeline: ts-fsrs → DB → Deserialization

#### Write path (ts-fsrs → Supabase)

```
fsrs().next(tsCard, new Date(), ratingEnum)
  → result.card.due          // JavaScript Date (UTC)
  → .toISOString()           // "2026-06-19T14:32:00.000Z" (always UTC)
  → UPDATE flashcards SET due_date = $1  // timestamptz column
```

Key lines:
- `src/lib/spaced-repetition/index.ts:22` — `fsrs().next(tsCard, new Date(), ratingEnum)`
- `src/lib/spaced-repetition/index.ts:25` — `due_date: result.card.due.toISOString()`
- `src/lib/flashcards/index.ts:75` — passes DTO straight into `.update(dto)`, no additional mapping

#### Database schema
- Column: `due_date timestamptz NOT NULL DEFAULT now()`
- Migration: `supabase/migrations/20260525000000_create_flashcards.sql:11`
- FSRS migration (`20260617200000_migrate_flashcards_to_fsrs.sql`) adds FSRS metric columns (stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review) but does not alter `due_date`
- `timestamptz` stores a UTC epoch internally; Postgres/PostgREST returns ISO 8601 UTC on read

#### Read path (Supabase → ts-fsrs)

```
Supabase returns due_date as ISO 8601 string ("+00:00" or "Z" suffix)
  → Flashcard.due_date: string (typed in TypeScript)
  → new Date(card.due_date)  // src/lib/spaced-repetition/index.ts:9
  → ts-fsrs Card.due: Date   // correct, lossless
```

`last_review` follows the same pattern:
- Write: `result.card.last_review?.toISOString() ?? null` (index.ts:34)
- Read: `flashcard.last_review ? new Date(flashcard.last_review) : undefined` (index.ts:17)

**Pipeline verdict: lossless.** `toISOString()` always emits UTC `Z`; `timestamptz` stores UTC; `new Date(string)` correctly parses both `Z` and `+00:00` suffixes. Sub-day precision (milliseconds) is preserved through the full round-trip.

---

### 3. Existing Tests: What They Assert vs. What's Missing

#### `src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts`

| Test case | Assertions |
|-----------|-----------|
| New + Again | `state ∈ [1, 3]`; `due_date > Date.now() - 1000` |
| New + Good | `reps > 0`; `state === 1`; `due_date > Date.now() - 1000` |
| New + Easy | `reps > 0`; `scheduled_days > 0` |
| Review + Again | `lapses === card.lapses + 1` |
| due_date format | round-trip: `new Date(result.due_date).toISOString() === result.due_date` |
| last_review | `!== null` after first review |

#### `src/lib/flashcards/__tests__/flashcards.test.ts`

- `updateFlashcardSR` test: asserts the DTO passed to Supabase `.update()` — uses hardcoded `due_date: "2026-01-07T00:00:00Z"`, does not check computed value
- `listDueFlashcards` test: asserts `.lte("due_date", expect.any(String))` — does not verify UTC correctness

#### Identified gaps

| Gap | Impact |
|-----|--------|
| No date-range assertion for any Rating | A bug scheduling Again in days (not minutes) passes all tests |
| `due_date > Date.now() - 1000` is near-past, not range | Both "1 minute from now" and "1 year from now" pass |
| New + Again: no `lapses` assertion | Regression in lapse increment for new cards goes undetected |
| New + Easy: `scheduled_days > 0` but no upper bound | `scheduled_days = 365` would pass |
| No test for `scheduled_days = 0` on Again/Hard/Good | If learning steps accidentally schedule in days, test passes |

---

### 4. Historical Context

#### S-02 archive established the date pipeline design
- `context/archive/2026-06-17-sr-review-session/plan.md:68-71` — documented the serialization contract: `toISOString()` write / `new Date()` read
- `context/archive/2026-06-17-sr-review-session/plan.md:28` — Rating bracket notation: `Rating[rating as keyof typeof Rating]`
- `context/archive/2026-06-17-sr-review-session/plan.md:73-74` — `state` stored as int (0–3), not string
- `context/archive/2026-06-17-sr-review-session/plan.md:91-106` — migration SQL that added FSRS columns; was **not** wrapped in a transaction initially — fixed in impl-review (F4), became the lesson in `context/foundation/lessons.md`

#### S-02 impl-review warnings still relevant
- F1 (fixed): SessionView fetch chain missing `r.ok` check — pattern to avoid in new tests
- F2 (fixed): `listDueFlashcards` had no `.limit()` — now `limit(100)` is in place
- F6 (skipped): `learning_steps: 0` in the service layer satisfies TypeScript but is not stored in DB — does not affect test correctness since ts-fsrs uses its own defaults when the scheduler is created via `fsrs()`

#### S-01 archive safeParse pattern (context for R3, not R1)
- `context/archive/2026-06-16-ai-generate-and-review/plan.md:65,244` — safeParse is the sole barrier for AI output; relevant for R3 research, not R1

---

## Code References

| What | Path | Lines |
|------|------|-------|
| `computeNextCard` — full service function | [`src/lib/spaced-repetition/index.ts`](https://github.com/justynasz/10xcards/blob/7b4781d841f90354113fa1b27f03fcb06e419249/src/lib/spaced-repetition/index.ts) | 8-35 |
| `UpdateFlashcardSRDto` type | [`src/lib/flashcards/types.ts`](https://github.com/justynasz/10xcards/blob/7b4781d841f90354113fa1b27f03fcb06e419249/src/lib/flashcards/types.ts) | ~28 |
| `updateFlashcardSR` — passes DTO to Supabase | [`src/lib/flashcards/index.ts`](https://github.com/justynasz/10xcards/blob/7b4781d841f90354113fa1b27f03fcb06e419249/src/lib/flashcards/index.ts) | ~75 |
| `listDueFlashcards` — read + `.lte` | [`src/lib/flashcards/index.ts`](https://github.com/justynasz/10xcards/blob/7b4781d841f90354113fa1b27f03fcb06e419249/src/lib/flashcards/index.ts) | 39-48 |
| Existing spaced-repetition tests | [`src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts`](https://github.com/justynasz/10xcards/blob/7b4781d841f90354113fa1b27f03fcb06e419249/src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts) | 1-60 |
| Flashcard table creation (due_date col) | `supabase/migrations/20260525000000_create_flashcards.sql` | 11 |
| FSRS migration (metric columns) | `supabase/migrations/20260617200000_migrate_flashcards_to_fsrs.sql` | 7-14 |
| ts-fsrs Rating enum | `node_modules/ts-fsrs/dist/index.d.ts` | 9-15 |
| ts-fsrs default params (w weights, learning_steps) | `node_modules/ts-fsrs/dist/index.umd.js` | 535-574 |
| `BasicLearningStepsStrategy` (per-rating step logic) | `node_modules/ts-fsrs/dist/index.umd.js` | 288-341 |
| `applyLearningSteps` (minutes → due date) | `node_modules/ts-fsrs/dist/index.umd.js` | 1054-1090 |
| `BasicScheduler.newState` (entry for New cards) | `node_modules/ts-fsrs/dist/index.umd.js` | 1091-1104 |
| `next_interval` (Easy → 8 days) | `node_modules/ts-fsrs/dist/index.umd.js` | 860-866 |

---

## Architecture Insights

1. **`fsrs()` factory creates a new scheduler with default parameters on every `computeNextCard` call.** There is no singleton. This means the w weights are always the library defaults — which is correct for MVP but means any parameter customisation would require changing the call site at `src/lib/spaced-repetition/index.ts:22`.

2. **Short-term vs long-term scheduling split at the library level.** Again/Hard/Good from New state stay in the learning queue (`scheduled_days = 0`, due in minutes). Easy graduates immediately to Review (`scheduled_days = 8`, due in days). Tests that only check `scheduled_days > 0` cannot distinguish Easy from a broken Good.

3. **The `learning_steps: 0` field** in the service layer (`index.ts:18`) satisfies TypeScript but ts-fsrs ignores it — the scheduler uses its own parameter set. This is benign but explains why the real steps are ["1m", "10m"], not controlled by the app code.

4. **No fuzz.** `enable_fuzz = false` by default means intervals are deterministic: a test can assert exact values (1 min, 6 min, 10 min, 8 days) or tight ranges, not just "positive".

---

## Oracle: What Tests for R1 Must Assert

Based on the above, the assertions that would catch an FSRS scheduling regression:

```
New + Again:
  state ∈ {Learning(1), Relearning(3)}
  scheduled_days === 0
  due_date ∈ (now, now + 5 minutes)   // "1m" step; 5 min tolerance for test speed

New + Hard:
  state === Learning(1)
  scheduled_days === 0
  due_date ∈ (now + 3 min, now + 10 min)   // "~6m" step with tolerance

New + Good:
  state === Learning(1)
  scheduled_days === 0
  due_date ∈ (now + 5 min, now + 15 min)   // "10m" step with tolerance

New + Easy:
  state === Review(2)
  scheduled_days === 8
  due_date ∈ (now + 7 days, now + 9 days)  // exactly 8 days, 1-day tolerance

Review + Again:
  lapses === previousCard.lapses + 1
  state === Relearning(3)
```

Anti-pattern to avoid (per test-plan §2): asserting only `due_date > now()` — a date 6 months in the future passes this check, as does a date tomorrow for a learning-step card.

---

## Open Questions

1. **`learning_steps: 0` in `index.ts:18`** — the field is passed in the Card object but ts-fsrs ignores it. Should it be removed to avoid confusion, or kept for forward compatibility? Not a correctness issue for R1, but worth noting for a future cleanup.

2. **Supabase PostgREST suffix format** — does this deployment return `+00:00` or `Z` suffix for `timestamptz`? Both work with `new Date()`, but the existing test uses hardcoded `Z` strings. No test exercises the real DB format. Low risk, but a note for the test environment setup in the plan.

3. **`listDueFlashcards` string comparison** — `.lte("due_date", new Date().toISOString())` uses a string `<=` comparison on the server. For `timestamptz` this is fine because Postgres compares by timestamp value, not string. No bug, but worth documenting in the cookbook.

---

## Related Research

- `context/archive/2026-06-17-sr-review-session/research-ts-fsrs-docs.md` — ts-fsrs API patterns documented during S-02
- `context/archive/2026-06-17-sr-review-session/plan.md` — implementation plan that established the date pipeline
- `context/foundation/test-plan.md` — §2 Risk R1 row and Risk Response Guidance table
