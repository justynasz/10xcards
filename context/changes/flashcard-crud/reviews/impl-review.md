<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Flashcard CRUD — Manual Create, Edit, Delete

- **Plan**: context/changes/flashcard-crud/plan.md
- **Scope**: All phases (1–3 of 3)
- **Date**: 2026-06-30
- **Verdict**: NEEDS ATTENTION → FIXED (all warnings resolved in a701df6)
- **Findings**: 0 critical  3 warnings  6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → FIXED |
| Architecture | PASS |
| Pattern Consistency | WARNING → FIXED |
| Success Criteria | PASS |

## Findings

### F1 — Empty PUT body silently accepted as no-op

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards/[id].ts:8–11
- **Detail**: updateSchema made both fields optional; sending {} passed Zod, fired updated_at, returned 200 with unchanged card.
- **Fix**: Added .refine() guard — require at least one field.
- **Decision**: FIXED via Fix A — a701df6

### F2 — handleSaveEdit has no in-flight guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/flashcards/FlashcardsListView.tsx:78–98
- **Detail**: Double-clicking "Zapisz" dispatched duplicate PUTs; stale response could overwrite optimistic state.
- **Fix**: Added `saving` state flag; disabled Zapisz while in flight.
- **Decision**: FIXED — a701df6

### F3 — handleConfirmDelete has no in-flight guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/flashcards/FlashcardsListView.tsx:111–125
- **Detail**: Double-clicking "Tak" dispatched two DELETEs; second returned 500 showing misleading error.
- **Fix**: Added `deleting` state flag; disabled Tak while in flight.
- **Decision**: FIXED — a701df6

### F4 — minLength not set as HTML attribute

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: FlashcardsListView.tsx:159–181
- **Detail**: Only maxLength set; min-1 enforced via JS button disabled logic. Correct approach for React controlled inputs.
- **Decision**: SKIPPED — JS enforcement is appropriate

### F5 — Labels not associated with textarea inputs

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: FlashcardsListView.tsx:158–182
- **Detail**: <label> elements lacked htmlFor/id pairing; screen readers couldn't associate label with control.
- **Fix**: Added id="new-front"/id="new-back" and htmlFor on create form; id={`edit-front-${card.id}`} pattern for edit forms.
- **Decision**: FIXED — a701df6

### F6 — Unnecessary cn() wrapping a static string

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: FlashcardsListView.tsx:290 (pre-fix line)
- **Detail**: cn("...") called with single static string — no-op; unused import left behind.
- **Fix**: Removed cn() wrapper; removed import.
- **Decision**: FIXED — a701df6

### F7 — updateFlashcard test missing DTO assertion

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: flashcards.test.ts:84–100
- **Detail**: Test asserted .eq() but not that supabase.update was called with the correct DTO.
- **Fix**: Added expect(supabase.update).toHaveBeenCalledWith({ front: "Updated question?" }).
- **Decision**: FIXED — a701df6

### F8 — deleteFlashcard test missing .delete() assertion

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: flashcards.test.ts:103–115
- **Detail**: Test only asserted .eq(); a regression replacing delete with update would pass.
- **Fix**: Added expect(supabase.delete).toHaveBeenCalled().
- **Decision**: FIXED — a701df6

### F9 — DELETE returns {} instead of 204 No Content

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/flashcards/[id].ts:67
- **Detail**: Returns Response.json({}) with 200; REST convention is 204. Client only checks r.ok so no functional impact.
- **Decision**: SKIPPED — client doesn't read body; 204 would require client changes for no benefit
