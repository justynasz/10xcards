# Flashcard Data Schema — Plan Brief

> Full plan: `context/changes/flashcard-data-schema/plan.md`

## What & Why

Istniejąca migracja startowa (`supabase/migrations/20260525000000_create_flashcards.sql`)
ma dwa problemy blokujące downstream slices: brakuje pól SM-2 wymaganych przez
algorytm spaced repetition (S-02), a kolumna `user_id` nie ma `DEFAULT auth.uid()`,
co powoduje błąd NOT NULL przy każdym `createFlashcard()`. Ten plan naprawia oba
problemy i rozszerza moduł TypeScript o typy i funkcje serwisowe potrzebne przez S-02.

## Starting Point

Starter template zawiera plik migracji z tabelą `flashcards` (id, user_id, front,
back, created_at, updated_at) oraz moduł `src/lib/flashcards/` z 5 funkcjami CRUD
i 4 testami. Migracja nie była jeszcze zaaplikowana na żadnej bazie — modyfikacja
in-place jest bezpieczna.

## Desired End State

Tabela `flashcards` zawiera pola SM-2 z rozsądnymi defaultami (`due_date = now()`,
`easiness_factor = 2.5`, `interval_days = 1`, `repetitions = 0`) — nowa karta od
razu trafia do kolejki review. `createFlashcard()` działa bez jawnego `user_id`.
Moduł TypeScript eksportuje `listDueFlashcards()` i `updateFlashcardSR()` gotowe
do użycia przez S-02.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Strategia migracji | Modyfikacja in-place | Migracja nie zaaplikowana — jedna czysta historia schematu | Plan |
| user_id handling | `DEFAULT auth.uid()` w DB | Idiomatic Supabase; RLS i DEFAULT eliminują potrzebę jawnego userId w każdej warstwie | Plan |
| Zakres service layer | Pełny (CRUD + listDue + updateSR) | S-02 blokuje się bez listDue/updateSR; zamknięcie F-01 w jednym planie | Plan |
| Indeks DB | `(user_id, due_date)` od razu | Zapytanie `WHERE due_date <= now()` jest core query S-02 — lepiej nie dodawać go retroaktywnie | Plan |
| Separacja DTOs | `UpdateFlashcardSRDto` oddzielnie od `UpdateFlashcardDto` | Edycja treści i aktualizacja SR to dwie różne operacje z różnymi uprawnieniami semantycznymi | Plan |

## Scope

**In scope:**
- `supabase/migrations/20260525000000_create_flashcards.sql` — dodanie DEFAULT + SM-2 + index
- `src/lib/flashcards/types.ts` — rozszerzenie Flashcard + nowy UpdateFlashcardSRDto
- `src/lib/flashcards/index.ts` — dodanie listDueFlashcards i updateFlashcardSR
- `src/lib/flashcards/__tests__/flashcards.test.ts` — aktualizacja factory + 4 nowe testy

**Out of scope:**
- Algorytm SM-2 (S-02)
- API routes / Zod validation (S-03)
- UI, React components, Astro pages (S-01, S-02, S-03)
- Supabase CLI setup i konfiguracja środowiska

## Architecture / Approach

Warstwa danych (Supabase) i warstwa serwisowa (TypeScript) są rozszerzane
niezależnie, ale w jednym planie. Supabase RLS na SELECT eliminuje potrzebę
jawnego filtra `user_id` w `listDueFlashcards` — query działa w kontekście
zalogowanego użytkownika. `DEFAULT auth.uid()` na kolumnie `user_id` eliminuje
bug z createFlashcard() i jest idiomatycznym wzorcem Supabase.

```
[createFlashcard({ front, back })]
        ↓
[Supabase insert]  ← DEFAULT auth.uid() ustawia user_id
        ↓
[RLS WITH CHECK (user_id = auth.uid())] ← weryfikacja
        ↓
[flashcards table]  ← pola SM-2 z defaultami dla nowej karty
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Database Schema | Kompletna migracja z SM-2 + DEFAULT + index | `DEFAULT auth.uid()` działa tylko w postgREST context; nie w bezpośrednim psql bez `SET ROLE` |
| 2. Types & Service | Typy TS + listDueFlashcards + updateFlashcardSR | Drobne rozbieżności między typem `due_date` (string ISO) a Supabase response |
| 3. Tests | 8+ testów pokrywających cały moduł | mock `makeSupabase` wymaga `.lte()` dla nowej funkcji |

**Prerequisites:** `supabase` CLI dostępne lokalnie do weryfikacji migracji (faza 1 manual);
`npm install` wykonane; `supabase start` do lokalnego testowania DB.

**Estimated effort:** ~1 sesja (~1-2 godziny), 3 fazy sekwencyjne.

## Open Risks & Assumptions

- Zakładamy, że migracja NIE była zaaplikowana na żadnej bazie. Jeśli była —
  wymagany plan B: nowy plik ALTER TABLE zamiast modyfikacji in-place.
- `DEFAULT auth.uid()` jest specyfiką Supabase/postgREST. Jeśli kod będzie
  uruchamiany poza tym kontekstem (np. testy integracyjne z bezpośrednim psql),
  insert bez user_id zawiedzie.

## Success Criteria (Summary)

- `npm test` przechodzi (≥ 8 testów)
- `npm run lint` bez błędów TypeScript
- Manualna weryfikacja: insert bez `user_id` tworzy wiersz z poprawnym `user_id`
  i polami SM-2 z defaultami
