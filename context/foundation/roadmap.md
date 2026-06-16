---
project: "10xCards"
version: 1
status: draft
created: 2026-05-27
updated: 2026-05-27
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: 10xCards

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

10xCards rozwiązuje problem tarcia w tworzeniu fiszek edukacyjnych: uczący się — specjaliści czytający dokumentację techniczną, artykuły naukowe lub literaturę branżową — pomijają tworzenie kart, bo jest za czasochłonne, mimo że wiedzą jak to robić. Istniejące narzędzia dzielą workflow: generacja AI w jednym miejscu, powtarzanie w Anki — przełączanie kontekstu zabija nawyk.

10xCards integruje generate + review w jednym miejscu. Użytkownik wkleja tekst, akceptuje lub odrzuca propozycje kart AI, a następnie uczy się za pomocą wbudowanego harmonogramu spaced repetition. Kluczowe metryki walidacyjne MVP: 75% kart AI zaakceptowanych bez edycji oraz 75% wszystkich kart tworzonych przez AI, a nie ręcznie.

## North star

**S-01 + S-02: Pełna pętla uczenia** — wklej tekst, przejrzyj karty AI, zapisz zaakceptowane, a następnie odbądź sesję powtarzania z automatycznym harmonogramem SM-2.

> Gwiazda przewodnia to najmniejszy end-to-end flow, który udowadnia, że produkt działa — umieszczony jak najwcześniej, bo wszystko inne ma sens tylko wtedy, gdy ta pętla jest zamknięta. SM-2 (SuperMemo 2) to otwarcie udokumentowany algorytm spaced repetition — PRD wyklucza budowanie własnego.

S-01 to pierwsze wrota: udowadnia, że AI generuje użyteczne karty (riskiest assumption). S-02 zamyka pętlę: udowadnia, że produkt to narzędzie nauki, a nie tylko przeglądarka fiszek.

## At a glance

| ID   | Change ID               | Outcome (user can …)                                                                                     | Prerequisites | PRD refs                               | Status   |
|------|-------------------------|----------------------------------------------------------------------------------------------------------|---------------|----------------------------------------|----------|
| F-01 | flashcard-data-schema   | (foundation) Tabela `flashcards` w Supabase z RLS; izolacja danych per user                             | —             | NFR (data isolation)                   | ready    |
| S-01 | ai-generate-and-review  | wkleić tekst, otrzymać karty AI, zaakceptować/edytować/odrzucić każdą, zapisać zaakceptowane do decku   | F-01          | FR-001, FR-003, FR-004, US-01          | blocked  |
| S-02 | sr-review-session       | rozpocząć sesję powtarzania SR i ocenić recall każdej karty; app planuje kolejne powtórki automatycznie | S-01          | FR-009, FR-010                         | proposed |
| S-03 | manual-card-management  | tworzyć kartę ręcznie, przeglądać, edytować i usuwać karty ze swojego decku                             | F-01          | FR-002, FR-005, FR-006, FR-007, FR-008 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme               | Chain                     | Note                                                                                      |
|--------|---------------------|---------------------------|-------------------------------------------------------------------------------------------|
| A      | Główna pętla        | `F-01` → `S-01` → `S-02` | Ścieżka gwiazdy przewodniej. Cel `speed` → priorytet absolutny; rozwiąż OQ-1 i OQ-2 zanim zaczniesz S-01. |
| B      | Zarządzanie kartami | `F-01` → `S-03`           | Odgałęzienie od F-01 równoległe z S-01. Safety valve dla flow AI-only; nie blokuje Streamu A. |

## Baseline

What's already in place in the codebase as of 2026-05-27 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands (`astro.config.mjs`, `src/components/`)
- **Backend / API:** present — Astro SSR API routes (`src/pages/api/`); Zod dla walidacji wejścia
- **Data:** present — Supabase client (`src/lib/supabase.ts`); brak schematu tabeli flashcards
- **Auth:** partial — Supabase Auth (`@supabase/ssr`) wired; signin/signup/signout API routes obecne; middleware `src/middleware.ts:6-24` chroni `/dashboard`; auth scaffold kompletny dla userów, brak tabel powiązanych z fiszkami
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`); GitHub Actions CI (`.github/workflows/ci.yml`); `@astrojs/cloudflare` adapter skonfigurowany
- **Observability:** absent — brak logowania, error-trackingu ani metryk; zdeferred per cel `speed`

## Foundations

### F-01: Schemat flashcard + RLS

- **Outcome:** (foundation) Tabela `flashcards` w Supabase z kolumnami `question`, `answer`, `user_id` i polami SM-2 (`easiness_factor`, `interval_days`, `repetitions`, `due_date`); RLS policies zapewniają, że każdy użytkownik czyta i modyfikuje wyłącznie swoje karty.
- **Change ID:** flashcard-data-schema
- **PRD refs:** NFR (data isolation — "One user's flashcard data is never visible to another user")
- **Unlocks:** S-01 (AI generation potrzebuje miejsca zapisu zaakceptowanych kart), S-02 (SR session czyta i aktualizuje pola SM-2), S-03 (CRUD ręczny operuje na tej tabeli)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwsza do zrobienia — każdy inny slice jest od tego zablokowany. Błąd w schemacie RLS = naruszenie izolacji danych (guardrail PRD: "Losing a deck would destroy trust immediately"). Migracja Supabase musi być backward-compatible od pierwszego commitu.
- **Status:** ready

## Slices

### S-01: Generacja AI + przegląd kart

- **Outcome:** user can wkleić dowolny blok tekstu, wywołać generację AI przez OpenRouter, przejrzeć każdą propozycję karty (akceptacja / edycja / odrzucenie) i zapisać zaakceptowane karty do swojego decku.
- **Change ID:** ai-generate-and-review
- **PRD refs:** FR-001, FR-003, FR-004, US-01
- **Prerequisites:** F-01
- **Parallel with:** S-03 (oba zależą tylko od F-01 i nie blokują się wzajemnie — jednak S-01 jest zablokowane przez OQ-1 i OQ-2)
- **Blockers:** —
- **Unknowns:**
  - Jaki jest akceptowalny czas oczekiwania na generację AI, zanim użytkownik przerwie sesję? (latency ceiling dla NFR "generation feedback") — Owner: user/team. Block: yes.
  - Jak zostanie zwalidowana jakość generacji AI przed pierwszym wdrożeniem? (protokół: próbki tekstów, pomiar acceptance rate, iteracja promptu) — Owner: user. Block: yes.
- **Risk:** Najwyższe ryzyko techniczne w projekcie: streaming OpenRouter przez Cloudflare workerd jest nieudokumentowany dla Astro 6 SSR (`infrastructure.md` risk register). Zbuduj minimalny streaming proof-of-concept przed pełną implementacją. Niska jakość promptu to najważniejszy failure mode — Socrates na FR-003: "prompt engineering must be validated before launch".
- **Status:** blocked

### S-02: Sesja powtarzania SR

- **Outcome:** user can rozpocząć sesję powtarzania spaced repetition; dla każdej karty ocenić recall (skala 0–5); app wylicza następną datę powtórki algorytmem SM-2 i zapisuje do Supabase.
- **Change ID:** sr-review-session
- **PRD refs:** FR-009, FR-010
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** SM-2 to algorytm off-the-shelf (PRD §Non-Goals: bez custom scheduling); implementacja prosta, ale obliczenia SM-2 + zapis do Supabase mogą trafić w limit CPU time Cloudflare workerd (`infrastructure.md`). Rozważ przeniesienie obliczeń dat do Supabase RPC (działa w DB, poza limitem Worker).
- **Status:** proposed

### S-03: Ręczne zarządzanie kartami

- **Outcome:** user can tworzyć kartę ręcznie (pytanie + odpowiedź), przeglądać listę wszystkich swoich kart, edytować treść dowolnej karty i usuwać karty z decku.
- **Change ID:** manual-card-management
- **PRD refs:** FR-002, FR-005, FR-006, FR-007, FR-008
- **Prerequisites:** F-01
- **Parallel with:** S-01 (oba zależą tylko od F-01; można zrównoleglić po rozwiązaniu OQ-1/OQ-2 blokujących S-01)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Ręczne tworzenie kart to safety valve dla flow AI-only (Socrates na FR-005: "users won't adopt AI-only without the ability to correct or supplement it"). Przy celu `speed` i blokerze `time` — priorytyzuj za S-01, ale nie porzucaj: brak CRUD ręcznego blokuje zaufanie do produktu.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID              | Suggested issue title                         | Ready for `/10x-plan` | Notes                                                              |
|------------|------------------------|-----------------------------------------------|-----------------------|--------------------------------------------------------------------|
| F-01       | flashcard-data-schema  | Add flashcard table + RLS to Supabase         | yes                   | Uruchom `/10x-plan flashcard-data-schema`                          |
| S-01       | ai-generate-and-review | AI card generation + review flow              | no                    | Zablokowane przez OQ-1 i OQ-2; rozwiąż latency ceiling i protokół walidacji jakości przed planem |
| S-02       | sr-review-session      | Spaced repetition review session (SM-2)       | no                    | Zależy od S-01                                                     |
| S-03       | manual-card-management | Manual flashcard CRUD                         | no                    | Zależy od F-01 (nie od S-01); dostępne do planowania po F-01      |

## Open Roadmap Questions

1. **Jaki jest akceptowalny czas oczekiwania na generację AI?** NFR wymaga, żeby generacja nie skłoniła użytkownika do porzucenia sesji — bez konkretnej liczby ms nie da się zaprojektować UX (loading state, timeout, streaming vs waiting całości). Owner: user/team. Block: S-01.
2. **Jak zostanie zwalidowana jakość generacji AI przed pierwszym wdrożeniem?** Socrates na FR-003 flaguje niską jakość jako primary failure mode całego produktu; metryka 75% acceptance rate z PRD §Success Criteria wymaga wcześniejszego pomiaru na próbkach. Uzgodnij protokół (próbne teksty, kto ocenia, ile iteracji promptu) przed `/10x-plan ai-generate-and-review`. Owner: user. Block: S-01.
3. **Które dostawcy OAuth będą wspierani?** PRD wymienia OAuth jako opcję auth obok email+password, ale nie podaje nazw providerów. Downstream implementation decision. Owner: team. Block: no.

## Parked

- **Custom SR algorithm** — Why parked: PRD §Non-Goals. SM-2 off-the-shelf wystarczy dla MVP; wartość produktu to zintegrowany flow, nie algorytm harmonogramowania.
- **Multi-format import (PDF, DOCX, obrazy, linki)** — Why parked: PRD §Non-Goals. Parsowanie formatów to złożoność niezasadna przed walidacją core flow; text paste only dla v1.
- **Shared decks i social features** — Why parked: PRD §Non-Goals. Karty prywatne w MVP; deck sharing wymaga trust model poza zakresem v1.
- **Aplikacja mobilna** — Why parked: PRD §Non-Goals. Web only; native iOS/Android po walidacji produktu webowego.
- **Integracje z zewnętrznymi platformami (Anki sync, LMS)** — Why parked: PRD §Non-Goals. Poza zakresem MVP.
- **Observability (logging, error tracking, metryki)** — Why parked: cel `speed`; baseline absent; dodaj po launch gdy są realne dane do debugowania i pierwsze incydenty produkcyjne.

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived.)
