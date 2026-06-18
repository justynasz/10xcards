# UX Improvements Implementation Plan

## Overview

Wprowadzamy globalne menu nawigacyjne widoczne na każdej stronie aplikacji (poza ekranami auth), nową stronę z listą zapisanych fiszek (read-only), porządkujemy stronę główną (usuwamy boilerplate ze starter template, hero opisuje produkt, brak duplikatu przycisków auth) i przebudowujemy dashboard tak, by pokazywał realne statystyki użytkownika.

## Current State Analysis

- `src/components/Topbar.astro` istnieje, ale jest dołączony tylko w `Welcome.astro` (strona główna). Pokazuje email + link do Dashboard + Sign out (zalogowany) albo Sign in/Sign up (niezalogowany). To nie jest menu z linkami do podstron produktu.
- `src/pages/generate.astro` i `src/pages/review.astro` nie mają żadnej nawigacji — wchodzą prosto w `Layout` ze swoim widokiem React.
- `src/layouts/Layout.astro` jest gołym shellem (banner + `<slot />`), nie wie nic o nawigacji ani o użytkowniku.
- Nie istnieje strona z listą fiszek. Backend ma już gotową `listFlashcards(supabase)` (`src/lib/flashcards/index.ts:6`), używaną dotychczas tylko w testach — brak endpointu API i strony.
- `src/pages/dashboard.astro` to jedna wycentrowana karta "Welcome, {email}" + link Generate + Sign out, bez realnych danych.
- `src/pages/index.astro` → `Welcome.astro` ma boilerplate'owy hero "10x Astro Starter" + przyciski Sign In/Sign Up (widoczne niezależnie od stanu auth, bo `Topbar` już osobno pokazuje status) + 3 karty o stacku technicznym.
- `src/middleware.ts:4` chroni `/dashboard`, `/generate`, `/review` — nowa strona `/flashcards` musi zostać dodana do tej listy.
- Dwa różne języki wizualne współistnieją w kodzie: `bg-cosmic` (ciemny, szklany — `Welcome.astro`, `dashboard.astro`) i jasny shadcn (`GenerateView.tsx`, `SessionView.tsx`, `CardReviewItem.tsx`). `body` domyślnie ma `bg-background text-foreground` (jasne), `bg-cosmic` jest opt-in per-strona.
- Istniejące strony są częściowo po polsku (`SessionView.tsx`, `review.astro` title "Sesja powtarzania"), częściowo po angielsku (`Welcome.astro`, `dashboard.astro`, `Topbar.astro`). Nowe stringi w tym planie idą po polsku, zgodnie z nowszymi (S-01/S-02) ekranami produktowymi.

## Desired End State

Po wdrożeniu: każda strona poza `/auth/*` ma identyczne menu na górze (logo → `/`, linki Generuj/Fiszki/Powtórki/Dashboard, status auth po prawej z hamburger menu na mobile). Strona główna ma tylko menu + hero (tytuł + opis produktu z PRD, zero przycisków). `/flashcards` pokazuje listę zapisanych kart z empty-state i CTA do `/generate`. Dashboard pokazuje grid kart ze statystykami (łączna liczba fiszek, liczba do powtórki dziś / najbliższa data powtórki) w stylu cosmic-glass.

Weryfikacja: `npm run lint`, `npm run build`, `npm test` przechodzą; manualny przegląd każdej strony w przeglądarce na desktop i mobile (DevTools).

### Key Discoveries:

- `listFlashcards`, `listDueFlashcards`, `getNextDueDate` (`src/lib/flashcards/index.ts`) już istnieją i wystarczają do zasilenia zarówno `/flashcards`, jak i dashboardu — zero nowej logiki biznesowej, zero migracji DB.
- API route convention (`src/pages/api/flashcards/review.ts`): `export const prerender = false;`, guard na `context.locals.user`, `createClient(...)` z null-checkiem, try/catch z `console.error` + `Response.json({ error }, { status })`.
- `.astro` strony mają dostęp do `Astro.locals.user` bez przekazywania przez propsy (tak robi już `Topbar.astro`) — dashboard może wołać serwisy fiszek bezpośrednio server-side, bez nowego endpointu API.
- Brak konwencji testów dla `src/pages/api/**` (tylko `src/lib/**/__tests__` mają testy) — nowy endpoint GET nie wymaga nowego pliku testowego, zgodnie z istniejącym wzorcem (`generate.ts`, `batch-create.ts`, `review.ts` też nie mają testów).

## What We're NOT Doing

- Edycja i usuwanie fiszek ze strony `/flashcards` (to zakres S-03 `manual-card-management`, status `proposed` w roadmapie).
- Ręczne tworzenie fiszek (też S-03).
- Zmiana modelu auth, OAuth providerów, czy schematu bazy danych.
- Redesign wizualny `/generate` i `/review` (zostają w jasnym shadcn stylu — tylko NavBar nad nimi się zmienia).
- Paginacja/wyszukiwanie/filtrowanie na liście fiszek — pierwsza wersja to pełna lista bez limitu (wolumen danych MVP jest mały, zgodnie z `target_scale.data_volume: small` w PRD).
- Tłumaczenie istniejących angielskich stringów w innych częściach apki (np. komunikaty auth) — poza zakresem tego planu.

## Implementation Approach

Budujemy w kolejności, która nie zostawia martwych linków podczas manualnej weryfikacji każdej fazy:

1. Najpierw strona `/flashcards` (żeby istniała, zanim do niej wskaże nawigacja).
2. Globalny `NavBar` w `Layout.astro`, zastępujący `Topbar.astro` wszędzie.
3. Czyszczenie strony głównej (zależy od NavBar — usuwamy duplikat auth-UI z hero).
4. Redesign dashboardu (niezależny od poprzednich faz, ale logicznie kończy listę).

## Critical Implementation Details

**User experience spec:**
- Mobile menu w `NavBar` realizujemy natywnym `<details>`/`<summary>` (zero JS) — zgodnie z konwencją "Astro components for static content/layout", to czysto deklaratywne rozwiązanie bez potrzeby `client:*` directive czy Reacta.
- `NavBar` musi mieć **własne, nieprzezroczyste tło** (nie transparentny `bg-white/5` jak stary `Topbar`), bo siedzi nad dwoma różnymi tłami stron: ciemnym `bg-cosmic` (home, dashboard) i jasnym domyślnym (`generate`, `review`, `flashcards`). Stały ciemny pasek nawigacji nad jasną treścią to świadoma decyzja, nie niekonsekwencja — analogiczne do appek z ciemnym top-barem i jasnym contentem.
- Linki do stron chronionych (`/generate`, `/flashcards`, `/review`, `/dashboard`) są widoczne w `NavBar` niezależnie od stanu zalogowania. Kliknięcie przez niezalogowanego użytkownika przekierowuje na `/auth/signin` przez już istniejące `src/middleware.ts` — nie potrzeba osobnej logiki warunkowego chowania tych linków.
- Hero na stronie głównej nie ma żadnych przycisków CTA — cały auth-aware UI (Sign in/Sign up vs. email+Sign out) żyje wyłącznie w `NavBar`. To jednocześnie realizuje wymóg "nie pokazuj loguj/rejestruj gdy zalogowany", bez duplikowania logiki w dwóch miejscach.

## Phase 1: Strona z listą fiszek (`/flashcards`)

### Overview

Nowy endpoint API + nowa strona + nowy komponent React pokazujący wszystkie zapisane fiszki użytkownika (read-only), z empty-state i CTA do generowania.

### Changes Required:

#### 1. Endpoint GET listy fiszek

**File**: `src/pages/api/flashcards/list.ts` (nowy)

**Intent**: Zwraca wszystkie fiszki zalogowanego użytkownika do wyświetlenia na liście.

**Contract**: `export const prerender = false; export const GET: APIRoute`. Wzorzec identyczny jak `GET` w `src/pages/api/flashcards/review.ts:9-33` — guard `context.locals.user` → 401, `createClient` → null-check 500, `try { const cards = await listFlashcards(supabase); return Response.json({ cards }); } catch` → 500 z `console.error`. Brak walidacji wejścia (GET bez parametrów).

#### 2. Strona `/flashcards`

**File**: `src/pages/flashcards.astro` (nowy)

**Intent**: Strona-host dla widoku listy, analogicznie do `generate.astro` / `review.astro`.

**Contract**: `<Layout title="Twoje fiszki"><FlashcardsListView client:load /></Layout>`.

#### 3. Komponent widoku listy

**File**: `src/components/flashcards/FlashcardsListView.tsx` (nowy)

**Intent**: Fetchuje `/api/flashcards/list` po mount, renderuje stany loading/empty/list — ten sam wzorzec stanów co `SessionView.tsx:7,16-43` (loading skeleton → fetch w `useEffect` → `viewState`). Lista pokazuje front/back każdej karty w jasnym stylu shadcn (spójnym z `CardReviewItem.tsx`), bez przycisków akcji (read-only — różnica względem `CardReviewItem`).

**Contract**: `ViewState = "loading" | "list" | "empty"`. Empty state: nagłówek "Nie masz jeszcze żadnych fiszek" + `Button asChild` z linkiem do `/generate` (tekst: "Wygeneruj swoje pierwsze fiszki"), wzorowane na empty-state w `SessionView.tsx:81-106`.

#### 4. Ochrona nowej trasy

**File**: `src/middleware.ts`

**Intent**: `/flashcards` musi być chronione tak jak `/dashboard`, `/generate`, `/review`.

**Contract**: Dodać `"/flashcards"` do tablicy `PROTECTED_ROUTES` (`src/middleware.ts:4`).

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Build przechodzi (typecheck + Astro check): `npm run build`
- Testy jednostkowe nie regresują: `npm test`

#### Manual Verification:

- Niezalogowany użytkownik wchodzący na `/flashcards` jest przekierowany na `/auth/signin`.
- Zalogowany użytkownik bez żadnych fiszek widzi empty-state z przyciskiem do `/generate`.
- Zalogowany użytkownik z zapisanymi fiszkami widzi pełną listę (front + back każdej karty).

---

## Phase 2: Globalny NavBar

### Overview

Zastępujemy `Topbar.astro` pełnym komponentem nawigacji z linkami do wszystkich podstron, wstrzykniętym globalnie przez `Layout.astro`, widocznym na każdej stronie poza `/auth/*`.

### Changes Required:

#### 1. Nowy komponent nawigacji

**File**: `src/components/NavBar.astro` (nowy, zastępuje `src/components/Topbar.astro`)

**Intent**: Górny pasek z logo/linkiem do `/`, linkami do `/generate`, `/flashcards`, `/review`, `/dashboard`, oraz auth-aware prawą sekcją (email + Sign out form jak w `Topbar.astro:9-22`, albo Sign in/Sign up jak `Topbar.astro:24-34`). Aktywny link (porównanie `Astro.url.pathname` z `href`) ma wyróżniony styl (np. `aria-current="page"` + inny kolor tekstu).

**Contract**: Czyta `const { user } = Astro.locals;` i `const pathname = Astro.url.pathname;` (ten sam dostęp co `Topbar.astro:2`). Mobile: `<details class="sm:hidden">` z `<summary>` jako przycisk hamburgera, zawierający te same linki co desktopowe `<nav class="hidden sm:flex">` — zero JS, zgodnie z "Critical Implementation Details" wyżej. Tło nieprzezroczyste (patrz sekcja Critical Implementation Details).

#### 2. Wstrzyknięcie do Layout

**File**: `src/layouts/Layout.astro`

**Intent**: `NavBar` ma się renderować na każdej stronie korzystającej z `Layout`, poza ścieżkami auth.

**Contract**: Import `NavBar`; przed `<slot />` dodać `{!Astro.url.pathname.startsWith("/auth") && <NavBar />}`.

#### 3. Usunięcie starego Topbar z miejsca użycia

**File**: `src/components/Welcome.astro`

**Intent**: Strona główna nie renderuje już własnego `Topbar` — dostaje `NavBar` globalnie z `Layout`.

**Contract**: Usunąć `import Topbar from "@/components/Topbar.astro";` i `<Topbar />` (linia 2 i 28). Usunąć plik `src/components/Topbar.astro`.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- NavBar widoczny i identyczny na: `/`, `/dashboard`, `/generate`, `/flashcards`, `/review`.
- NavBar **niewidoczny** na: `/auth/signin`, `/auth/signup`, `/auth/confirm-email`.
- Zalogowany: widać email + Sign out, nie widać Sign in/Sign up.
- Niezalogowany: widać Sign in/Sign up, nie widać emaila/Sign out.
- Na wąskim viewport (DevTools mobile): linki chowają się pod hamburger, rozwijają się po kliknięciu.
- Aktywna strona ma wizualnie wyróżniony link w menu.

**Implementation Note**: Po przejściu tej fazy zatrzymaj się i poczekaj na manualne potwierdzenie przed przejściem do Fazy 3.

---

## Phase 3: Czyszczenie strony głównej

### Overview

Strona główna pokazuje tylko `NavBar` (z Fazy 2) + hero z prawdziwym opisem produktu — bez starych przycisków Sign In/Sign Up i bez kart o stacku technicznym.

### Changes Required:

#### 1. Hero z opisem produktu

**File**: `src/components/Welcome.astro`

**Intent**: Zastąpić boilerplate'owy nagłówek i opis ("10x Astro Starter" / "A production-ready starter...") realnym opisem 10xCards, oparty na PRD (`context/foundation/prd.md` — Vision & Problem Statement, US-01).

**Contract**: Nowy `h1`: "10xCards". Nowy opis (zastępuje `p` w liniach 37-39):
"Wklej tekst, który chcesz opanować — AI wygeneruje karty pytanie/odpowiedź, Ty zaakceptujesz, edytujesz lub odrzucisz każdą, a wbudowany system powtórek zaplanuje naukę za Ciebie." Zachować istniejące klasy Tailwind dla `h1`/`p` (gradient, rozmiary) — zmienia się tylko treść.

#### 2. Usunięcie przycisków CTA z hero

**File**: `src/components/Welcome.astro`

**Intent**: Auth-aware akcje żyją teraz wyłącznie w `NavBar` (Faza 2) — hero nie potrzebuje własnych przycisków Sign In/Sign Up.

**Contract**: Usunąć cały `<div class="flex flex-col gap-4 sm:flex-row">...</div>` z linkami `/auth/signin` i `/auth/signup` (linie 40-53).

#### 3. Usunięcie kart o stacku technicznym

**File**: `src/components/Welcome.astro`

**Intent**: Karty "Authentication Ready" / "Modern Stack" / "Developer Experience" opisują starter template, nie produkt — do usunięcia, zgodnie z "zostawić menu i hero".

**Contract**: Usunąć całą sekcję `<!-- Feature cards -->` (linie 56-124).

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Strona główna pokazuje: NavBar + hero (tytuł + opis 10xCards) — nic więcej.
- Brak przycisków Sign In/Sign Up w treści strony (poza tymi w NavBar dla niezalogowanych).
- Zalogowany użytkownik na `/` nie widzi żadnego przycisku logowania/rejestracji.

---

## Phase 4: Redesign dashboardu

### Overview

Dashboard pokazuje grid kart ze statystykami użytkownika (liczba fiszek, due today / najbliższa powtórka) w stylu cosmic-glass, zamiast jednej statycznej karty powitalnej.

### Changes Required:

#### 1. Server-side dane statystyk

**File**: `src/pages/dashboard.astro`

**Intent**: Dashboard, jako strona `.astro`, woła serwisy fiszek bezpośrednio server-side (bez nowego endpointu API) — analogicznie do tego, jak inne strony już budują `supabase` client.

**Contract**: Zbudować `supabase` przez `createClient(Astro.request.headers, Astro.cookies)`; jeśli klient istnieje, pobrać `totalCount = (await listFlashcards(supabase)).length`, `dueCount = (await listDueFlashcards(supabase)).length`, i `nextDue = dueCount === 0 ? await getNextDueDate(supabase) : null`. Te trzy funkcje już istnieją w `src/lib/flashcards/index.ts` (linie 6, 39, 50) — import bez zmian w serwisie.

#### 2. Layout statystyk i CTA

**File**: `src/pages/dashboard.astro`

**Intent**: Zamienić jedną wycentrowaną kartę na nagłówek + grid kart statystyk + CTA do głównych akcji, w stylu cosmic-glass już użytym w `Welcome.astro` (`rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl`).

**Contract**: Grid 2-3 kolumn (responsywny, `grid-cols-1 sm:grid-cols-3`) z kartami: "Łącznie fiszek" (`totalCount`), "Do powtórki dziś" (`dueCount`, lub jeśli 0 — najbliższa data z `nextDue`), oraz kartą-CTA linkującą do `/generate` ("Wygeneruj nowe fiszki"). Zachować formularz Sign out (linie 24-31) — przenieść go pod statystyki lub do NavBar-owego Sign out (NavBar już go ma od Fazy 2, więc lokalny przycisk Sign out na dashboardzie staje się opcjonalny/redundantny — usunąć go, NavBar wystarcza).

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Dashboard pokazuje poprawną liczbę fiszek i due-today dla konta testowego z zapisanymi kartami.
- Dla konta bez fiszek dashboard pokazuje 0 / odpowiedni komunikat, bez błędów w konsoli.
- Karta CTA "Wygeneruj nowe fiszki" prowadzi do `/generate`.
- Wygląd spójny ze stylem cosmic-glash używanym na stronie głównej.

---

## Testing Strategy

### Unit Tests:

- Brak nowej logiki biznesowej do testowania jednostkowo (nowy endpoint i strony to cienkie wrappery na już przetestowane funkcje `src/lib/flashcards`). Istniejące testy (`src/lib/flashcards/__tests__/flashcards.test.ts`) muszą dalej przechodzić bez zmian.

### Integration Tests:

- Brak — projekt nie ma testów integracyjnych dla stron/API; weryfikacja przez manualne testy per faza (patrz wyżej).

### Manual Testing Steps:

1. Zalogować się i przejść przez wszystkie strony (`/`, `/dashboard`, `/flashcards`, `/generate`, `/review`) sprawdzając obecność i konsekwencję NavBar.
2. Wylogować się i sprawdzić, że strony chronione przekierowują na `/auth/signin`, a strony auth nie mają NavBar.
3. Zmienić rozmiar okna / użyć DevTools mobile, sprawdzić hamburger menu na każdej stronie.
4. Wygenerować kilka fiszek przez `/generate`, sprawdzić że pojawiają się na `/flashcards`.
5. Sprawdzić dashboard z kontem mającym fiszki due i bez żadnych fiszek (empty/zero state).

## Performance Considerations

Brak nowych obciążeń wydajnościowych — `listFlashcards` już istnieje i jest używane w testach z małym wolumenem danych (`target_scale.data_volume: small` w PRD). Brak paginacji w v1 jest świadomą decyzją (patrz "What We're NOT Doing").

## Migration Notes

Brak zmian w schemacie bazy danych. Brak migracji danych — wszystkie zmiany są czysto frontend/routing.

## References

- PRD: `context/foundation/prd.md` (Vision & Problem Statement, US-01)
- Roadmap: `context/foundation/roadmap.md` (S-03 manual-card-management — zakres NIE objęty tym planem)
- Wzorzec API route: `src/pages/api/flashcards/review.ts:9-33`
- Wzorzec widoku ze stanami loading/empty: `src/components/review/SessionView.tsx:7,16-43,81-106`
- Istniejący serwis fiszek: `src/lib/flashcards/index.ts:6,39,50`
- Istniejący auth-aware status bar (do zastąpienia): `src/components/Topbar.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Strona z listą fiszek (`/flashcards`)

#### Automated

- [ ] 1.1 Lint przechodzi: `npm run lint`
- [ ] 1.2 Build przechodzi (typecheck + Astro check): `npm run build`
- [x] 1.3 Testy jednostkowe nie regresują: `npm test`

#### Manual

- [ ] 1.4 Niezalogowany użytkownik wchodzący na `/flashcards` jest przekierowany na `/auth/signin`
- [ ] 1.5 Zalogowany użytkownik bez fiszek widzi empty-state z przyciskiem do `/generate`
- [ ] 1.6 Zalogowany użytkownik z fiszkami widzi pełną listę


### Phase 2: Globalny NavBar

#### Automated

- [ ] 2.1 Lint przechodzi: `npm run lint`
- [ ] 2.2 Build przechodzi: `npm run build`

#### Manual

- [ ] 2.3 NavBar widoczny i identyczny na `/`, `/dashboard`, `/generate`, `/flashcards`, `/review`
- [ ] 2.4 NavBar niewidoczny na stronach auth
- [ ] 2.5 Zalogowany: email + Sign out, brak Sign in/Sign up
- [ ] 2.6 Niezalogowany: Sign in/Sign up, brak emaila/Sign out
- [ ] 2.7 Hamburger menu działa na mobile viewport
- [ ] 2.8 Aktywna strona wyróżniona w menu

### Phase 3: Czyszczenie strony głównej

#### Automated

- [ ] 3.1 Lint przechodzi: `npm run lint`
- [ ] 3.2 Build przechodzi: `npm run build`

#### Manual

- [ ] 3.3 Strona główna pokazuje tylko NavBar + hero
- [ ] 3.4 Brak przycisków Sign In/Sign Up w treści strony
- [ ] 3.5 Zalogowany użytkownik na `/` nie widzi przycisków logowania/rejestracji

### Phase 4: Redesign dashboardu

#### Automated

- [ ] 4.1 Lint przechodzi: `npm run lint`
- [ ] 4.2 Build przechodzi: `npm run build`

#### Manual

- [ ] 4.3 Poprawne liczby fiszek i due-today dla konta z kartami
- [ ] 4.4 Poprawny zero-state dla konta bez fiszek, bez błędów w konsoli
- [ ] 4.5 CTA "Wygeneruj nowe fiszki" prowadzi do `/generate`
- [ ] 4.6 Wygląd spójny ze stylem cosmic-glass
