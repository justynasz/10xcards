# FSRS Scheduling Correctness (R1) — Plan Brief

> Full plan: `context/changes/testing-core-loop-integrity/plan.md`
> Research: `context/changes/testing-core-loop-integrity/research.md`

## What & Why

Istniejące testy `computeNextCard` asertują tylko że `due_date` jest w przyszłości — nie sprawdzają zakresu. Bug który scheduluje kartę "Again" na jutro zamiast na minutę przejdzie wszystkie obecne testy. Plan dodaje precyzyjne date-range assertions per Rating, gruntując oracle w dokumentacji ts-fsrs v5.4.1.

## Starting Point

`src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts` ma 6 testów z realnym ts-fsrs (bez mocków). Słabe asercje: `due_date > Date.now() - 1000` (brak górnej granicy) i `scheduled_days > 0` (brak dokładnej wartości). Rating Hard nie jest w ogóle testowany.

## Desired End State

Każdy z 4 ratingów ma kompletny oracle: dokładny `state`, `scheduled_days` i okno dat (dolna + górna granica). Wstrzyknięcie buga przesuwającego `now` o dobę powoduje FAIL testu Again w ciągu sekund.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| Pokrycie ratingów | Wszystkie 4 (Again/Hard/Good/Easy) | Hard jest niestestowany — regres w `learning_steps` przeszedłby niezauważony | Plan |
| Tolerancja dat | ±30 s wokół nominalnego interwału | Deterministyczne interwały (enable_fuzz=false) pozwalają na wąskie okno bez flakiness | Research |
| Tightening state dla Again | `toBe(1)` zamiast `[1, 3]` | New+Again zawsze → Learning(1); Relearning(3) dotyczy tylko kart w Review | Research |
| Cleanup `learning_steps: 0` | Usuń w tej samej fazie | Jedno pole, zero ryzyka — ts-fsrs ignoruje je od początku | Plan |
| Strategia testów | Integracja z real ts-fsrs, brak mocków | `ts-fsrs` to pure-math; mock kłamałby o interwałach lepiej niż prawdziwa biblioteka | Research |

## Scope

**In scope:**
- Usunięcie `learning_steps: 0` z `src/lib/spaced-repetition/index.ts`
- Wzmocnienie asercji dla Again, Good, Easy
- Nowy test dla Hard

**Out of scope:**
- R2 (batch-save error path) i R3 (AI malformed output) — osobne fazy
- Konfiguracja Stryker / mutation testing gate
- Testy ratingów dla kart w stanie Review (poza już istniejącym Review+Again)

## Architecture / Approach

Zmiany w dwóch plikach: produkcyjny `index.ts` (usunięcie 1 linii) + plik testowy (wzmocnienie 3 istniejących testów, 1 nowy test). Infrastruktura testowa (vitest) jest gotowa. Brak zmian DB, API, UI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|---------|
| 1. Usuń `learning_steps` | Czysty serwis bez martwego pola | Brak — ts-fsrs ignoruje pole, więc usunięcie jest behawioralnie przezroczyste |
| 2. Wzmocnij asercje (R1 oracle) | 7 testów z precyzyjnymi date-range assertions dla 4 ratingów | Asercja Hard (±30s wokół +6min) może być flaky na wolnym CI — tolerancja jest wystarczająca dla testów synchronicznych |

**Prerequisites:** Gotowe środowisko: `npm test` musi przechodzić przed zmianami.  
**Estimated effort:** ~1 sesja, 2 fazy; Phase 1 to minuty, Phase 2 to ~30 min.

## Open Risks & Assumptions

- `enable_fuzz = false` jest hardcoded default w ts-fsrs — jeśli ktoś w przyszłości włączy fuzz, testy będą flaky. Warte odnotowania w cookbook (test-plan §6.2).
- Hard: interwał "~6 min" = `round((1+10)/2) = 5.5` min zaokrąglone do 6 — okno ±30s jest wystarczające, ale zależy od wewnętrznej logiki zaokrąglania ts-fsrs.

## Success Criteria (Summary)

- `npm test` przechodzi ze wszystkimi 7 testami (4 ratingi + lapses + ISO format + last_review)
- Ręczny bug-injection (przesuń `now` o +1d) powoduje FAIL testu Again
- `npm run lint` przechodzi bez ostrzeżeń
