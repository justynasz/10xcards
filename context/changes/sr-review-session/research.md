---
date: 2026-06-17T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: b72eca5a3e85c5636650a39a79c159856e7dba9e
branch: main
repository: 10xcards
topic: "S-02: Sesja powtarzania SR — integracja z bazą kodu + ocena research-ts-fsrs-docs.md"
tags: [research, codebase, sr-review-session, spaced-repetition, sm2, fsrs, flashcards]
status: complete
last_updated: 2026-06-17
last_updated_by: Claude Sonnet 4.6
---

# Research: S-02 — Sesja powtarzania SR

**Date**: 2026-06-17  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: b72eca5a3e85c5636650a39a79c159856e7dba9e  
**Branch**: main  
**Repository**: 10xcards

## Research Question

Czy plik `research-ts-fsrs-docs.md` z `context/changes/sr-review-session/` jest zgodny z aktualnym stanem bazy kodu? Zebrać dane do implementacji S-02.

---

## Summary

Baza kodu jest **SM-2 ready** — schemat DB, typy TypeScript, i funkcje serwisowe są już zaimplementowane pod algorytm SM-2. `research-ts-fsrs-docs.md` jest **technicznie poprawny** w opisie API ts-fsrs i analizie kompatybilności z Cloudflare Workers, ale **nie jest zgodny z bazą kodu** w jednym krytycznym punkcie: opisuje decyzję o przejściu na FSRS, co wymaga migracji schematu DB i przepisania typów/serwisów, które już istnieją pod SM-2.

**Kluczowe napięcie:** Roadmap S-02 mówi "algorytm SM-2", `change.md` mówi "FSRS via ts-fsrs". To otwarta decyzja architektoniczna z istotnymi konsekwencjami dla zakresu S-02.

---

## Detailed Findings

### 1. Aktualny schemat DB (`supabase/migrations/20260525000000_create_flashcards.sql`)

Tabela `flashcards` ma **pola SM-2** — żadnych pól FSRS:

| Kolumna | Typ | Domyślnie | Constraint |
|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | `auth.uid()` | FK → auth.users, ON DELETE CASCADE |
| `front` | `text` | — | NOT NULL |
| `back` | `text` | — | NOT NULL |
| `created_at` | `timestamptz` | `now()` | NOT NULL |
| `updated_at` | `timestamptz` | `now()` | NOT NULL |
| `easiness_factor` | `numeric(4,2)` | `2.50` | NOT NULL, CHECK >= 1.30 |
| `interval_days` | `int` | `1` | NOT NULL, CHECK >= 1 |
| `repetitions` | `int` | `0` | NOT NULL, CHECK >= 0 |
| `due_date` | `timestamptz` | `now()` | NOT NULL |

**Index**: `(user_id, due_date)` — zoptymalizowany pod pytania "pobierz karty due dla użytkownika".

**RLS**: 4 polityki (SELECT/INSERT/UPDATE/DELETE), wszystkie `user_id = auth.uid()`.

**Brak pól FSRS**: `stability`, `difficulty`, `state`, `elapsed_days`, `scheduled_days`, `reps`, `lapses` — nie istnieją.

### 2. Istniejące typy TypeScript (`src/lib/flashcards/types.ts`)

**`Flashcard`** (lines 1–12) — pola SM-2:
```typescript
interface Flashcard {
  id: string;
  user_id: string;
  front: string;
  back: string;
  created_at: string;
  updated_at: string;
  easiness_factor: number;  // SM-2
  interval_days: number;    // SM-2
  repetitions: number;      // SM-2
  due_date: string;         // SM-2 (ISO 8601)
}
```

**`UpdateFlashcardSRDto`** (lines 14–19) — gotowy DTO do aktualizacji SM-2 po sesji:
```typescript
interface UpdateFlashcardSRDto {
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
}
```

**`CreateFlashcardDto`** (lines 21–24) — tylko `front` + `back`.  
**`UpdateFlashcardDto`** (lines 26–29) — `front?` + `back?`.

### 3. Istniejące funkcje serwisowe (`src/lib/flashcards/index.ts`)

Kompletna warstwa DB dla S-02 jest **już zaimplementowana** pod SM-2:

| Funkcja | Linia | Opis |
|---|---|---|
| `listDueFlashcards(supabase)` | 39–47 | Pobiera karty gdzie `due_date <= now()`, sortuje rosnąco |
| `updateFlashcardSR(supabase, id, dto)` | 58–66 | Aktualizuje pola SM-2 po ocenie karty |
| `getFlashcard(supabase, id)` | 12–16 | Pobiera pojedynczą kartę |

`listDueFlashcards` używa kolumny `due_date` — przy FSRS musiałoby używać `due` (inna nazwa lub alias).

### 4. Brakujące elementy dla S-02 (oba algorytmy)

Niezależnie od wyboru algorytmu, **nie istnieje**:
- Moduł `src/lib/spaced-repetition/` (brak jakiegokolwiek SR algorithm code)
- API route dla sesji SR (brak `src/pages/api/flashcards/review.ts`)
- React component dla sesji SR (brak `src/components/review/`)
- Astro page `/review` (brak `src/pages/review.astro`)

### 5. Wzorce S-01 do replikacji w S-02

Z analizy implementacji `ai-generate-and-review`:

**API route pattern** (`src/pages/api/flashcards/batch-create.ts`):
```typescript
export const prerender = false;
export async function POST(context: APIContext) {
  if (!context.locals.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  // Zod validation → service call → Response.json
}
```

**ViewState pattern** (`src/components/generate/GenerateView.tsx:6–16`):
```typescript
type ViewState = "idle" | "loading" | "review" | "saving" | "success" | "error";
```

**Env imports** — zawsze przez `astro:env/server`, nigdy `import.meta.env`.

**Route protection** — dodać `/review` do `PROTECTED_ROUTES` w `src/middleware.ts:4`.

**Moduł lib** — konwencja: `src/lib/<name>/index.ts` + `types.ts` + `__tests__/`.

---

## Ocena `research-ts-fsrs-docs.md`

### Co jest poprawne ✅

1. **Analiza kompatybilności Cloudflare Workers** — `engines.node >= 20` to wymóg build-time, nie runtime. ts-fsrs to czysta matematyka (zero runtime deps) → działa na workerd. Analiza technicznie sound.
2. **Opis API ts-fsrs** — `createEmptyCard()`, `fsrs()`, `scheduler.next()`, `scheduler.repeat()`, serialization afterHandler — wszystko zgodne z dokumentacją biblioteki.
3. **Identyfikacja luki schematowej** — dokument poprawnie zauważa: "Schemat DB (F-01) przechowuje `easiness_factor`, `interval_days`, `repetitions`, `due_date` — to pola SM-2, nie FSRS. Wybór ts-fsrs wymagałby migracji schematu DB."

### Co jest niespójne z bazą kodu ⚠️

1. **Wewnętrzna sprzeczność w dokumencie**: Blok ostrzegawczy mówi "⚠️ przed użyciem trzeba zweryfikować kompatybilność lub użyć `supermemo` / inline SM-2", ale główny tekst twierdzi kompatybilność jest już potwierdzona. To nie jest niespójność z kodem, ale sygnał, że decyzja mogła nie być ostateczna gdy pisano dokument.

2. **Decyzja FSRS vs stan bazy kodu**: `change.md` deklaruje "Algorytm: FSRS via ts-fsrs" ale cała istniejąca infrastruktura (`UpdateFlashcardSRDto`, `listDueFlashcards`, `updateFlashcardSR`, index na `due_date`) jest SM-2. Dokument opisuje stan docelowy, nie aktualny.

3. **Niezgodność z roadmapem**: `context/foundation/roadmap.md` S-02 mówi "algorytm SM-2" w outcome. `change.md` mówi FSRS. Roadmap nie został zaktualizowany po decyzji o FSRS.

4. **Skala ocen**: ts-fsrs używa 4 ocen (Again/Hard/Good/Easy), SM-2 używa 0–5. `change.md` i roadmap mówią o "skali 0–5" — to SM-2, nie FSRS.

---

## Porównanie ścieżek implementacji

### Ścieżka A: SM-2 (supermemo lub inline ~20 linii)

**Zakres**: Mały — infrastruktura już gotowa.

| Element | Stan |
|---|---|
| Schemat DB | ✅ gotowy |
| Typy TS (`UpdateFlashcardSRDto`) | ✅ gotowy |
| `listDueFlashcards()` | ✅ gotowy |
| `updateFlashcardSR()` | ✅ gotowy |
| Migracja DB | ❌ nie potrzebna |
| Nowa zależność npm | `supermemo` (opcjonalnie) lub inline |
| `src/lib/spaced-repetition/` | do stworzenia (algorytm + testy) |
| API route `/api/flashcards/review` | do stworzenia |
| React session component | do stworzenia |
| Astro page `/review` | do stworzenia |

Uwaga na nazwy pól: `supermemo` zwraca `{ efactor, interval, repetition }` — potrzeba mapowania na `{ easiness_factor, interval_days, repetitions }` z `UpdateFlashcardSRDto`.

### Ścieżka B: FSRS via ts-fsrs v5.4.1

**Zakres**: Większy — wymaga migracji + przepisania istniejącego kodu.

| Element | Stan |
|---|---|
| Schemat DB | ❌ wymaga migracji (nowe pola FSRS, usunięcie SM-2) |
| Typy TS | ❌ `Flashcard` + `UpdateFlashcardSRDto` do przepisania |
| `listDueFlashcards()` | ⚠️ zmiana kolumny `due_date` → `due` |
| `updateFlashcardSR()` | ❌ nowy DTO z polami FSRS |
| Migracja DB | wymagana — nowe: `stability`, `difficulty`, `state`, `elapsed_days`, `scheduled_days`, `reps`, `lapses`; usunięcie/rename `easiness_factor`, `interval_days`, `repetitions` |
| Nowa zależność npm | `ts-fsrs` |
| `src/lib/spaced-repetition/` | do stworzenia |
| API route `/api/flashcards/review` | do stworzenia |
| React session component | do stworzenia |
| Astro page `/review` | do stworzenia |

**Risk**: Migracja istniejących kart — pole `easiness_factor` (SM-2) nie ma bezpośredniego odpowiednika w FSRS. Karty wygenerowane przez S-01 będą potrzebowały wartości startowych dla `stability`, `difficulty`, `state`.

---

## Architecture Insights

1. **`listDueFlashcards()` jest kluczową funkcją** dla S-02 — pobiera karty których `due_date <= now()`. Przy SM-2 działa bez zmian. Przy FSRS wymaga zmiany kolumny.

2. **Nie ma potrzeby Supabase RPC** dla obliczeń SR — roadmap wspomina to jako opcję dla Cloudflare CPU limits, ale obliczenia SM-2 (~1ms) i FSRS (~5ms) są poniżej limitu 50ms. Oblicz w Worker, zapisz wynik.

3. **Wzorzec sesji** — logika UI jest sekwencyjna (jedna karta naraz), więc `ViewState` union jak w S-01 jest odpowiednim wzorcem. Stany: `"loading"` → `"session"` → `"rating"` → `"saving"` → `"complete"` (brak kart due) / `"empty"`.

4. **Index `(user_id, due_date)`** już zoptymalizuje `listDueFlashcards()` bez dodatkowych zmian.

---

## Historical Context

- `context/changes/sr-review-session/research-sm2-libraries.md` — pierwsza analiza SM-2 libraries; rekomenduje `supermemo` lub inline SM-2. Napisana przed decyzją o FSRS.
- `context/changes/sr-review-session/research-ts-fsrs-docs.md` — dokumentacja ts-fsrs API; deklaruje decyzję o FSRS jako podjętą. Zawiera wewnętrzne sprzeczności sygnalizujące niepewność.
- `context/changes/sr-review-session/change.md` — status: `research`; decyzja: FSRS. Roadmap nie zaktualizowany.
- `context/archive/2026-06-16-ai-generate-and-review/` — wzorzec do replikacji dla S-02.

---

## Open Questions

1. ~~**SM-2 czy FSRS?**~~ **RESOLVED 2026-06-17:** FSRS via `ts-fsrs`. Roadmap zaktualizowany. Baza kodu wymaga migracji DB i przepisania typów/serwisów — uwzględnione w zakresie S-02.

2. **Migracja kart S-01** — Karty zapisane przez S-01 (SM-2 schema) potrzebują inicjalizacji pól FSRS. Rozwiązanie: `createEmptyCard()` z ts-fsrs jako wartości startowe dla nowych kolumn w migracji (`DEFAULT` w SQL). Istniejące karty staną się kartami `State.New` z `due = now()` — będą od razu w sesji. Block: no.

3. ~~**Skala ocen w UI**~~ **RESOLVED 2026-06-17:** FSRS → Again/Hard/Good/Easy (4 przyciski). Roadmap zaktualizowany.

---

## Code References

- `supabase/migrations/20260525000000_create_flashcards.sql` — pełny schemat flashcards (SM-2)
- [`src/lib/flashcards/types.ts`](src/lib/flashcards/types.ts) — `Flashcard`, `UpdateFlashcardSRDto`, `CreateFlashcardDto`
- [`src/lib/flashcards/index.ts:39-47`](src/lib/flashcards/index.ts) — `listDueFlashcards()` — kluczowa dla S-02
- [`src/lib/flashcards/index.ts:58-66`](src/lib/flashcards/index.ts) — `updateFlashcardSR()` — gotowa pod SM-2
- [`src/pages/api/flashcards/batch-create.ts`](src/pages/api/flashcards/batch-create.ts) — wzorzec API route do replikacji
- [`src/components/generate/GenerateView.tsx`](src/components/generate/GenerateView.tsx) — wzorzec ViewState + fetch pattern
- [`src/middleware.ts:4`](src/middleware.ts) — `PROTECTED_ROUTES` — dodać `/review`
- `context/changes/sr-review-session/change.md` — decyzja FSRS (do potwierdzenia)
- `context/changes/sr-review-session/research-sm2-libraries.md` — analiza SM-2 opcji
- `context/changes/sr-review-session/research-ts-fsrs-docs.md` — dokumentacja ts-fsrs API
