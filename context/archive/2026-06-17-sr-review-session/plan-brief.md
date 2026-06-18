# S-02: Sesja powtarzania SR (FSRS) — Plan Brief

> Full plan: `context/changes/sr-review-session/plan.md`
> Research: `context/changes/sr-review-session/research.md`

## What & Why

Implementacja sesji spaced repetition zamykającej North Star loop projektu: użytkownik wkleja tekst → AI generuje karty (S-01, done) → **przegląda je w sesji SR i uczy się (S-02)**. Bez S-02 produkt jest generatorem fiszek bez nauki. S-02 używa algorytmu FSRS (dokładniejszy od SM-2) via `ts-fsrs`.

## Starting Point

Baza kodu ma gotową infrastrukturę SM-2: schemat DB (`easiness_factor`, `interval_days`, `repetitions`), typy TypeScript, i funkcje serwisowe (`listDueFlashcards`, `updateFlashcardSR`). Brak jakiegokolwiek kodu sesji SR — nie istnieje moduł algorytmu, API route ani UI. Migracja DB z SM-2 na FSRS jest wymagana.

## Desired End State

Zalogowany użytkownik wchodzi na `/review`, widzi kartę (pytanie), klika "Pokaż odpowiedź", widzi odpowiedź, ocenia ją (Again/Hard/Good/Easy). Po ostatniej karcie widzi ekran podsumowania z rozkładem ocen. Gdy brak kart due — komunikat z datą następnej powtórki. Pola FSRS (`stability`, `difficulty`, `state`, `reps`, `lapses`) zapisane w Supabase po każdej ocenie.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego | Source |
|---|---|---|---|
| Algorytm SR | FSRS via `ts-fsrs` | Dokładniejszy od SM-2, zero runtime deps, kompatybilny z Cloudflare Workers | Research |
| Nazwa kolumny due | Zachowaj `due_date` | Mniejsze ryzyko migracji; mapowanie Card.due ↔ due_date w kodzie | Plan |
| Inicjalizacja kart SM-2 | `createEmptyCard()` defaults | Prosta migracja SQL z DEFAULT; karty startują jako New | Plan |
| Usunięcie pól SM-2 | W tej samej migracji | Czysty schemat bez redundancji | Plan |
| Flow karty | Pytanie → odkryj odpowiedź → oceń | Klasyczny flip-card (Anki) — wymusza aktywne przypomnienie | Plan |
| Koniec sesji | Ekran podsumowania | Zamknięcie pętli; użytkownik widzi wynik | Plan |
| Empty state | Komunikat + nextDue na /review | Użytkownik wie kiedy wrócić | Plan |
| Obliczenia FSRS | Server-side (API route) | Jedno zaufane miejsce; klucz prywatny nie potrzebny po stronie klienta | Plan |
| Limit sesji | Brak limitu (wszystkie due) | Brak arbitralnego limitu; backlog przetwarza się w całości | Plan |
| Testy | Unit (algorytm) + integration (ts-fsrs call real) | Wzorzec S-01; weryfikuje kontrakt bez E2E | Plan |

## Scope

**In scope:**
- Migracja Supabase: DROP SM-2 cols, ADD FSRS cols
- Aktualizacja typów TS (`Flashcard`, `UpdateFlashcardSRDto`)
- Nowy moduł `src/lib/spaced-repetition/` z `computeNextCard()`
- `GET /api/flashcards/review` (karty due + nextDue)
- `POST /api/flashcards/review` (ocena karty → FSRS → zapis)
- `src/pages/review.astro` + `src/components/review/SessionView.tsx`
- Route protection `/review` → `/auth/signin`

**Out of scope:**
- Limit kart na sesję
- Historia sesji / statystyki długoterminowe
- Edycja kart podczas sesji
- Client-side FSRS (bundle klienta)
- E2E testy

## Architecture / Approach

```
/review (Astro page)
  └── SessionView (React island)
        ├── GET /api/flashcards/review  ←── listDueFlashcards()
        └── POST /api/flashcards/review ←── computeNextCard() → updateFlashcardSR()
                                                    ↑
                                         src/lib/spaced-repetition/
                                              (ts-fsrs wrapper)
```

Każda ocena = round-trip do API. Dane sesji trzymane w React state (cards[], currentIndex). Supabase RLS gwarantuje że user widzi i modyfikuje tylko swoje karty.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB Migration + Type System | Schemat FSRS w bazie, typy TS zaktualizowane | DROP COLUMN nieodwracalny — zrób backup przed prod |
| 2. Moduł FSRS | `computeNextCard()` z unit testami | Mapowanie dat (Date ↔ ISO string) — pokryte testami |
| 3. API Routes | GET + POST `/api/flashcards/review` | RLS guard na cardId (user nie może oceniać cudzych kart) |
| 4. Session UI | Pełna sesja flip-card + podsumowanie + empty state | Wizualna regresja `/generate` (S-01 flow) |

**Prerequisites:** S-01 done (✓), lokalne Supabase CLI działa, zmienne środowiskowe w `.dev.vars`  
**Estimated effort:** ~3 sesje implementacyjne (4 fazy)

## Open Risks & Assumptions

- `ts-fsrs` v5.x API może mieć drobne różnice względem dokumentacji z research.md — zweryfikuj po `npm install` przez `import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'`
- Istniejące karty S-01 po migracji będą miały `due_date = now()` (DEFAULT) — wszystkie będą due przy pierwszej sesji. Oczekiwane, ale może zaskoczyć użytkownika przy dużej liczbie kart
- Brak limitu sesji: jeśli user ma 200+ kart due po dłuższej przerwie, sesja będzie długa — akceptowalne dla MVP, ale warto odnotować

## Success Criteria (Summary)

- Użytkownik może przejść pełną sesję SR: pytanie → odpowiedź → ocena → podsumowanie
- Po ocenie, pola FSRS w Supabase są zaktualizowane (`state`, `reps`, `due_date`, `last_review`)
- `/review` z brakiem kart due wyświetla czytelny komunikat z datą następnej powtórki
