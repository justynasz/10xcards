<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-02: Sesja powtarzania SR (FSRS)

- **Plan**: context/changes/sr-review-session/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-17
- **Verdict**: APPROVED (after fixes)
- **Findings**: 0 critical · 3 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (after fixes) |
| Architecture | PASS (after fix) |
| Pattern Consistency | PASS (after fixes) |
| Success Criteria | PASS |

## Findings

### F1 — SessionView nie sprawdza r.ok przed parsowaniem fetch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/review/SessionView.tsx:25-39
- **Detail**: fetch().then(r => r.json()) parsuje odpowiedź bez sprawdzenia r.ok. Błąd API (401/500) parsuje się do {error:"..."}, dostęp do brakującego .cards rzuca wyjątek, prawdziwy błąd jest ukryty. Niezgodne z wzorcem GenerateView.tsx:41.
- **Fix**: Dodaj if (!r.ok) throw new Error(...) w chain fetch.
- **Decision**: FIXED — e6d078a

### F2 — listDueFlashcards nie ma limitu wyników

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/flashcards/index.ts:39-46
- **Detail**: Brak .limit() — użytkownik z tysiącami przeterminowanych kart wczyta wszystkie do pamięci Cloudflare Workera (128 MB cap). Plan wyłączył limit z zakresu S-02.
- **Fix A ⭐**: Dodaj .limit(100) jako parametr z domyślną wartością.
- **Decision**: FIXED via Fix A — e6d078a

### F3 — SRRating zduplikowany w SessionView zamiast importowany

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/review/SessionView.tsx:7
- **Detail**: type SRRating lokalnie re-deklarowany zamiast importowany z @/lib/spaced-repetition.
- **Fix**: import type { SRRating } from "@/lib/spaced-repetition"
- **Decision**: FIXED — e6d078a

### F4 — Migracja DDL bez transakcji

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260617200000_migrate_flashcards_to_fsrs.sql
- **Detail**: DROP COLUMN + ADD COLUMN nie opakowane w BEGIN/COMMIT. Migracja już zastosowana.
- **Fix**: Owinąć DDL w BEGIN; ... COMMIT; (dla przyszłych migracji).
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Migracje Supabase z DDL destruktywnym muszą być opakowane w transakcję" — e6d078a

### F5 — Zapytanie nextDue inline w route zamiast w serwisie

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/api/flashcards/review.ts:24-31
- **Detail**: Zapytanie nextDue napisane bezpośrednio w route zamiast w service layer. Niespójne z wzorcem batch-create.ts.
- **Fix**: Wyekstrahuj do getNextDueDate() w src/lib/flashcards/index.ts.
- **Decision**: FIXED — e6d078a

### F6 — learning_steps: 0 może nie być standardowym polem FSRS-5

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/index.ts:18
- **Detail**: learning_steps: 0 dodane aby zaspokoić wymóg TypeScript. Pole nie jest przechowywane w DB. Testy przechodzą poprawnie. Znane ograniczenie MVP — nie wpływa na kluczowe pola FSRS (state, stability, reps).
- **Fix**: Dodać learning_steps do schematu DB w przyszłej iteracji.
- **Decision**: SKIPPED — acceptable for MVP
