# R2/R3 Error-Path Tests — Plan Brief

> Full plan: `context/changes/testing-r2-r3-error-paths/plan.md`

## What & Why

Udowodnić, że aplikacja nigdy nie milczy po błędzie: gdy batch-save zawiedzie, UI pokazuje komunikat błędu (nie "Dodano X fiszek"); gdy AI zwróci zły JSON lub timeout, API zwraca opisowy błąd (nie 200 z pustą tablicą) i UI pokazuje Retry. To bezpośrednia ochrona przed R2 (cichy błąd = utrata zaakceptowanych kart) i R3 (błąd AI = utrata całej sesji).

## Starting Point

Serwisy są już pokryte: `batchCreateFlashcards` i `generateFlashcards` mają testy jednostkowe weryfikujące, że rzucają wyjątek na błąd. Brakuje testów na poziomie API route (czy błąd dociera do klienta jako poprawny HTTP status) i na poziomie UI (czy `GenerateView` faktycznie przechodzi do `error` state, nie `success`).

## Desired End State

`npm test` uruchamia 3 nowe pliki testowe (8 nowych przypadków). Testy API route sprawdzają HTTP status i body dla ścieżek błędów obu route'ów. Testy RTL sprawdzają, że `GenerateView` nigdy nie wchodzi w `success`/`review` state gdy fetch zwraca non-2xx. `test-plan.md` §4 odzwierciedla RTL zainstalowane w Phase 1.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-----------------|--------|
| Zainstalować RTL teraz (nie w Phase 2) | Tak — w tym change | R2/R3 wymagają weryfikacji UI layer; deferral do Phase 2 zostawiałby ryzyka niepokryte | Plan |
| Warstwa UI dla R2/R3 | RTL + vi.stubGlobal("fetch") | Najtańszy sposób na weryfikację state machine bez e2e; zgodny z obecnym wzorcem w openrouter.test.ts | Plan |
| Environment jsdom | tylko src/components/** (environmentMatchGlobs) | Route i serwis testy nie potrzebują DOM; globalne jsdom leakuje DOM globals do node tests | Plan |
| Scope route tests | generate: 2 testy, batch-create: 2 testy | Auth guard + error propagation dla obu route'ów | Plan |
| Nie testować happy path w tym change | pominięte | Happy path nie jest częścią R2/R3; serwis testy pokrywają warstwę niżej | Plan |

## Scope

**In scope:**
- Instalacja `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- Update `vitest.config.ts` (`environmentMatchGlobs`)
- Route test: `generate.ts` — 2 testy (generic throw → 500, timeout → 504)
- Route test: `batch-create.ts` — 2 testy (no user → 401, throw → 500)
- Component test: `GenerateView` — 2 testy (R3: generate error, R2: save error)
- Update `test-plan.md` §4 Stack table

**Out of scope:**
- `handleRetry` behaviour po error (R4 — Phase 2)
- Auth boundary dla nowych routes (R5 — Phase 2)
- IDOR / cross-user (R6 — Phase 3)
- Happy path GenerateView (generate + save success)

## Architecture / Approach

Route tests wywołują `POST` funkcję bezpośrednio (import + call) z minimalnym `APIContext` stubem — zero HTTP serwera. Zależności (serwis, `astro:env/server`) mockowane przez `vi.mock`. Component testy renderują `GenerateView` przez RTL z globalnie mockowanym `fetch` — dwa `mockResolvedValueOnce` do symulowania sekwencji generate → save dla testu R2.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. RTL & Vitest Setup | packages + config + test-plan update | Niezgodność wersji @testing-library z React 19 |
| 2. API Route Unit Tests | 4 testy (2 pliki), pokrycie HTTP boundary | `astro:env/server` mock musi być hoisted przed importem route |
| 3. GenerateView RTL Tests | 2 testy, pokrycie UI state machine | R2 test wymaga dwu-fetchowej sekwencji; kolejność mockResolvedValueOnce krytyczna |

**Prerequisites:** Phase 1 musi być ukończona przed Phase 3 (jsdom potrzebne do RTL). Phase 2 niezależna od Phase 3.

**Estimated effort:** ~1 sesja, 3 fazy sekwencyjne.

## Open Risks & Assumptions

- React 19 + `@testing-library/react` — wersja RTL kompatybilna z React 19 to `^16.x`; jeśli npm zainstaluje starszą, testy mogą nie renderować komponentów poprawnie.
- `shadcn/ui` Button w jsdom — komponenty UI renderują się poprawnie w jsdom bez dodatkowego setup (zakładam brak CSS-zależnych efektów ubocznych).

## Success Criteria (Summary)

- `npm test` — wszystkie nowe i stare testy zielone
- Testy R2/R3 FAIL gdy bug jest wstrzyknięty (np. `setViewState("success")` zamiast `setViewState("error")`)
- `npm run lint` przechodzi
