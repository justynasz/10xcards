# AI Card Generation and Review Flow — Implementation Plan

## Overview

Implementacja flow S-01: użytkownik wkleja tekst na stronie `/generate` → backend wywołuje OpenRouter (Gemini Flash 1.5) → API zwraca 3–10 kart w JSON → użytkownik akceptuje/edytuje/odrzuca każdą kartę inline → zaakceptowane karty trafiają do tabeli `flashcards` przez batch-create endpoint.

## Current State Analysis

- **Dashboard** (`src/pages/dashboard.astro`): pusty placeholder; brak linku do generacji
- **Auth**: middleware (`src/middleware.ts`) chroni `/dashboard`; pattern PROTECTED_ROUTES gotowy do rozszerzenia
- **Flashcard service** (`src/lib/flashcards/`): `createFlashcard(supabase, dto)` istnieje; brak `batchCreateFlashcards`
- **Env schema** (`astro.config.mjs`): tylko `SUPABASE_URL` / `SUPABASE_KEY`; `OPENROUTER_API_KEY` nie dodany
- **Config banner** (`src/lib/config-status.ts`): lista konfiguracji wymaganych — OPENROUTER_API_KEY musi być tam zarejestrowany
- **OpenRouter**: brak modułu serwisowego; brak zależności npm (użyjemy natywnego `fetch`)
- **Streaming przez workerd**: nieudokumentowane (infrastructure.md:83) — decyzja: batch JSON (bez SSE)

## Desired End State

Po zakończeniu planu:
- Zalogowany użytkownik wchodzi na `/generate`, wkleja tekst (50–5000 znaków), klika "Generate" — po max 10s widzi listę 3–10 kart
- Każdą kartę może zaakceptować, edytować inline lub odrzucić
- Przycisk "Save X cards" zapisuje zaakceptowane do tabeli `flashcards` (RLS gwarantuje izolację)
- Niezalogowany użytkownik trafiający na `/generate` jest przekierowywany na `/auth/signin`
- Brak `OPENROUTER_API_KEY` → baner informacyjny w layoucie

### Weryfikacja końcowa
```bash
npm run lint   # brak błędów TypeScript
npm test       # wszystkie testy przechodzą (w tym nowe dla openrouter + batch-create)
npm run build  # build bez błędów
```

### Key Discoveries

- `src/lib/supabase.ts:createClient()` zwraca `null` gdy brak env vars — każdy API route musi guardować przed null
- `src/middleware.ts:PROTECTED_ROUTES` to tablica stringów; wystarczy dopisać `"/generate"`
- `src/lib/flashcards/index.ts:createFlashcard` wstawia jedną kartę; potrzebujemy nowej `batchCreateFlashcards` używającej Supabase `.insert([...])` zamiast N wywołań
- OpenRouter używa OpenAI-compatible API (`/api/v1/chat/completions`); odpowiedź w `choices[0].message.content`
- Timeout 10s musi być zrealizowany przez `AbortController` + `signal` przekazany do `fetch` — inaczej Worker wisi do limitu platformy
- AI output musi być walidowany Zodem: model może zwrócić zniekształcony JSON
- `OPENROUTER_API_KEY` importujemy z `astro:env/server` (nie `import.meta.env` — konwencja projektu)

## What We're NOT Doing

- **Streaming SSE** — nieudokumentowane przez workerd; batch JSON wystarczy dla 10s limitu (OQ-1)
- **Algorytm SM-2** — należy do S-02 (sr-review-session)
- **Lista kart użytkownika** — należy do S-03 (manual-card-management)
- **Walidacja jakości promptu** — to OQ-2: ręczna ocena 5 próbek po deploymencie
- **OAuth** — auth scaffold istniejący wystarczy
- **Rate limiting** — poza zakresem MVP

## Implementation Approach

1. Config first: env var + banner + route protection — minimalny koszt, maksymalny safety
2. Serwis OpenRouter jako izolowany moduł `src/lib/openrouter/` z własnym `index.ts`, `types.ts`, `__tests__/` (konwencja projektu)
3. API routes: najpierw `/api/flashcards/generate` (OpenRouter call), potem `/api/flashcards/batch-create` (Supabase insert) — rozdzielone żeby UI mogło retry generacji bez ponownego save
4. UI jako React island na nowej stronie Astro `/generate`

## Critical Implementation Details

**AbortController + timeout**: fetch do OpenRouter musi dostać `signal` z `AbortController` ustawionego na 10 000ms. Bez tego Worker czeka do limitu platformy (30s CPU time paid / dłużej wall-clock), a użytkownik widzi spinner bez końca.

**Fetch zamiast SDK**: OpenRouter wywołujemy przez natywny `fetch` (nie openai npm package) — eliminuje ryzyko transitive deps naruszających workerd sandbox (infrastructure.md:57).

**Zod walidacja AI output**: odpowiedź z `choices[0].message.content` to string, który może nie być poprawnym JSON. Parsowanie musi być owinięte w try/catch + Zod safeParse; błąd parsowania rzuca opisowy wyjątek do API route.

---

## Phase 1: Config & Infrastructure

### Overview

Dodanie `OPENROUTER_API_KEY` do env schema, rejestracja w bannerze konfiguracji, rozszerzenie ochrony tras o `/generate`.

### Changes Required

#### 1. Env schema

**File**: `astro.config.mjs`

**Intent**: Zarejestrować `OPENROUTER_API_KEY` jako opcjonalny sekret serwera, zgodnie z istniejącym wzorcem `SUPABASE_URL` / `SUPABASE_KEY`. Bez rejestracji import z `astro:env/server` nie zadziała.

**Contract**: W obiekcie `env.schema` dodać:
```
OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true })
```

#### 2. Config status banner

**File**: `src/lib/config-status.ts`

**Intent**: Zarejestrować OpenRouter w liście konfiguracji wymaganych, żeby layout wyświetlił baner gdy `OPENROUTER_API_KEY` jest nieobecny. Pattern identyczny z istniejącym wpisem Supabase.

**Contract**: Dodać nowy obiekt `ConfigStatus` do tablicy `configStatuses`:
- `name: "OpenRouter"`
- `configured: Boolean(OPENROUTER_API_KEY)` — wymaga importu `OPENROUTER_API_KEY` z `"astro:env/server"`
- `message`: informacja że generacja AI jest wyłączona

#### 3. Route protection

**File**: `src/middleware.ts`

**Intent**: Dodać `/generate` do `PROTECTED_ROUTES` żeby middleware przekierowywał niezalogowanych użytkowników na stronę logowania.

**Contract**: Dopisać `"/generate"` do tablicy `PROTECTED_ROUTES`.

#### 4. Env var w local dev

**File**: `.dev.vars` (plik lokalny, nie w repo)

**Intent**: Udostępnić klucz OpenRouter dla lokalnego `wrangler dev`. Krok manualny — nie można zautomatyzować.

**Contract**: Dodać wiersz `OPENROUTER_API_KEY=<twój_klucz>` do `.dev.vars`.

### Success Criteria

#### Automated Verification

- `npm run lint` przechodzi bez błędów TypeScript
- `npm test` przechodzi (istniejące testy niezmienione)

#### Manual Verification

- Brak `OPENROUTER_API_KEY` w `.dev.vars` → layout wyświetla baner "OpenRouter nie jest skonfigurowany"
- Wejście na `http://localhost:4321/generate` bez zalogowania → redirect na `/auth/signin`

**Implementation Note**: Po przejściu automatycznej weryfikacji, zatrzymaj się na manualnym potwierdzeniu.

---

## Phase 2: OpenRouter Service Layer

### Overview

Nowy moduł `src/lib/openrouter/` z typami, funkcją serwisową i testami jednostkowymi. Moduł jest izolowaną warstwą odpowiedzialną za komunikację z OpenRouter API.

### Changes Required

#### 1. Typy

**File**: `src/lib/openrouter/types.ts`

**Intent**: Zdefiniować typy dla wejścia i wyjścia serwisu OpenRouter, niezależne od typów flashcard (warstwa serwisu nie powinna wiedzieć nic o Supabase).

**Contract**: Wyeksportować:
- `GeneratedCard` — `{ front: string; back: string }`
- `GenerateFlashcardsInput` — `{ text: string; apiKey: string }`

#### 2. Funkcja serwisowa

**File**: `src/lib/openrouter/index.ts`

**Intent**: Wyeksportować `generateFlashcards(input: GenerateFlashcardsInput): Promise<GeneratedCard[]>` — jedyna publiczna funkcja modułu. Odpowiada za wywołanie OpenRouter, walidację odpowiedzi i zwrot tablicy kart.

**Contract**:
- Wywołuje `POST https://openrouter.ai/api/v1/chat/completions` przez natywny `fetch` z `signal` z `AbortController(10_000ms)`
- Model: `"google/gemini-flash-1.5"`
- Prompt systemowy nakazuje zwrócić **wyłącznie** JSON array bez markdown, 3–10 obiektów `{ front, back }`
- Parsuje `choices[0].message.content` jako JSON; waliduje Zodem (`z.array(z.object({ front: z.string(), back: z.string() }))`); rzuca opisowy błąd na niezgodność schematu
- Przy AbortError rzuca Error z komunikatem "Generation timed out after 10 seconds"

Sygnatura:
```ts
export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GeneratedCard[]>
```

#### 3. Testy jednostkowe

**File**: `src/lib/openrouter/__tests__/openrouter.test.ts`

**Intent**: Pokryć kluczowe ścieżki: sukces (poprawny JSON), błąd parsowania AI output, timeout.

**Contract**:
- `vi.stubGlobal("fetch", ...)` do mockowania natywnego fetch
- `describe("generateFlashcards")`:
  - "returns parsed cards on valid OpenRouter response" — mock zwraca poprawny JSON, wynik pasuje do GeneratedCard[]
  - "throws on malformed AI JSON output" — mock zwraca niepoprawny JSON w content
  - "throws on fetch timeout (AbortError)" — mock rzuca AbortError
- Import `GenerateFlashcardsInput` z `"../types"`

### Success Criteria

#### Automated Verification

- `npm run lint` przechodzi bez błędów TypeScript
- `npm test` — ≥ 3 nowe testy w `openrouter/__tests__/` przechodzą

#### Manual Verification

- `src/lib/openrouter/index.ts` eksportuje `generateFlashcards`
- `src/lib/openrouter/types.ts` eksportuje `GeneratedCard` i `GenerateFlashcardsInput`

**Implementation Note**: Po przejściu automatycznej weryfikacji, zatrzymaj się na manualnym potwierdzeniu.

---

## Phase 3: API Routes & Batch Create

### Overview

Dwa nowe API routes (generate + batch-create) oraz rozszerzenie flashcard service o `batchCreateFlashcards`. Routes są rozdzielone żeby UI mogło retry samej generacji bez ponownego save.

### Changes Required

#### 1. Batch create w service layer

**File**: `src/lib/flashcards/index.ts`

**Intent**: Dodać `batchCreateFlashcards(supabase, dtos)` — wstawia wiele kart jednym zapytaniem Supabase zamiast N osobnych insertów. S-01 potrzebuje wsadowego zapisu zaakceptowanych kart.

**Contract**:
```ts
export async function batchCreateFlashcards(
  supabase: SupabaseClient,
  dtos: CreateFlashcardDto[],
): Promise<Flashcard[]>
```
Query: `.from(TABLE).insert(dtos).select()` — zwraca tablicę `Flashcard[]`. Rzuca error przy błędzie Supabase.

#### 2. Typy dla batch create w testach

**File**: `src/lib/flashcards/__tests__/flashcards.test.ts`

**Intent**: Dodać test dla `batchCreateFlashcards` zgodnie z istniejącym wzorcem testów.

**Contract**:
- Dodać `batchCreateFlashcards` do importów z `"../index"`
- Nowy `describe("batchCreateFlashcards")` z testami: success (zwraca tablicę kart) + error (rzuca przy błędzie Supabase)
- `makeSupabase` nie wymaga zmian (`.select()` zwraca już tablicę gdy brak `.single()`)

Uwaga: dla `batchCreateFlashcards` chain kończy się na `.select()` (bez `.single()`), więc mock musi zwracać `{ data: [card], error: null }` przez `select: vi.fn().mockResolvedValue(result)` — może wymagać osobnego `makeSupabase` lub nadpisania.

#### 3. Generate endpoint

**File**: `src/pages/api/flashcards/generate.ts`

**Intent**: Przyjąć `{ text: string }`, sprawdzić auth, wywołać `generateFlashcards` z serwisu OpenRouter, zwrócić `{ cards: GeneratedCard[] }`.

**Contract**:
- `export const prerender = false` + `export const POST: APIRoute`
- Zod schema: `z.object({ text: z.string().min(50).max(5000) })`
- Null guard na supabase + sprawdzenie `context.locals.user` → 401 gdy brak
- Null guard na `OPENROUTER_API_KEY` → 500 z JSON error gdy brak
- Wywołuje `generateFlashcards({ text, apiKey: OPENROUTER_API_KEY })`
- Sukces: `Response.json({ cards })` z status 200
- Błąd timeout: status 504 z `{ error: "Generation timed out" }`
- Inne błędy: status 500 z `{ error: message }`

#### 4. Batch-create endpoint

**File**: `src/pages/api/flashcards/batch-create.ts`

**Intent**: Przyjąć tablicę kart `{ cards: [{front, back}] }`, sprawdzić auth, zapisać do Supabase przez `batchCreateFlashcards`, zwrócić liczbę zapisanych i dane kart.

**Contract**:
- `export const prerender = false` + `export const POST: APIRoute`
- Zod schema: `z.object({ cards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(1).max(10) })`
- Null guard na supabase + sprawdzenie `context.locals.user` → 401 gdy brak
- Wywołuje `batchCreateFlashcards(supabase, cards)`
- Sukces: `Response.json({ count: cards.length, cards: savedCards })` z status 201
- Błąd Supabase: status 500 z `{ error: message }`

### Success Criteria

#### Automated Verification

- `npm run lint` przechodzi bez błędów TypeScript
- `npm test` — nowe testy dla `batchCreateFlashcards` przechodzą; istniejące niezmienione

#### Manual Verification

- `curl -X POST http://localhost:4321/api/flashcards/generate` bez auth → 401
- `curl -X POST http://localhost:4321/api/flashcards/batch-create` bez auth → 401
- `src/lib/flashcards/index.ts` eksportuje `batchCreateFlashcards`

**Implementation Note**: Po przejściu automatycznej weryfikacji, zatrzymaj się na manualnym potwierdzeniu.

---

## Phase 4: UI — Generate Page

### Overview

Nowa strona Astro `/generate` z React island `GenerateView` obsługującym cały flow: formularz → loading → review → save → success. Link z dashboardu.

### Changes Required

#### 1. Strona Astro

**File**: `src/pages/generate.astro`

**Intent**: Wrapper SSR dla React island z tytułem strony i auth-aware layoutem.

**Contract**: Strona importuje `Layout` i `GenerateView`; montuje island z `client:load`; przekazuje `userEmail={Astro.locals.user?.email}` do komponentu (opcjonalne — dla personalizacji).

#### 2. React island — GenerateView

**File**: `src/components/generate/GenerateView.tsx`

**Intent**: Główny komponent zarządzający całym flow generacji. Maszyna stanów: `idle → loading → review → saving → success | error`.

**Contract**:

Stany:
- `idle`: textarea (placeholder "Paste text to generate flashcards…"), licznik znaków `X / 5000`, przycisk "Generate cards" (disabled gdy <50 lub >5000 znaków)
- `loading`: spinner, textarea i przycisk disabled
- `review`: lista `CardReviewItem` dla każdej karty z przyciskami Accept / Edit / Reject; przycisk "Save X accepted cards" (disabled gdy 0 zaakceptowanych); przycisk "Regenerate"
- `saving`: przycisk "Save" pokazuje spinner
- `success`: komunikat "✅ X cards added to your deck!", przyciski "Generate more" (reset → idle) i "Go to dashboard" (link)
- `error`: czerwony alert z `errorMessage`, przycisk "Retry" (powrót do `idle` z zachowanym tekstem)

Wywołania fetch:
- Generate: `POST /api/flashcards/generate` z `{ text }`
- Save: `POST /api/flashcards/batch-create` z `{ cards: accepted }`

#### 3. Podkomponent karty

**File**: `src/components/generate/CardReviewItem.tsx`

**Intent**: Wyizolować logikę jednej karty (Accept/Edit/Reject) żeby `GenerateView` nie był zbyt duży.

**Contract**:
- Props: `card: GeneratedCard`, `status: "pending" | "accepted" | "edited" | "rejected"`, `onAccept`, `onEdit(front, back)`, `onReject`
- W trybie "edit": dwa pola `<textarea>` (front / back) z przyciskiem "Save edit"
- Wizualnie: accepted = zielona ramka, rejected = szara + przekreślony, edited = niebieska ramka

#### 4. Link z dashboardu

**File**: `src/pages/dashboard.astro`

**Intent**: Dodać przycisk/link "Generate flashcards" żeby użytkownik mógł przejść do `/generate` bezpośrednio po zalogowaniu.

**Contract**: W istniejącym div dodać link `<a href="/generate">` stylizowany jak istniejący przycisk "Sign out".

### Success Criteria

#### Automated Verification

- `npm run lint` przechodzi bez błędów TypeScript
- `npm run build` kończy się bez błędów

#### Manual Verification

- Pełny happy path: zaloguj się → dashboard → kliknij "Generate flashcards" → wklej tekst →  kliknij "Generate" → pojawi się lista kart → zaakceptuj kilka → kliknij "Save" → pojawi się komunikat sukcesu
- Edit flow: po generacji edytuj jedną kartę inline → zapisz → karta ma status "edited" → po Save trafia do bazy ze zmienioną treścią
- Error flow: jeśli `OPENROUTER_API_KEY` nieprawidłowy → pojawia się komunikat błędu inline z przyciskiem Retry
- Walidacja: przycisk Generate disabled dla tekstu <50 znaków; komunikat walidacji dla >5000 znaków
- OQ-2: przetestuj ręcznie na 5 próbkach tekstu czy karty mają sensowną treść (acceptance rate ≈ 75%)

**Implementation Note**: Po przejściu automatycznej weryfikacji, zatrzymaj się na manualnym potwierdzeniu.

---

## Testing Strategy

### Unit Tests

- `src/lib/openrouter/__tests__/openrouter.test.ts`: success, malformed output, timeout
- `src/lib/flashcards/__tests__/flashcards.test.ts`: batchCreateFlashcards success + error

### Integration Tests

Brak w tej fazie — API routes testowane manualnie przez curl lub przeglądarkę.

### Manual Testing Steps

1. Skonfiguruj `OPENROUTER_API_KEY` w `.dev.vars`
2. Uruchom `npx wrangler dev` (nie `npm run dev` — wymagana paryteta workerd)
3. Zaloguj się → dashboard → kliknij "Generate flashcards"
4. Przetestuj 5 próbek tekstu technicznego (OQ-2): wklej, generuj, oceń jakość kart
5. Przetestuj accept / edit / reject dla każdej karty
6. Kliknij "Save" → sprawdź w Supabase Studio że karty trafiły do tabeli z poprawnym `user_id`
7. Przetestuj error state: tymczasowo zmień klucz API na nieprawidłowy

## Performance Considerations

- Batch insert w `batchCreateFlashcards` — jeden request Supabase zamiast N
- Fetch z AbortController (10s) — Worker nie wisi dłużej niż konieczne
- Brak streamingu — świadoma decyzja (unikanie ryzyka workerd SSE)

## Migration Notes

Brak migracji bazy danych — tabela `flashcards` z wszystkimi potrzebnymi polami już istnieje (F-01).

## References

- PRD: `context/foundation/prd.md` — FR-003, FR-004, US-01
- Roadmap: `context/foundation/roadmap.md#S-01`
- Infrastructure: `context/foundation/infrastructure.md` — streaming risk, workerd limits
- Flashcard service: `src/lib/flashcards/index.ts`
- Config pattern: `src/lib/config-status.ts`
- Env pattern: `astro.config.mjs` + `src/lib/supabase.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Config & Infrastructure

#### Automated

- [x] 1.1 `npm run lint` przechodzi bez błędów TypeScript
- [x] 1.2 `npm test` przechodzi (istniejące testy niezmienione)

#### Manual

- [x] 1.3 Brak `OPENROUTER_API_KEY` → baner "OpenRouter nie jest skonfigurowany" widoczny w layoucie
- [x] 1.4 Wejście na `/generate` bez logowania → redirect na `/auth/signin`

### Phase 2: OpenRouter Service Layer

#### Automated

- [ ] 2.1 `npm run lint` przechodzi bez błędów TypeScript
- [ ] 2.2 `npm test` — ≥ 3 nowe testy `openrouter/__tests__/` przechodzą

#### Manual

- [ ] 2.3 `src/lib/openrouter/index.ts` eksportuje `generateFlashcards`
- [ ] 2.4 `src/lib/openrouter/types.ts` eksportuje `GeneratedCard` i `GenerateFlashcardsInput`

### Phase 3: API Routes & Batch Create

#### Automated

- [ ] 3.1 `npm run lint` przechodzi bez błędów TypeScript
- [ ] 3.2 `npm test` — nowe testy `batchCreateFlashcards` przechodzą

#### Manual

- [ ] 3.3 `POST /api/flashcards/generate` bez auth → 401
- [ ] 3.4 `POST /api/flashcards/batch-create` bez auth → 401
- [ ] 3.5 `src/lib/flashcards/index.ts` eksportuje `batchCreateFlashcards`

### Phase 4: UI — Generate Page

#### Automated

- [ ] 4.1 `npm run lint` przechodzi bez błędów TypeScript
- [ ] 4.2 `npm run build` kończy się bez błędów

#### Manual

- [ ] 4.3 Pełny happy path działa end-to-end (tekst → karty → save → sukces)
- [ ] 4.4 Edit flow: edycja karty inline działa poprawnie
- [ ] 4.5 Error flow: błąd API wyświetla komunikat inline z Retry
- [ ] 4.6 Walidacja tekstu: <50 znaków disabled, >5000 znaków komunikat
- [ ] 4.7 OQ-2: ≥ 5 próbek tekstu ocenionych ręcznie; akceptowalny acceptance rate
