# FSRS Scheduling Correctness (R1) — Implementation Plan

## Overview

Rozszerza istniejące testy `computeNextCard` o asercje zakresu dat i `scheduled_days` per Rating, tak by regresja w harmonogramowaniu FSRS nie mogła przejść niezauważona. Przy okazji usuwa martwe pole `learning_steps: 0` z serwisu.

## Current State Analysis

Plik testowy `src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts` ma 6 testów korzystających z realnego ts-fsrs (brak mocków). Problem: asercje są zbyt słabe:
- `due_date > Date.now() - 1000` — przepuści datę za rok równie dobrze jak za minutę
- `scheduled_days > 0` — przepuści `scheduled_days = 365` dla Easy
- Brak pokrycia ratingu Hard

Pole `learning_steps: 0` w `src/lib/spaced-repetition/index.ts:18` jest przekazywane do ts-fsrs ale ignorowane przez bibliotekę — ts-fsrs używa własnych defaults (`["1m", "10m"]`). Jest mylące i powinno zostać usunięte.

## Desired End State

Każdy z 4 ratingów (Again/Hard/Good/Easy) dla nowej karty ma test z:
- asercją `state` (dokładna wartość, nie zbiór)
- asercją `scheduled_days` (dokładna wartość)
- asercją zakresu `due_date` (dolna i górna granica w ms)

Uruchomienie `npm test` wykrywa regresję, w której Again jest schedulowane na dni zamiast minut.

### Key Discoveries

- ts-fsrs v5.4.1, FSRS 6.0, `enable_fuzz = false` → interwały są deterministyczne (node_modules/ts-fsrs/dist/index.umd.js:535-574)
- Interwały dla nowej karty: Again +1min, Hard +6min, Good +10min, Easy +8 dni (szczegóły w research.md)
- `scheduled_days = 0` dla Again/Hard/Good (learning steps), `scheduled_days = 8` dla Easy (przechodzi bezpośrednio do Review)
- Stan po ocenie: Again/Hard/Good → Learning (1), Easy → Review (2)
- Pipeline `toISOString()` → `timestamptz` → `new Date()` jest bezstratny

## What We're NOT Doing

- Nie testujemy Review+Hard/Good/Easy — R1 skupia się na nowych kartach i `lapses` (już pokryte)
- Nie mockujemy ts-fsrs — testy integracyjne z realną biblioteką są tańsze i bardziej wiarygodne
- Nie zmieniamy logiki serwisu poza usunięciem martwego pola
- Nie konfigurujemy Stryker w tej fazie (mutation gate jest post-MVP per test-plan §4)
- Nie dotykamy R2 ani R3 — to osobne fazy w test-plan §3

## Implementation Approach

Dwie fazy sekwencyjne: najpierw cleanup serwisu (1 linia), potem wzmocnienie testów. Każda faza ma automatyczną weryfikację (`npm test` + `npm run lint`). Brak zmian w schemacie DB, API ani UI.

## Critical Implementation Details

**Przechwycenie `before` przed wywołaniem**: każdy test musi zapisać `const before = Date.now()` przed wywołaniem `computeNextCard()`, bo ts-fsrs oblicza `due` od momentu wywołania. Asercje dolnej i górnej granicy odnoszą się do tej wartości.

**Tightening stanu dla Again**: istniejący test używa `[1, 3]` (Learning lub Relearning). Dla nowej karty (state=0) rated Again, ts-fsrs zawsze zwraca Learning (1). Relearning (3) dotyczy tylko kart w stanie Review (2) ocenionych Again. Plan tightens to `toBe(1)`.

---

## Phase 1: Usuń martwe pole `learning_steps`

### Overview

Usuwa `learning_steps: 0` z obiektu `tsCard` w serwisie. Pole jest ignorowane przez ts-fsrs (biblioteka używa własnych defaults), więc usunięcie nie zmienia zachowania — eliminuje jedynie mylące pole z kodu produkcyjnego.

### Changes Required

#### 1. Serwis spaced-repetition

**File**: `src/lib/spaced-repetition/index.ts`

**Intent**: Usuń pole `learning_steps: 0` z literału obiektu `tsCard` (linia 18). Pole nie jest przechowywane w DB, nie wpływa na harmonogramowanie, a jego obecność sugeruje fałszywie że aplikacja kontroluje kroki uczenia.

**Contract**: `learning_steps: number` jest REQUIRED w interfejsie `Card` ts-fsrs (nie optional). Pole nie jest przechowywane w DB (S-02 impl-review F6 — skipped as MVP). Bezpieczny default: `learning_steps: 0` — pole pozostaje w `tsCard` jako stały stały MVP default. Phase 1 aktualizuje jedynie dokumentację: usuwa błędny opis "pole ignorowane/optional" z plan.md.

### Success Criteria

#### Automated Verification

- Brak nowych błędów lint na zmienionym pliku (CRLF pre-existing w całym projekcie — osobny tracking issue, nie blokuje fazy)
- Testy przechodzą: `npm test`

---

## Phase 2: Wzmocnij asercje FSRS (R1 oracle)

### Overview

Zastępuje słabe asercje `due_date > Date.now() - 1000` i `scheduled_days > 0` precyzyjnymi asercjami zakresu dat i dokładnych wartości. Dodaje brakujący test dla ratingu Hard. Po tej fazie każdy z 4 ratingów ma kompletny oracle.

### Changes Required

#### 1. Plik testowy — wzmocnienie istniejących testów + nowy test Hard

**File**: `src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts`

**Intent**: Dla każdego ratingu: (a) dodaj `const before = Date.now()` przed wywołaniem, (b) zastąp słabe asercje `due_date` dolną i górną granicą w ms, (c) dodaj `scheduled_days` assertion, (d) tighten `state` assertion. Dodaj nowy test `"New + Hard"`.

**Contract**: Tabela asercji per rating (tolerance ±30 s = ±30 000 ms):

| Rating | `state` | `scheduled_days` | `due` dolna granica | `due` górna granica |
|--------|---------|-----------------|---------------------|---------------------|
| Again  | `1` (Learning) | `0` | `before + 30_000` | `before + 90_000` |
| Hard   | `1` (Learning) | `0` | `before + 330_000` | `before + 390_000` |
| Good   | `1` (Learning) | `0` | `before + 570_000` | `before + 630_000` |
| Easy   | `2` (Review)   | `8` | `before + 7 * 86_400_000` | `before + 9 * 86_400_000` |

Wzorzec asercji (na przykładzie Again — pozostałe ratingi analogicznie):

```ts
it("New + Again → Learning (1), scheduled_days=0, due ≈ now+1min", () => {
  const before = Date.now();
  const result = computeNextCard(newCard(), "Again");
  const dueMs = new Date(result.due_date).getTime();
  expect(result.state).toBe(1);
  expect(result.scheduled_days).toBe(0);
  expect(dueMs).toBeGreaterThan(before + 30_000);
  expect(dueMs).toBeLessThan(before + 90_000);
});
```

Istniejące asercje `reps > 0`, round-trip ISO, `last_review !== null` i `lapses + 1` pozostają bez zmian.

### Success Criteria

#### Automated Verification

- Wszystkie testy przechodzą: `npm test`
- Lint przechodzi: `npm run lint`

#### Manual Verification

- Wstrzyknij tymczasowego buga w index.ts: zmień `new Date()` na `new Date(Date.now() + 86_400_000)` (przesuń `now` o dobę do przodu) — test Again powinien FAIL z komunikatem o przekroczeniu górnej granicy
- Przywróć kod, uruchom `npm test` — wszystkie testy GREEN

**Implementation Note**: Po przejściu automated verification i manual smoke-test, zatrzymaj się i potwierdź z człowiekiem przed ewentualnym przejściem do planowania R2/R3.

---

## Testing Strategy

### Unit Tests (Phase 2)

Lokalizacja: `src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts`

Pokrycie po zmianach:

| Scenariusz | Asercje |
|-----------|---------|
| New + Again | state, scheduled_days, date-range ±30s |
| New + Hard (nowy) | state, scheduled_days, date-range ±30s |
| New + Good | state, reps, scheduled_days, date-range ±30s |
| New + Easy | state, reps, scheduled_days=8, date-range ±1d |
| Review + Again | lapses+1 (bez zmian) |
| Format due_date | round-trip ISO (bez zmian) |
| last_review | not null (bez zmian) |

### Regression Smoke (manual)

Jeden ręczny test opisany w Phase 2 Manual Verification.

## References

- Research: `context/changes/testing-core-loop-integrity/research.md`
- Test-plan R1: `context/foundation/test-plan.md` §2 Risk R1, Risk Response Guidance
- ts-fsrs intervals: `node_modules/ts-fsrs/dist/index.umd.js:288-341, 1054-1104`
- Archive date pipeline: `context/archive/2026-06-17-sr-review-session/plan.md:68-71`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Usuń martwe pole `learning_steps`

#### Automated

- [x] 1.1 Lint przechodzi: `npm run lint` — 98e620d
- [x] 1.2 Testy przechodzą: `npm test` — 98e620d

### Phase 2: Wzmocnij asercje FSRS (R1 oracle)

#### Automated

- [x] 2.1 Wszystkie testy przechodzą: `npm test` — 41c9ce9
- [x] 2.2 Lint przechodzi: `npm run lint` — 41c9ce9

#### Manual

- [x] 2.3 Smoke-test regresji: tymczasowy bug w index.ts powoduje FAIL Again — test wyłapuje błąd — 41c9ce9
