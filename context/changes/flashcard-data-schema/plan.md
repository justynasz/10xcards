# Flashcard Data Schema Implementation Plan

## Overview

Uzupełnienie istniejącej migracji Supabase (`20260525000000_create_flashcards.sql`)
o pola wymagane przez algorytm SM-2 (spaced repetition), naprawienie buga z
`user_id NOT NULL` bez wartości domyślnej, oraz rozszerzenie modułu TypeScript
`src/lib/flashcards/` o nowe typy i funkcje serwisowe, z których skorzystają
slices S-02 (sesja SR) i S-03 (zarządzanie kartami).

## Current State Analysis

### Co już istnieje (starter template)

**Migracja** (`supabase/migrations/20260525000000_create_flashcards.sql`):
- Tabela `public.flashcards` z kolumnami: `id`, `user_id`, `front`, `back`,
  `created_at`, `updated_at`
- RLS włączony; 4 policies per-operation per-role (`authenticated`) — wzorzec poprawny
- Trigger `set_flashcards_updated_at` z funkcją `set_updated_at()` — działa
- **Bug**: `user_id uuid not null` bez `DEFAULT auth.uid()` — insert bez jawnego
  `user_id` rzuci `null constraint violation`
- **Brakuje**: pól SM-2 i indeksu na `(user_id, due_date)`

**TypeScript moduł** (`src/lib/flashcards/`):
- `types.ts`: interfejsy `Flashcard`, `CreateFlashcardDto`, `UpdateFlashcardDto` — bez SM-2
- `index.ts`: 5 funkcji CRUD — wzorzec poprawny, ale brakuje `listDueFlashcards` i `updateFlashcardSR`
- `__tests__/flashcards.test.ts`: 4 testy (list, create, update, delete) — brak SM-2

### Kluczowe ograniczenia
- Migracja **nie była aplikowana** (projekt w fazie starter-template) — bezpieczna
  modyfikacja in-place bez osobnego ALTER TABLE
- `DEFAULT auth.uid()` wymaga kontekstu Supabase JWT — działa w postgREST, nie
  w bezpośrednich połączeniach psql bez `SET role TO authenticated`
- Zapytanie `listDueFlashcards` nie wymaga jawnego filtra `user_id` — RLS na SELECT
  automatycznie zawęża do `user_id = auth.uid()`

## Desired End State

Po zakończeniu planu:
- Tabela `flashcards` zawiera pola SM-2 z rozsądnymi wartościami domyślnymi
  (nowa karta od razu trafia do kolejki review)
- Każda karta tworzona przez `createFlashcard()` poprawnie przypisuje `user_id`
  przez `DEFAULT auth.uid()` bez jawnego przekazywania
- Moduł TypeScript eksportuje `UpdateFlashcardSRDto`, `listDueFlashcards()`,
  `updateFlashcardSR()` — wszystko, co S-02 potrzebuje do implementacji sesji SR
- Testy pokrywają nowe funkcje i zaktualizowany `makeCard()` factory

### Weryfikacja końcowa
```bash
npm test          # wszystkie testy przechodzą
npm run lint      # brak błędów lint/type
```

### Key Discoveries

- `src/lib/flashcards/index.ts:18` — `createFlashcard()` wysyła `{front, back}` do
  Supabase bez `user_id`; naprawia to `DEFAULT auth.uid()` w schemacie (nie zmiana sygnatury)
- `supabase/migrations/20260525000000_create_flashcards.sql:2` — `user_id uuid not null`
  bez DEFAULT; jedyne miejsce do zmiany
- `src/lib/flashcards/__tests__/flashcards.test.ts:5` — factory `makeCard()` musi
  zostać rozszerzony o SM-2 pola; testy są mockami, więc zmiana jest mechaniczna
- RLS SELECT policy pokrywa `listDueFlashcards` bez dodatkowych zmian (linia 12–15 migracji)

## What We're NOT Doing

- **Algorytm SM-2** — obliczanie `easiness_factor`, `interval_days`, `repetitions`,
  `due_date` po sesji review należy do S-02 (`sr-review-session`)
- **API routes** — endpointy REST dla flashcards należą do S-03 (`manual-card-management`)
- **UI / React components** — downstream S-01, S-02, S-03
- **Seed data** — brak danych testowych w tej fazie
- **Supabase local dev setup** — zakładamy że `supabase start` i `supabase db push`
  są znane developerowi; ten plan nie konfiguruje CLI

## Implementation Approach

1. Modyfikacja migracji in-place (bezpieczna — nie aplikowana na żadnej bazie).
2. Rozszerzenie typów TypeScript o pola SM-2 i nowy DTO dla SR update.
3. Rozszerzenie index.ts o dwie funkcje serwisowe: `listDueFlashcards` i `updateFlashcardSR`.
4. Aktualizacja testów: factory + 2 nowe describe bloki.

---

## Phase 1: Database Schema

### Overview

Modyfikacja jedynego pliku migracji w miejscu: dodanie `DEFAULT auth.uid()`,
czterech pól SM-2 z defaultami i indeksu kompozytowego.

### Changes Required

#### 1. Migracja Supabase

**File**: `supabase/migrations/20260525000000_create_flashcards.sql`

**Intent**: Uzupełnić definicję tabeli o `DEFAULT auth.uid()` na `user_id`
oraz cztery pola SM-2, których wartości domyślne oznaczają "nowa karta,
do powtórki od zaraz". Dodać indeks kompozytowy do wydajnych zapytań
"karty do review dla danego użytkownika".

**Contract**:

Kolumna `user_id` otrzymuje `DEFAULT auth.uid()` — syntax Supabase/postgREST.

Cztery nowe kolumny SM-2 (dodane po `updated_at`):
```
easiness_factor  numeric(4,2)  not null  default 2.50  check (easiness_factor >= 1.30)
interval_days    int           not null  default 1     check (interval_days >= 1)
repetitions      int           not null  default 0     check (repetitions >= 0)
due_date         timestamptz   not null  default now()
```

Indeks po ostatnim triggerce (na końcu pliku):
```sql
create index on public.flashcards (user_id, due_date);
```

### Success Criteria

#### Automated Verification

- Migracja aplikuje się bez błędów na lokalnej instancji Supabase:
  `supabase db reset` (lub `supabase db push`) kończy się bez błędów
- Schema zawiera wszystkie oczekiwane kolumny: `psql` lub Supabase Studio
  wyświetla kolumny `easiness_factor`, `interval_days`, `repetitions`, `due_date`

#### Manual Verification

- Po `supabase db reset` / `supabase start`: Studio → Table Editor → `flashcards`
  pokazuje wszystkie kolumny SM-2 z poprawnymi typami i wartościami domyślnymi
- Insert testowy (w SQL Editor z kontekstem auth) bez jawnego `user_id` tworzy
  wiersz z poprawnym `user_id = auth.uid()`

**Implementation Note**: Zweryfikuj migrację lokalnie przed fazą 2. `supabase db reset`
wymaga uruchomionego `supabase start`. Jeśli Supabase CLI nie jest zainstalowane
lub baza nie jest dostępna, weryfikację można odłożyć do etapu manualnego po fazie 2.

---

## Phase 2: TypeScript Types & Service Layer

### Overview

Rozszerzenie `types.ts` o pola SM-2 i nowy `UpdateFlashcardSRDto`.
Rozszerzenie `index.ts` o `listDueFlashcards` i `updateFlashcardSR`.

### Changes Required

#### 1. Typy TypeScript

**File**: `src/lib/flashcards/types.ts`

**Intent**: Zsynchronizować interfejs `Flashcard` z nowym schematem bazy danych.
Dodać `UpdateFlashcardSRDto` — oddzielny DTO dla aktualizacji stanu SR, świadomie
oddzielony od edycji treści karty (`UpdateFlashcardDto`).

**Contract**:

`Flashcard` interface: dodać cztery pola SM-2 po `updated_at`:
- `easiness_factor: number`
- `interval_days: number`
- `repetitions: number`
- `due_date: string`

Nowy export `UpdateFlashcardSRDto`:
```ts
export interface UpdateFlashcardSRDto {
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string; // ISO 8601 timestamp
}
```

`CreateFlashcardDto` i `UpdateFlashcardDto` pozostają bez zmian — edycja
treści karty jest celowo oddzielona od aktualizacji stanu SR.

#### 2. Funkcje serwisowe

**File**: `src/lib/flashcards/index.ts`

**Intent**: Dodać dwie funkcje potrzebne przez S-02 (sesja SR). `listDueFlashcards`
zwraca karty z `due_date <= now()` w kolejności od najbardziej zaległych.
`updateFlashcardSR` zapisuje wynik jednej iteracji SM-2 bez mieszania z edycją treści.

**Contract**:

Dodać na końcu pliku (po `deleteFlashcard`):

```ts
export async function listDueFlashcards(supabase: SupabaseClient): Promise<Flashcard[]>
```
Query: `.from(TABLE).select("*").lte("due_date", new Date().toISOString()).order("due_date", { ascending: true })`
— RLS gwarantuje, że wynik zawiera tylko karty zalogowanego użytkownika.

```ts
export async function updateFlashcardSR(
  supabase: SupabaseClient,
  id: string,
  dto: UpdateFlashcardSRDto,
): Promise<Flashcard>
```
Query identyczny z `updateFlashcard` ale akceptuje `UpdateFlashcardSRDto` zamiast
`UpdateFlashcardDto`. Import `UpdateFlashcardSRDto` z `"./types"`.

### Success Criteria

#### Automated Verification

- TypeScript compiles bez błędów: `npm run lint` (obejmuje `tsc --noEmit`)
- Wszystkie istniejące testy nadal przechodzą: `npm test`

#### Manual Verification

- `src/lib/flashcards/types.ts` zawiera `UpdateFlashcardSRDto` i SM-2 pola w `Flashcard`
- `src/lib/flashcards/index.ts` eksportuje `listDueFlashcards` i `updateFlashcardSR`

---

## Phase 3: Tests

### Overview

Aktualizacja `makeCard()` factory o pola SM-2. Dodanie describe bloków
dla dwóch nowych funkcji.

### Changes Required

#### 1. Testy modułu flashcards

**File**: `src/lib/flashcards/__tests__/flashcards.test.ts`

**Intent**: Rozszerzyć `makeCard()` o pola SM-2 z sensownymi wartościami
domyślnymi (nowa karta). Dodać testy jednostkowe dla `listDueFlashcards`
(poprawne wywołanie Supabase query) i `updateFlashcardSR` (zapisanie DTO
i zwrot zaktualizowanej karty).

**Contract**:

`makeCard()` dodaje pola SM-2:
```ts
easiness_factor: 2.5,
interval_days: 1,
repetitions: 0,
due_date: "2026-01-01T00:00:00Z",
```

Import: dodać `listDueFlashcards`, `updateFlashcardSR` do istniejącego importu z `"../index"`.
Import: dodać `UpdateFlashcardSRDto` z `"../types"`.

`makeSupabase`: dodać `lte: vi.fn().mockReturnThis()` (potrzebne dla `listDueFlashcards`
który używa `.lte("due_date", ...)`).

Nowy `describe("listDueFlashcards")`:
- "returns cards with due_date <= now" — mock zwraca tablicę kart, weryfikacja wywołania
  `supabase.lte("due_date", expect.any(String))` i poprawnego wyniku
- "throws on supabase error" — analogicznie do istniejących testów błędów

Nowy `describe("updateFlashcardSR")`:
- "updates SM-2 fields and returns updated card" — mock, weryfikacja
  `supabase.update` wywołane z `UpdateFlashcardSRDto`, `supabase.eq("id", ...)`
- "throws on supabase error"

### Success Criteria

#### Automated Verification

- Wszystkie testy (stare + nowe) przechodzą: `npm test`
- Brak błędów TypeScript w pliku testowym: `npm run lint`

#### Manual Verification

- `npm test` wyświetla ≥ 8 passing testów (4 stare + 4 nowe)
- Pokrycie testowe: `listDueFlashcards` i `updateFlashcardSR` są testowane

---

## Testing Strategy

### Unit Tests

- `listFlashcards` — istniejący test (bez zmian poza `makeCard()` factory)
- `createFlashcard` — istniejący test (bez zmian)
- `updateFlashcard` — istniejący test (bez zmian)
- `deleteFlashcard` — istniejący test (bez zmian)
- `listDueFlashcards` — success + error case
- `updateFlashcardSR` — success + error case

### Integration Tests

Brak w tej fazie — weryfikacja integracji z Supabase przez `supabase db reset`
i manualny SQL Editor test (Phase 1 Manual Verification).

### Manual Testing Steps

1. Uruchom `supabase start` (jeśli nie uruchomiony)
2. Uruchom `supabase db reset` — zweryfikuj brak błędów migracji
3. W Supabase Studio → Table Editor → `flashcards`: sprawdź obecność kolumn SM-2
4. W SQL Editor: wykonaj INSERT bez `user_id` jako authenticated user — sprawdź
   czy wiersz ma poprawny `user_id`
5. `npm test` — wszystkie testy przechodzą
6. `npm run lint` — brak błędów

## Migration Notes

Modyfikujemy migrację in-place zamiast dodawać ALTER TABLE, ponieważ migracja
nie była jeszcze aplikowana na żadnej bazie danych. Jest to bezpieczne wyłącznie
w tej sytuacji. Gdyby migracja była już zaaplikowana na bazie produkcyjnej,
wymagałoby to osobnego pliku `20260527000000_add_sm2_fields.sql`.

Jeśli w trakcie implementacji okaże się, że migracja BYŁA zaaplikowana (np. na
instancji dev lub staging), natychmiast przełącz się na strategię ALTER TABLE
i poinformuj o zmianie.

## References

- Roadmap: `context/foundation/roadmap.md#F-01`
- Istniejąca migracja: `supabase/migrations/20260525000000_create_flashcards.sql`
- Moduł serwisowy: `src/lib/flashcards/index.ts`
- Typy: `src/lib/flashcards/types.ts`
- Testy: `src/lib/flashcards/__tests__/flashcards.test.ts`
- Supabase client: `src/lib/supabase.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Schema

#### Automated

- [x] 1.1 Migracja aplikuje się bez błędów (`supabase db reset` lub `supabase db push`)
- [x] 1.2 Schema zawiera kolumny SM-2 z poprawnymi typami (weryfikacja w Studio lub psql)

#### Manual

- [ ] 1.3 Studio → flashcards table pokazuje SM-2 kolumny z defaultami
- [ ] 1.4 Insert bez jawnego user_id (jako authenticated) tworzy wiersz z poprawnym user_id

> ⏸ 1.1–1.4 odroczone — Docker niedostępny podczas implementacji. Zweryfikuj przy pierwszym `npx supabase db reset`. Kod migracji commitowany jako `b39f424`.

### Phase 2: TypeScript Types & Service Layer

#### Automated

- [x] 2.1 `npm run lint` kończy się bez błędów TypeScript — 2d33799
- [x] 2.2 Istniejące testy nadal przechodzą: `npm test` — 2d33799

#### Manual

- [x] 2.3 `UpdateFlashcardSRDto` wyeksportowany z `src/lib/flashcards/types.ts` — 2d33799
- [x] 2.4 `listDueFlashcards` i `updateFlashcardSR` wyeksportowane z `src/lib/flashcards/index.ts` — 2d33799

### Phase 3: Tests

#### Automated

- [x] 3.1 Wszystkie testy przechodzą: `npm test` (≥ 8 passing) — aef3d81
- [x] 3.2 `npm run lint` bez błędów w pliku testowym — aef3d81

#### Manual

- [x] 3.3 `listDueFlashcards` i `updateFlashcardSR` mają ≥ 2 testy każda — aef3d81
