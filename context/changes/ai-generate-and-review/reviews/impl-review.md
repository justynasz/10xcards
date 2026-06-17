<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: AI Card Generation and Review Flow

- **Plan**: context/changes/ai-generate-and-review/plan.md
- **Scope**: All Phases (1–4)
- **Date**: 2026-06-17
- **Verdict**: APPROVED (after triage fixes)
- **Findings**: 0 critical | 2 warnings | 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → FIXED |
| Architecture | PASS |
| Pattern Consistency | WARNING → FIXED |
| Success Criteria | PASS |

## Automated verification

- `npm run lint` ✅
- `npm test` 15/15 ✅ (1 new test added during review)
- `npm run build` ✅ (Phase 4.2)

## Manual verification

- 4.3 Happy path end-to-end ✅
- 4.4 Edit flow ✅
- 4.5 Error flow ✅
- 4.6 Validation ✅
- 4.7 OQ-2 manual quality check ✅

## Findings

### F1 — Wewnętrzne szczegóły błędów trafiają do UI

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — realne ryzyko information disclosure
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards/generate.ts:34–39
- **Detail**: err.message z openrouter service (zawierający pełny response body OpenRouter, Zod error details) był przekazywany wprost do klienta przez API route i wyświetlany w UI.
- **Fix Applied**: console.error(err) server-side + generyczny komunikat użytkownikowi w generate.ts i batch-create.ts.
- **Decision**: FIXED — commit fcdad70

### F2 — `<a>` zagnieżdżone w `<Button>` (nieprawidłowe HTML)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja; fix oczywisty
- **Dimension**: Safety & Quality
- **Location**: src/components/generate/GenerateView.tsx:171–173
- **Detail**: `<Button><a href="/dashboard">…</a></Button>` generuje `<button><a>` — nieprawidłowe HTML, accessibility issues.
- **Fix Applied**: `<Button variant="outline" asChild><a href="/dashboard">…</a></Button>` — shadcn/ui Button obsługuje asChild.
- **Decision**: FIXED — commit fcdad70

### F3 — batchCreateFlashcards owija błąd inaczej niż siostrzane funkcje

- **Severity**: 💡 OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: src/lib/flashcards/index.ts
- **Detail**: Inne funkcje rzucały surowy PostgrestError, batchCreateFlashcards owijał w new Error(). Niespójność była celowym fix-em w trakcie implementacji.
- **Fix Applied**: Ujednolicono wszystkie funkcje do `throw new Error(error.message)`.
- **Decision**: FIXED — commit fcdad70

### F4 — Stan edycji w CardReviewItem nie synchronizuje się przy zmianie props

- **Severity**: 💡 OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: src/components/generate/CardReviewItem.tsx:28–29
- **Detail**: editFront/editBack inicjalizowane raz przy mount. Teoretyczne ryzyko przy podmiance kart z otwartym editorem. ESLint blokuje useEffect+setState pattern.
- **Decision**: SKIPPED — ryzyko niskie przy obecnej architekturze; ESLint rule `react-hooks/set-state-in-effect` blokuje prostą naprawę.

### F5 — Brak testu dla HTTP non-ok w openrouter.test.ts

- **Severity**: 💡 OBSERVATION
- **Dimension**: Success Criteria
- **Location**: src/lib/openrouter/__tests__/openrouter.test.ts
- **Detail**: makeResponse nie mockował text(); gałąź !response.ok (wywołująca response.text()) była nieobjęta testami.
- **Fix Applied**: Dodano `text()` mock do makeResponse + test dla non-ok HTTP response (500).
- **Decision**: FIXED — commit fcdad70
