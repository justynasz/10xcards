<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: FSRS Scheduling Correctness (R1)

- **Plan**: context/changes/testing-core-loop-integrity/plan.md
- **Scope**: Phase 1 of 2
- **Date**: 2026-06-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — learning_steps jest REQUIRED w Card, nie optional

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — realny tradeoff; warto przemyśleć przed Phase 2
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/index.ts:8-18
- **Detail**: Plan stwierdził "TypeScript nie zgłasza błędu (pole jest opcjonalne w typie Card z ts-fsrs)" — faktycznie `learning_steps: number` jest REQUIRED w Card. TypeScript akceptuje brak pola przez structural accident. Runtime: ts-fsrs dostaje undefined zamiast 0. Dla nowych kart (wszystkie obecne testy) efekt identyczny. Dla kart mid-learning (step>0) może resetować do step 0. Pole nie jest przechowywane w DB (S-02 F6).
- **Fix A ⭐ Recommended**: Przywróć `learning_steps: 0` i popraw opis w plan.md
  - Strength: Bezpieczny — przywraca poprzedni stan; działa dla kart mid-learning i nowych.
  - Tradeoff: Phase 1 staje się zerową zmianą w index.ts; tylko korekta dokumentacji.
  - Confidence: HIGH — S-02 F6 potwierdził że 0 jest akceptowalny MVP default.
  - Blind spot: Nie sprawdziliśmy czy ts-fsrs rzuca TypeError dla undefined vs 0 dla kart w Learning state.
- **Fix B**: Zostaw jak jest — dodaj adnotację do plan.md
  - Strength: Utrzymuje "cleaner" kod bez martwego pola.
  - Tradeoff: Opiera się na niezdefiniowanym zachowaniu biblioteki; może pęknąć w ts-fsrs v6.
  - Confidence: MED — testy sugerują że działa, ale brak coverage dla kart mid-learning.
  - Blind spot: Brak testu dla karty w Learning state (step>0) z ratingiem innym niż Again.
- **Decision**: FIXED via Fix A — przywrócono learning_steps: 0 w index.ts; poprawiono Contract w plan.md

### F2 — Lint criterion 1.1 zaznaczony [x] ale faktycznie FAIL

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja; fix jest oczywisty
- **Dimension**: Success Criteria
- **Location**: context/changes/testing-core-loop-integrity/plan.md:173
- **Detail**: `1.1 Lint przechodzi: npm run lint` jest zaznaczone [x] — 98e620d, ale npm run lint i eslint na zmienionym pliku failują z 35 błędami `Delete ␍` (CRLF). Jest to systemowy pre-existing problem projektu (Windows checkout). Zmiana nie wprowadziła CRLF — plik miał je przed Phase 1. Ale kryterium 1.1 jest błędnie zaznaczone jako passed.
- **Fix**: Zaktualizuj kryterium 1.1 w plan.md — zmień tekst na "Brak nowych błędów lint na zmienionym pliku (CRLF to osobny tracking issue)".
- **Decision**: FIXED — tekst kryterium 1.1 zaktualizowany w plan.md

### F3 — Unguarded Rating enum cast (pre-existing)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — nie wprowadzone w tej fazie
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/index.ts:20
- **Detail**: `Rating[rating as keyof typeof Rating] as Grade` bez walidacji runtime. Dla niepoprawnego ratingu undefined as Grade → ts-fsrs rzuca lub zwraca garbage. Pre-existing, nie zmienione w Phase 1.
- **Fix**: Runtime guard `if (ratingEnum === undefined) throw new Error(...)`. Rozważyć w osobnym cleanup.
- **Decision**: PENDING

### F4 — elapsed_days deprecated w ts-fsrs (pre-existing)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — pre-existing
- **Dimension**: Safety & Quality
- **Location**: src/lib/spaced-repetition/index.ts:28
- **Detail**: `elapsed_days` deprecated w ts-fsrs; eslint-disable komentarz jest. Śledzić przy upgrade ts-fsrs v6.
- **Fix**: Brak akcji teraz.
- **Decision**: PENDING
