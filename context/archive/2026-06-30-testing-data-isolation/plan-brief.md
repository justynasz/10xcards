# Data Isolation + CI Quality Gates — Plan Brief

> Full plan: `context/changes/testing-data-isolation/plan.md`

## What & Why

Phase 3 of the test rollout (R6 + CI gates). Supabase RLS jest jedyną warstwą izolacji dla operacji mutujących fiszki — jeśli ktoś przez pomyłkę użyje klienta service-role lub RLS jest źle skonfigurowane, nie ma żadnej siatki bezpieczeństwa w kodzie aplikacji. Dodajemy app-level ownership check i testy, które udowadniają, że cross-user request dostaje 403, nie silent no-op. Przy okazji `npm test` nigdy nie uruchamia się w CI — naprawiamy to.

## Starting Point

Routes `DELETE /api/flashcards/[id]` i `PUT /api/flashcards/[id]` filtrują po `id` bez sprawdzania `user_id` — przy cross-user cardId operacja milcząco nie trafia w żaden wiersz (RLS filtruje) i route oddaje 200. `createAdminClient()` (service-role, bypasuje RLS) istnieje w `src/lib/supabase.ts` ale nie jest używany — brak enforcement. CI od zawsze uruchamia lint + build, ale nie testy.

## Desired End State

DELETE i PUT zwracają 403 dla cross-user cardId. Testy jednostkowe pokrywają tę ścieżkę dla obu operacji. Guard test wychwytuje każde przyszłe importowanie `createAdminClient` w routach API. `npm test` blokuje merge przy czerwonych testach.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| IDOR protection layer | App-level check w route handlerze | Belt + suspenders — chroni nawet gdy RLS zawiedzie lub ktoś użyje service-role client |
| Operacje do pokrycia | DELETE + PUT | Oba są destructive; ownership check ląduje w tym samym miejscu w kodzie |
| Admin-client guard | Grep-test w `src/__tests__/security.test.ts` | 10 linii, łapie regresję natychmiast bez zmiany produkcyjnego kodu |
| CI placement | W istniejącym jobie `ci`, przed lint | Najprostsze; testy zajmują ~2s więc brak potrzeby osobnego joba |
| Fazy | 3 (IDOR \| CI gate \| docs) | Izolowane commity, każda faza weryfikowalna niezależnie |

## Scope

**In scope:**
- Ownership check w `[id].ts` DELETE i PUT
- Testy: DELETE cross-user → 403, PUT cross-user → 403, DELETE własna karta → 200, PUT własna karta → 200
- Admin-client guard test
- `npm test` w `ci.yml`
- `test-plan.md` §3 Phase 3 + §6.5 cookbook

**Out of scope:**
- `listFlashcards`, `listDueFlashcards`, `review.ts POST` — read-only lub low-stakes; RLS wystarczy
- Integration tests z prawdziwym Supabase — zbyt duże wymagania infrastrukturalne
- Zmiana funkcji serwisowych w `src/lib/flashcards/index.ts` — check żyje w routach

## Architecture / Approach

W `[id].ts`: przed mutacją wywołaj `getFlashcard(supabase, id)` → jeśli rzuci → 404; jeśli `card.user_id !== user.id` → 403; kontynuuj dopiero gdy ownership potwierdzone. Testy mockują `getFlashcard` z `vi.mock("@/lib/flashcards", ...)` — ten sam wzorzec co `batch-create.test.ts`. Guard test używa Node `fs` do odczytu plików z dysku i assercji na braku `createAdminClient`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Ownership check + IDOR tests | 403 dla cross-user + 4 testy IDOR + 1 guard test | `getFlashcard` throw-on-not-found wymaga dodatkowego try/catch |
| 2. CI gate | `npm test` blokuje merge | Brak — zmiana jednolinijkowa |
| 3. test-plan update | §3 Phase 3 + §6.5 cookbook | Brak |

**Prerequisites:** Fazy 1 i 2 rollout ukończone (`impl_reviewed`) — spełnione.  
**Estimated effort:** ~1 sesja, 3 fazy.

## Open Risks & Assumptions

- RLS policies na tabeli `flashcards` są założone jako poprawne — plan ich nie weryfikuje (ręczny Supabase Studio check poza zakresem).
- `getFlashcard` używa `.single()` który rzuca błąd gdy 0 wierszy — to pożądane zachowanie (→ 404), ale zakłada że Supabase error message nie zmieni się przy upgrade biblioteki.

## Success Criteria (Summary)

- `DELETE /api/flashcards/<other-user-card-id>` przez zalogowanego usera A zwraca 403
- `npm test` w CI blokuje PR gdy test jest czerwony
- §6.5 w test-planie zawiera gotowy do skopiowania wzorzec IDOR testu
