# S-02: Sesja powtarzania SR (FSRS) — Implementation Plan

## Overview

Implementacja end-to-end sesji spaced repetition z algorytmem FSRS via `ts-fsrs`. Użytkownik wchodzi na `/review`, widzi karty due, przechodzi przez flow pytanie → odpowiedź → ocena (Again/Hard/Good/Easy), a app zapisuje nowy stan FSRS do Supabase. Wymaga migracji schematu DB z SM-2 na FSRS oraz aktualizacji istniejącego kodu serwisowego.

## Current State Analysis

Baza kodu jest SM-2-ready: schemat DB, typy TypeScript i funkcje serwisowe są zaimplementowane pod SM-2. Algorytm FSRS nie jest wdrożony. Szczegóły w `context/changes/sr-review-session/research.md`.

**Co istnieje i wymaga zmiany:**
- `supabase/migrations/20260525000000_create_flashcards.sql` — SM-2 fields: `easiness_factor`, `interval_days`, `repetitions`; kolumna `due_date` zachowana
- `src/lib/flashcards/types.ts` — `Flashcard` i `UpdateFlashcardSRDto` z polami SM-2; do przepisania na FSRS
- `src/lib/flashcards/index.ts:39-47` — `listDueFlashcards()` queries `due_date <= now()` — logika poprawna, typy do zaktualizowania
- `src/lib/flashcards/index.ts:58-66` — `updateFlashcardSR()` — logika poprawna, typy do zaktualizowania

**Co nie istnieje (do stworzenia):**
- Moduł `src/lib/spaced-repetition/`
- API routes `GET` i `POST` `/api/flashcards/review`
- React component `src/components/review/SessionView.tsx`
- Astro page `src/pages/review.astro`

### Key Discoveries

- `due_date` zachowane jako nazwa kolumny DB — ts-fsrs `Card.due` mapowane w kodzie serwisu
- Index `(user_id, due_date)` już istnieje — `listDueFlashcards()` korzysta bez zmian
- S-01 wzorzec do replikacji: `ViewState` union + auth guard + supabase null guard + Zod — `src/pages/api/flashcards/batch-create.ts`
- `ts-fsrs` `State` enum: `New=0, Learning=1, Review=2, Relearning=3`; `Rating` enum: `Again=1, Hard=2, Good=3, Easy=4`

## Desired End State

Po ukończeniu planu:
1. Tabela `flashcards` ma pola FSRS zamiast SM-2; istniejące karty S-01 startują ze stanem `New` i `due_date = now()`
2. `GET /api/flashcards/review` zwraca karty due dla użytkownika (lub `nextDue` gdy brak)
3. `POST /api/flashcards/review` przyjmuje `{cardId, rating}`, oblicza FSRS, zapisuje, zwraca zaktualizowaną kartę
4. `/review` to działająca strona: pytanie → odkryj odpowiedź → ocena → następna karta → ekran podsumowania
5. `/review` z brakiem kart due pokazuje komunikat z datą następnej powtórki

**Weryfikacja end-to-end**: zalogowany użytkownik wchodzi na `/review`, widzi kartę (front), klika "Pokaż odpowiedź", widzi back, klika ocenę, karta znika z sesji, po ostatniej karcie widzi ekran podsumowania.

### Key Discoveries

- ts-fsrs `Card.due` (Date) ↔ DB `due_date` (timestamptz/string) — mapowanie w serwisie
- ts-fsrs `Card.last_review` (Date|null) — nowa kolumna DB `last_review` (timestamptz, nullable)
- `createEmptyCard()` defaults: `stability=0, difficulty=0, state=0 (New), reps=0, lapses=0, elapsed_days=0, scheduled_days=0, last_review=null, due=now()`

## What We're NOT Doing

- Limitu kart na sesję — sesja zawiera wszystkie karty due
- Custom SR algorytmu — ts-fsrs off-the-shelf
- Edycji kart w trakcie sesji
- Historii sesji ani logowania czasu nauki
- Filtrowania kart po tagu/decku (brak takiego modelu)
- E2E testów (brak frameworka w projekcie)
- Client-side obliczeń FSRS (wszystko server-side)

## Implementation Approach

Cztery fazy w ścisłej kolejności zależności:
1. **Fundament DB** — migracja musi być pierwsza; blokuje kompilację jeśli typy niezgodne
2. **Logika FSRS** — moduł testowany w izolacji zanim wchodzi do route
3. **API** — backend gotowy przed UI; testowalny niezależnie (curl/Postman)
4. **UI** — konsumuje gotowe API; sesja testowana manualnie

Obliczenia FSRS server-side (API route → ts-fsrs → Supabase). React component tylko wysyła `{cardId, rating}` i odbiera zaktualizowaną kartę.

## Critical Implementation Details

**Mapowanie dat ts-fsrs ↔ DB**: ts-fsrs `Card` używa `Date` objects; DB i response JSON używają stringów ISO 8601. Serwis spaced-repetition musi deserializować wejście (`new Date(flashcard.due_date)`) i serializować wyjście (`.toISOString()`). `last_review` jest nullable — deserializacja: `flashcard.last_review ? new Date(flashcard.last_review) : null`.

**Rating string → ts-fsrs enum**: API przyjmuje `'Again' | 'Hard' | 'Good' | 'Easy'` (string). Mapowanie: `Rating[rating as keyof typeof Rating]` z importu ts-fsrs. To nie jest `Rating.Again` literalnie — trzeba użyć bracket notation.

**Kolumna `state` w DB**: przechowywana jako `int` (liczba), nie string. ts-fsrs `State` enum ma wartości 0–3. UPDATE w `updateFlashcardSR()` zapisuje liczbę. Typ TypeScript `state: number` w `UpdateFlashcardSRDto`.

---

## Phase 1: DB Migration + Type System

### Overview

Migracja Supabase usuwa pola SM-2 i dodaje pola FSRS z bezpiecznymi domyślnymi wartościami. Istniejące karty otrzymują wartości `createEmptyCard()`. Typy TypeScript aktualizowane aby kompilator wymuszał FSRS contract przez cały codebase.

### Changes Required

#### 1. Nowa migracja Supabase

**File**: `supabase/migrations/20260617200000_migrate_flashcards_to_fsrs.sql`

**Intent**: Usunąć kolumny SM-2, dodać kolumny FSRS z domyślnymi wartościami zgodnymi z `createEmptyCard()`. Istniejące karty automatycznie otrzymują stan `New` z `due_date = now()` (są natychmiast dostępne w sesji).

**Contract**: Kolumny do usunięcia: `easiness_factor`, `interval_days`, `repetitions`. Kolumny do dodania (wszystkie NOT NULL z DEFAULT z wyjątkiem `last_review`):

```sql
ALTER TABLE flashcards
  DROP COLUMN easiness_factor,
  DROP COLUMN interval_days,
  DROP COLUMN repetitions,
  ADD COLUMN stability  numeric  NOT NULL DEFAULT 0,
  ADD COLUMN difficulty numeric  NOT NULL DEFAULT 0,
  ADD COLUMN elapsed_days    int NOT NULL DEFAULT 0,
  ADD COLUMN scheduled_days  int NOT NULL DEFAULT 0,
  ADD COLUMN reps   int NOT NULL DEFAULT 0,
  ADD COLUMN lapses int NOT NULL DEFAULT 0,
  ADD COLUMN state  int NOT NULL DEFAULT 0,   -- 0 = State.New
  ADD COLUMN last_review timestamptz DEFAULT NULL;
```

`due_date` kolumna zachowana bez zmian (mapowanie z ts-fsrs `Card.due` realizowane w kodzie).

#### 2. Aktualizacja typów flashcard

**File**: `src/lib/flashcards/types.ts`

**Intent**: Zastąpić pola SM-2 polami FSRS w `Flashcard` i `UpdateFlashcardSRDto`. Dodać `last_review` do obu. `CreateFlashcardDto` i `UpdateFlashcardDto` bez zmian.

**Contract**: Nowy kształt `Flashcard` (pola FSRS zamiast SM-2):
- Usuń: `easiness_factor`, `interval_days`, `repetitions`
- Dodaj: `stability: number`, `difficulty: number`, `elapsed_days: number`, `scheduled_days: number`, `reps: number`, `lapses: number`, `state: number`, `last_review: string | null`
- Zachowaj: `due_date: string`

Nowy kształt `UpdateFlashcardSRDto`:
- Usuń: `easiness_factor`, `interval_days`, `repetitions`
- Dodaj: `stability: number`, `difficulty: number`, `elapsed_days: number`, `scheduled_days: number`, `reps: number`, `lapses: number`, `state: number`, `last_review: string | null`
- Zachowaj: `due_date: string`

### Success Criteria

#### Automated Verification

- Migracja aplikuje się lokalnie bez błędu: `npx supabase db reset`
- TypeScript kompiluje bez błędów: `npm run build`
- Linting przechodzi: `npm run lint`
- Istniejące testy przechodzą (żaden nie powinien używać usuniętych pól): `npm test`

#### Manual Verification

- Tabela `flashcards` w Supabase Studio ma kolumny FSRS zamiast SM-2
- Karty zapisane wcześniej przez S-01 widoczne w tabeli z wartościami FSRS defaults (stability=0, state=0)
- Dashboard nadal wyświetla karty bez błędu

**Implementation Note**: Po zakończeniu fazy i pozytywnej automatycznej weryfikacji — potwierdź manualnie że migracja przeszła na lokalnej bazie przed przejściem do Fazy 2.

---

## Phase 2: Moduł FSRS

### Overview

Instalacja `ts-fsrs` i stworzenie dedykowanego modułu serwisowego z logiką obliczania następnego stanu karty. Moduł testowany unit testami przed integracją z API.

### Changes Required

#### 1. Instalacja zależności

**File**: `package.json`

**Intent**: Dodać `ts-fsrs` jako produkcyjną zależność.

**Contract**: `npm install ts-fsrs`. Wersja 5.x (najnowsza stabilna). Zero runtime deps — nie zwiększa bundle o transitive dependencies.

#### 2. Typy modułu SR

**File**: `src/lib/spaced-repetition/types.ts`

**Intent**: Zdefiniować publiczne typy modułu: union type dla ocen i typ wyjściowy.

**Contract**:
```typescript
export type SRRating = 'Again' | 'Hard' | 'Good' | 'Easy';
```

Nie reeksportować typów ts-fsrs — moduł ukrywa zależność od biblioteki za własnym interfejsem.

#### 3. Implementacja serwisu SR

**File**: `src/lib/spaced-repetition/index.ts`

**Intent**: Eksportować `computeNextCard(card: Flashcard, rating: SRRating): UpdateFlashcardSRDto` — jedyną funkcję publiczną modułu. Enkapsuluje całą logikę ts-fsrs: deserializację dat, wywołanie schedulera, serializację wyniku na DTO zgodny z `updateFlashcardSR()`.

**Contract**: Funkcja:
1. Rekonstruuje ts-fsrs `Card` z `Flashcard`: `due = new Date(card.due_date)`, `last_review = card.last_review ? new Date(card.last_review) : undefined`, pozostałe pola bezpośrednio
2. Mapuje `SRRating` string na `Rating` enum: `Rating[rating as keyof typeof Rating]`
3. Wywołuje `fsrs().next(tsCard, new Date(), rating)` — `fsrs()` tworzy scheduler z domyślnymi parametrami
4. Mapuje wynik na `UpdateFlashcardSRDto`: `due_date = result.card.due.toISOString()`, `last_review = result.card.last_review?.toISOString() ?? null`, pozostałe pola numeric/int bezpośrednio

Nie eksportuje nic poza `computeNextCard` i `SRRating` (reeksport z types.ts).

#### 4. Unit testy

**File**: `src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts`

**Intent**: Weryfikować kontrakt `computeNextCard` z realnymi wywołaniami ts-fsrs (nie mockowanymi) — to integration point biblioteki.

**Contract**: Przypadki testowe:
- Nowa karta (state=0) + `Again` → wynik ma `reps=0`, `state` in {1, 3} (Learning/Relearning), `due_date` w przyszłości
- Nowa karta + `Good` → wynik ma `reps > 0`, `state=1` (Learning), `due_date` w przyszłości
- Nowa karta + `Easy` → wynik ma `reps > 0`, `scheduled_days > 0`
- Karta Review (state=2) + `Again` → `lapses` zwiększone o 1
- Serializacja: `due_date` w wyniku jest valid ISO 8601 string
- `last_review` w wyniku nie jest null (po pierwszym review)

### Success Criteria

#### Automated Verification

- Testy modułu przechodzą: `npm test`
- TypeScript kompiluje: `npm run build`
- Linting przechodzi: `npm run lint`

#### Manual Verification

- Brak

**Implementation Note**: Faza 2 jest samowystarczalna — testy weryfikują poprawność algorytmu niezależnie od reszty aplikacji.

---

## Phase 3: API Routes

### Overview

Dwa endpointy w jednym pliku route: `GET` pobiera karty due dla sesji (lub `nextDue` przy pustej sesji), `POST` przetwarza ocenę jednej karty przez FSRS i zapisuje wynik.

### Changes Required

#### 1. API route dla sesji SR

**File**: `src/pages/api/flashcards/review.ts`

**Intent**: `GET` — załadować dane sesji (karty due + opcjonalnie data następnej karty gdy brak due). `POST` — przetworzyć ocenę jednej karty: pobrać aktualny stan, wywołać `computeNextCard`, zapisać przez `updateFlashcardSR`, zwrócić zaktualizowaną kartę.

**Contract**:

`GET /api/flashcards/review`:
- Auth guard (`context.locals.user`) → 401
- Supabase null guard → 500
- Wywołuje `listDueFlashcards(supabase)` → tablica kart
- Jeśli pusta: dodatkowe zapytanie po `supabase.from('flashcards').select('due_date').gt('due_date', now).order('due_date', asc).limit(1)` → `nextDue: string | null`
- Response shape: `{ cards: Flashcard[], nextDue: string | null }`

`POST /api/flashcards/review`:
- Auth guard → 401
- Supabase null guard → 500
- Zod schema: `z.object({ cardId: z.string().uuid(), rating: z.enum(['Again', 'Hard', 'Good', 'Easy']) })`
- JSON parse guard (try/catch) → 400
- `safeParse` → 400 z `parsed.error.message`
- `getFlashcard(supabase, cardId)` — RLS zapewnia że user może pobrać tylko swoją kartę (404-like error z Supabase jeśli nie należy do usera)
- `computeNextCard(card, rating)` → DTO
- `updateFlashcardSR(supabase, cardId, dto)` → zaktualizowana karta
- Error logging: `console.error("[review POST] Error:", err)` → 500
- Response: `{ card: updatedCard }` status 200

### Success Criteria

#### Automated Verification

- TypeScript kompiluje: `npm run build`
- Linting przechodzi: `npm run lint`
- Testy modułu spaced-repetition nadal przechodzą (brak regresji): `npm test`

#### Manual Verification

- `GET /api/flashcards/review` (z sesją Supabase) zwraca `{ cards: [...], nextDue: null }` gdy są karty due
- `GET /api/flashcards/review` zwraca `{ cards: [], nextDue: "ISO string" }` gdy brak kart due
- `POST /api/flashcards/review` z `{cardId: validId, rating: "Good"}` zwraca `{ card: { ...fsrsFields } }` i pole `state` jest zaktualizowane
- `POST` bez autoryzacji zwraca 401

**Implementation Note**: Testowanie manualne routy wymaga działającej sesji Supabase (zalogowany użytkownik). Użyj `npm run dev` i zaloguj się przed testowaniem przez DevTools/curl z ciasteczkami sesji.

---

## Phase 4: Session UI

### Overview

Nowa strona `/review` z React component zarządzającym pełnym cyklem sesji: ładowanie kart, flip card flow (pytanie → odpowiedź → ocena), ekran podsumowania, empty state z datą następnej powtórki.

### Changes Required

#### 1. Dodanie /review do chronionych tras

**File**: `src/middleware.ts`

**Intent**: Wymagać autoryzacji dla strony sesji SR.

**Contract**: Dodać `"/review"` do tablicy `PROTECTED_ROUTES` (line 4 w aktualnym pliku).

#### 2. Astro page

**File**: `src/pages/review.astro`

**Intent**: Strona serwerowa montująca React island SessionView. Wzorzec identyczny jak `src/pages/generate.astro`.

**Contract**: Layout `<Layout title="Sesja powtarzania">`, montuje `<SessionView client:load />` z `src/components/review/SessionView`.

#### 3. SessionView component

**File**: `src/components/review/SessionView.tsx`

**Intent**: Główny komponent zarządzający pełnym cyklem sesji SR. Enkapsuluje wszystkie stany UI, komunikację z API i prezentację danych.

**Contract**:

ViewState union:
```typescript
type ViewState = "loading" | "session" | "flipped" | "saving" | "summary" | "empty";
```

Stan komponentu:
- `viewState: ViewState` — aktualny stan UI
- `cards: Flashcard[]` — karty sesji (niezmieniane, żeby śledzić kolejność)
- `currentIndex: number` — indeks aktualnej karty
- `nextDue: string | null` — data następnej karty (dla empty state)
- `results: { again: number; hard: number; good: number; easy: number }` — rozkład ocen dla podsumowania
- `errorMessage: string` — dla stanów błędu (opcjonalne, brak dedykowanego `"error"` ViewState — błędy pokazywane inline)

Przejścia stanów:
- `loading` → `session` (onMount fetch GET zwrócił karty)
- `loading` → `empty` (fetch zwrócił puste cards)
- `session` → `flipped` (klik "Pokaż odpowiedź")
- `flipped` → `saving` (klik oceny)
- `saving` → `session` (POST sukces, currentIndex++)
- `saving` → `summary` (POST sukces, currentIndex >= cards.length)

Widoki:
- **loading**: spinner (shadcn/ui `Skeleton` lub prosty)
- **session**: front karty, przycisk "Pokaż odpowiedź", numer karty "X / N"
- **flipped**: front + back karty, 4 przyciski ocen (Again/Hard/Good/Easy) z kolorami (czerwony/pomarańczowy/zielony/niebieski)
- **saving**: disabled przyciski + wskaźnik ładowania
- **summary**: "Sesja ukończona. Przejrzałeś N kart." + rozkład ocen (Again: X, Hard: Y, Good: Z, Easy: W) + przycisk "Wróć do dashboard"
- **empty**: "Brak kart do powtórki." + jeśli `nextDue`: "Następna powtórka: [sformatowana data]" + przycisk "Wróć do dashboard"

Formatowanie daty `nextDue`: `new Date(nextDue).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })`.

Użyć `cn()` z `@/lib/utils` do warunkowych klas przycisków ocen.

### Success Criteria

#### Automated Verification

- TypeScript kompiluje bez błędów: `npm run build`
- Linting przechodzi: `npm run lint`

#### Manual Verification

- `/review` bez zalogowania → redirect do `/auth/signin`
- `/review` zalogowany z kartami due: widać pytanie pierwszej karty i numer "1 / N"
- Klik "Pokaż odpowiedź" → odsłonięta odpowiedź, widoczne 4 przyciski ocen
- Klik dowolnej oceny → karta znika, pojawia się następna (lub podsumowanie)
- Po ostatniej karcie: ekran podsumowania z liczbą kart i rozkładem ocen
- Karta ma zaktualizowane pola FSRS w Supabase po ocenie (weryfikacja w Studio)
- `/review` gdy brak kart due: empty state z czytelnym komunikatem
- Jeśli `nextDue` dostępne: widoczna data następnej powtórki
- Brak regresji w `/generate` (S-01 flow nadal działa)

**Implementation Note**: Przetestuj pełny happy path ręcznie przed zgłoszeniem fazy jako gotowej. Sprawdź Supabase Studio po ocenie karty — `state`, `reps`, `due_date`, `last_review` powinny być zaktualizowane.

---

## Testing Strategy

### Unit Tests

- `src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts` — `computeNextCard` z realnymi ts-fsrs calls
  - Nowa karta + każda z 4 ocen (4 testy)
  - Karta Review state + Again (weryfikacja lapses)
  - Serializacja dat (ISO 8601 roundtrip)

### Integration Tests

- Brak osobnych integracyjnych — unit testy modułu SR używają realnej biblioteki (nie mockowanej), co jest integration testem warstwy ts-fsrs

### Manual Testing Steps

1. Zresetuj lokalną bazę: `npx supabase db reset` (weryfikacja migracji)
2. Zaloguj się na `/auth/signin`
3. Wygeneruj 3+ karty przez S-01 (`/generate`)
4. Wejdź na `/review` — powinny być widoczne (due_date = now() po migracji)
5. Dla każdej karty: przejdź pełny flip → oceń
6. Sprawdź podsumowanie po ostatniej karcie
7. Sprawdź Supabase Studio → tabela flashcards → pola FSRS zaktualizowane
8. Wejdź ponownie na `/review` → empty state (karty zaplanowane w przyszłości)
9. Sprawdź czy data następnej powtórki jest wyświetlana

## Migration Notes

Istniejące karty po migracji otrzymują `state=0` (New), `due_date=now()` (dzięki istniejącemu DEFAULT now() na kolumnie), `stability=0`, `difficulty=0`. Przy pierwszym wejściu na `/review` wszystkie karty będą due — to oczekiwane zachowanie (fresh start z FSRS).

Rollback: brak automatycznego rollbacku dla `DROP COLUMN`. Przed wdrożeniem na produkcję wykonać backup tabeli lub snapshot Supabase.

## References

- Research: `context/changes/sr-review-session/research.md`
- ts-fsrs API: `context/changes/sr-review-session/research-ts-fsrs-docs.md`
- Wzorzec S-01 API route: `src/pages/api/flashcards/batch-create.ts`
- Wzorzec S-01 ViewState: `src/components/generate/GenerateView.tsx`
- Istniejący serwis flashcards: `src/lib/flashcards/index.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: DB Migration + Type System

#### Automated

- [x] 1.1 Migracja aplikuje się lokalnie bez błędu: `npx supabase db reset` — a2c08d7
- [x] 1.2 TypeScript kompiluje bez błędów: `npm run build` — a2c08d7
- [x] 1.3 Linting przechodzi: `npm run lint` — a2c08d7
- [x] 1.4 Istniejące testy przechodzą: `npm test` — a2c08d7

#### Manual

- [x] 1.5 Tabela `flashcards` w Supabase Studio ma kolumny FSRS zamiast SM-2 — a2c08d7
- [x] 1.6 Karty zapisane przez S-01 widoczne z wartościami FSRS defaults — a2c08d7
- [x] 1.7 Dashboard nadal wyświetla karty bez błędu — a2c08d7

### Phase 2: Moduł FSRS

#### Automated

- [x] 2.1 Testy modułu spaced-repetition przechodzą: `npm test`
- [x] 2.2 TypeScript kompiluje: `npm run build`
- [x] 2.3 Linting przechodzi: `npm run lint`

### Phase 3: API Routes

#### Automated

- [ ] 3.1 TypeScript kompiluje: `npm run build`
- [ ] 3.2 Linting przechodzi: `npm run lint`
- [ ] 3.3 Testy modułu SR nadal przechodzą (brak regresji): `npm test`

#### Manual

- [ ] 3.4 GET `/api/flashcards/review` zwraca `{ cards: [...], nextDue: null }` gdy są karty due
- [ ] 3.5 GET `/api/flashcards/review` zwraca `{ cards: [], nextDue: "ISO string" }` gdy brak due
- [ ] 3.6 POST `/api/flashcards/review` z `{cardId, rating: "Good"}` zwraca zaktualizowaną kartę
- [ ] 3.7 POST bez autoryzacji zwraca 401

### Phase 4: Session UI

#### Automated

- [ ] 4.1 TypeScript kompiluje: `npm run build`
- [ ] 4.2 Linting przechodzi: `npm run lint`

#### Manual

- [ ] 4.3 `/review` bez zalogowania → redirect do `/auth/signin`
- [ ] 4.4 `/review` z kartami due: widoczna pierwsza karta i numer "1 / N"
- [ ] 4.5 Flip card flow: pytanie → "Pokaż odpowiedź" → odpowiedź + 4 przyciski ocen
- [ ] 4.6 Po ostatniej ocenie: ekran podsumowania z liczbą kart i rozkładem
- [ ] 4.7 Pola FSRS zaktualizowane w Supabase Studio po ocenie
- [ ] 4.8 Empty state: komunikat + data następnej powtórki
- [ ] 4.9 Brak regresji w `/generate` (S-01 flow nadal działa)
