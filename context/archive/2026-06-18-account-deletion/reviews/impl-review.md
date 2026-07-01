<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Account Deletion Implementation Plan

- **Plan**: context/changes/account-deletion/plan.md
- **Scope**: All 4 phases (full plan)
- **Date**: 2026-07-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Dashboard link to /account was never added

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/dashboard.astro
- **Detail**: Phase 4 §4 required adding a link/button to /account next to "Generate flashcards" so users can discover the new page. dashboard.astro only has links to /generate and (conditionally) /review — no /account link anywhere. Only reachable by typing the URL directly. Progress item 4.3 was checked off without this being true.
- **Fix**: Add an `<a href="/account">` link/button in the stat-card grid, styled consistently with the existing "Wygeneruj nowe fiszki" CTA card.
- **Decision**: FIXED — added "Ustawienia konta" link in src/pages/dashboard.astro below the review CTA

### F2 — signOut() after deletion is unguarded

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/delete-account.ts:51
- **Detail**: `await supabase.auth.signOut()` has no try/catch. Intentionally mirrors signout.ts's existing no-error-check pattern per the plan's instruction — not drift, low real-world risk since supabase-js signOut() returns `{error}` rather than throwing.
- **Fix**: No action needed — matches established codebase pattern by design.
- **Decision**: SKIPPED (no action needed)

### F3 — AdminClient is a hand-rolled interface, not SupabaseClient

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/account/types.ts
- **Detail**: flashcards/index.ts types against the real SupabaseClient; account/index.ts uses a minimal hand-rolled AdminClient interface for mockability. Deliberate and reasonable, structurally compatible.
- **Fix**: No action needed.
- **Decision**: SKIPPED (no action needed)
