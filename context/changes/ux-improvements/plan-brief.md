# UX Improvements — Plan Brief

> Full plan: `context/changes/ux-improvements/plan.md`

## What & Why

Aplikacja ma dziś trzy produktowe strony (`/generate`, `/review`, dashboard) bez wspólnej nawigacji — każda strona jest "wyspą". Strona główna nadal pokazuje boilerplate ze starter template ("10x Astro Starter") zamiast opisu 10xCards, a dashboard nie pokazuje żadnych realnych danych. Ten plan dodaje globalne menu, nową stronę z listą fiszek i czyści stronę główną + dashboard, żeby aplikacja sprawiała wrażenie jednej spójnej całości, nie zbioru osobnych demo-stron.

## Starting Point

- `Topbar.astro` istnieje, ale tylko na stronie głównej i tylko jako status auth (nie menu).
- `/generate`, `/review` nie mają żadnej nawigacji.
- Brak strony z listą fiszek — ale backend (`listFlashcards()`) już istnieje, nieużywany poza testami.
- Dashboard to jedna statyczna karta powitalna.
- Strona główna ma boilerplate hero + przyciski auth (niezależne od stanu zalogowania) + karty o stacku technicznym.

## Desired End State

Każda strona (poza auth) ma to samo menu na górze z linkami do Generuj/Fiszki/Powtórki/Dashboard i auth-aware statusem po prawej (z hamburger menu na mobile). Strona główna to tylko menu + hero opisujący produkt. Nowa strona `/flashcards` pokazuje wszystkie zapisane karty. Dashboard pokazuje realne statystyki (liczba fiszek, due today) w gridzie kart.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Zakres `/flashcards` | Tylko podgląd (read-only) | Mały, domknięty zakres — edycja/usuwanie to S-03 w roadmapie | Plan |
| Architektura nawigacji | Jeden `NavBar` w `Layout.astro`, zastępuje `Topbar` | Jedno miejsce do utrzymania, automatycznie na każdej stronie | Plan |
| Nawigacja na stronach auth | Brak | Nie rozprasza w trakcie logowania/rejestracji | Plan |
| Mobile nav | Hamburger (natywny `<details>/<summary>`, zero JS) | Standardowy wzorzec, zgodny z "Astro-first" konwencją projektu | Plan |
| Hero copy | Nowy opis oparty na PRD (US-01), bez przycisków CTA | Auth-aware UI żyje wyłącznie w NavBar — brak duplikacji logiki | Plan |
| Dashboard redesign | Grid kart statystyk (liczba fiszek, due today) | Wykorzystuje już istniejące funkcje serwisowe, zero nowego API | Plan |
| URL listy fiszek | `/flashcards` | Konsekwentne z nazwą modułu/tabeli `flashcards` w kodzie | Plan |
| Empty state listy | Komunikat + CTA do `/generate` | Prowadzi nowego użytkownika do akcji, nie pustą stronę | Plan |

## Scope

**In scope:**
- Globalny `NavBar` (Layout-level), zastępujący `Topbar.astro`
- Nowa strona `/flashcards` (read-only) + `GET /api/flashcards/list`
- Czyszczenie strony głównej (hero copy, usunięcie boilerplate)
- Redesign dashboardu (statystyki server-side, bez nowego API)

**Out of scope:**
- Edycja/usuwanie/ręczne tworzenie fiszek (S-03, status `proposed`)
- Redesign wizualny `/generate` i `/review`
- Paginacja/wyszukiwanie na liście fiszek
- Zmiany w auth, OAuth, schemacie DB

## Architecture / Approach

`NavBar.astro` (nowy, Astro-only, zero JS poza natywnym `<details>`) wstrzyknięty w `Layout.astro`, warunkowo skryty na `/auth/*`. `/flashcards` to cienki wrapper: nowy `GET` route wołający już istniejący `listFlashcards()`, nowy React komponent (`client:load`) ze stanami loading/empty/list, wzorowany 1:1 na `SessionView.tsx`. Dashboard pozostaje czysto server-rendered (`.astro`), woła serwisy fiszek bezpośrednio — bez nowego endpointu.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Strona `/flashcards` | Nowy endpoint + strona + komponent listy (read-only) | Brak — wzorzec 1:1 z istniejącym `SessionView` |
| 2. Globalny NavBar | Jeden komponent nawigacji na wszystkich stronach poza auth | Wizualne starcie ciemnego baru z jasnym tłem `/generate`/`/review` — zaadresowane nieprzezroczystym tłem navbara |
| 3. Czyszczenie strony głównej | Hero z prawdziwym opisem, bez boilerplate i duplikatu auth-UI | Brak |
| 4. Redesign dashboardu | Grid statystyk zamiast statycznej karty | Brak — dane już dostępne w serwisie |

**Prerequisites:** S-01 i S-02 (done) — fiszki i sesje powtórek już istnieją w bazie.
**Estimated effort:** ~1 sesja implementacyjna, 4 fazy.

## Open Risks & Assumptions

- Nowe stringi UI są po polsku, zgodnie z nowszymi ekranami (`SessionView`, `review.astro`) — istniejące starsze ekrany (`Welcome`, `dashboard`, auth) są po angielsku; ta niekonsekwencja językowa NIE jest naprawiana w tym planie (poza tym, co i tak przepisujemy).
- Brak limitu/paginacji na `/flashcards` zakłada mały wolumen danych (zgodnie z PRD `target_scale.data_volume: small`) — jeśli się to zmieni, lista będzie wymagać paginacji w przyszłym planie.

## Success Criteria (Summary)

- Użytkownik widzi to samo menu na każdej stronie produktowej i może z niego dotrzeć do Generuj/Fiszki/Powtórki/Dashboard.
- Strona główna nie pokazuje przycisków logowania/rejestracji zalogowanemu użytkownikowi, ani boilerplate'u ze starter template.
- Użytkownik może zobaczyć wszystkie swoje zapisane fiszki na `/flashcards`.
- Dashboard pokazuje realne dane o postępie użytkownika, nie statyczny tekst powitalny.
