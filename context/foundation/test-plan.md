# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-01 (Phases 1–4 complete — rollout finished)

---

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   an area" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (last 30 days, excluding `node_modules/`, `dist/`, `.astro/`).

---

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|-----------|-------------------------------|
| R1 | **FSRS scheduluje błędnie** — `due_date` po ocenie ląduje w złym przedziale (np. jutro dla Easy, za rok dla Again); użytkownik traci zaufanie do harmonogramu i porzuca app | High | Medium | Interview Q1; S-02 archive plan (złożone mapowanie dat ts-fsrs↔ISO 8601↔timestamptz, Rating bracket notation); hot-spot dir `src/lib/spaced-repetition/` 3 commitów/30d |
| R2 | **Cichy błąd batch-save** — batch-create endpoint zwraca błąd, GenerateView pokazuje sukces lub milczy; użytkownik traci karty zaakceptowane po długim przeglądzie | High | Medium | Interview Q2 (spalony/a przed tym wzorcem); PRD guardrail "Losing a deck would destroy trust immediately and is an unrecoverable failure"; hot-spot dir `src/lib/flashcards/` 10 commitów/30d |
| R3 | **Błąd AI output → utrata sesji** — OpenRouter zwraca złośliwy lub obcięty JSON; parse failure zwraca 5xx; UI nie daje Retry z zachowanym tekstem; użytkownik traci cały wkład | High | Medium | Interview Q3 ("nigdy nie wiem czy OpenRouter zwróci dobry JSON"); PRD FR-003 Socrates "low card quality is the primary failure mode"; S-01 archive plan (safeParse jako jedyna bariera) |
| R4 | **Regresja maszyny stanów GenerateView** — saving→error nie przywraca `review` state z zaakceptowanymi kartami; Retry resetuje accepted cards; licznik zaakceptowanych desynchronizuje się | Medium | Medium | Interview Q4 (nigdy nie testowane); S-01 archive plan (6-stanowa maszyna: idle→loading→review→saving→success/error); hot-spot dir `src/components/generate/` 3 commitów/30d |
| R5 | **Auth boundary pominięty w nowej trasie** — S-03 doda nowe routes; jeśli developer nie doda do `PROTECTED_ROUTES`, niezalogowany user dociera do chronionych zasobów | High | Medium | CLAUDE.md architecture (PROTECTED_ROUTES ręcznie utrzymywane); hot-spot `src/middleware.ts` 5 zmian/30d; roadmap S-03 proposed |
| R6 | **IDOR / cross-user data access** — API route przetwarza `cardId` należący do innego usera; Supabase RLS to jedyna warstwa izolacji; service-role client (użyty w S-04) bypassuje RLS gdy użyty przez pomyłkę | High | Low | PRD NFR "One user's flashcard data is never visible to another user"; S-02 archive plan (RLS as sole check); S-04 archive plan (service-role client istnieje w codebase); hot-spot dir `src/pages/api/flashcards/` 7 commitów/30d |
| R7 | **Cichy błąd CRUD w FlashcardsListView** — POST `/api/flashcards` lub PUT `/api/flashcards/:id` zwraca błąd; FlashcardsListView pokazuje sukces lub milczy; użytkownik nie wie że ręcznie wpisana/edytowana karta nie została zapisana | Medium | Medium | Interview Q1 (wzorzec identyczny jak R2 — batch-save silence); S-03 archive (nowy komponent CRUD bez testów); FlashcardsListView.tsx brak jakichkolwiek testów |
| R8 | **Błąd oceny SR freezuje SessionView** — `handleRate` łapie błąd POST `/api/flashcards/review` i przywraca stan `flipped` z `errorMessage`, ale brak testów weryfikujących ten flow; regresja = cicha failure lub UI freezuje, użytkownik traci postęp sesji | High | Medium | SessionView.tsx brak testów; maszyna stanów loading→session→flipped→saving→summary ma tę samą klasę ryzyka co R4 (GenerateView); user concern: "sesja SR powinna działać nawet po błędzie sieci" |
| R9 | **Brak 401 dla list/create API routes** — GET `/api/flashcards/list` i POST `/api/flashcards` nie mają testów auth boundary; spójność z wzorcem R5 (przetestował middleware, nie konkretne trasy) | High | Low | R5 Response Guidance: "unit test każdego API route (brak user → 401)"; list.ts i index.ts dodane w S-03 po impl-review Phase 3 — nigdy nie przetestowane |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| R1 | Po ocenie "Good" dla nowej karty `due_date` mieści się w udokumentowanym przedziale FSRS (nie dzisiaj, nie jutro); po "Again" `lapses` wzrasta o dokładnie 1 | "testy przechodzą z real ts-fsrs = harmonogramacja poprawna" — obecne testy asertują tylko `reps > 0`, `state in {...}` bez date-range assertions | Jakie przedziały interwałów definiuje FSRS dla każdego ratingu od stanu New; jak `Card.due` przechodzi przez ISO 8601 → DB → deserialization | Integration z real ts-fsrs + date-range assertions (bez e2e; ts-fsrs jest pure-math) | Asertować tylko `due_date > now()` — przepuści zarówno jutro jak i 6 miesięcy |
| R2 | Gdy endpoint zwraca błąd, UI wyświetla komunikat i NIE pokazuje success state; żadna karta nie jest cichym sukcesem | "route zwraca 5xx JSON = UI obsłuży błąd" — czy GenerateView faktycznie parsuje non-2xx i przechodzi do `error` state | Jak GenerateView obsługuje non-2xx z batch-create; czy `error` ViewState jest podłączony do ścieżki Supabase error | Unit test GenerateView (mock fetch 500) + unit test serwisu (mock Supabase error) | Testować tylko happy path (Supabase sukces) — bug pattern to właśnie cicha failure path |
| R3 | Gdy content OpenRouter to nie-JSON lub brakuje pól `front`/`back`, API zwraca opisowy błąd (nie 200 z pustą tablicą); UI pokazuje error inline z opcją Retry | "Zod safeParse wystarczy" — co jeśli `choices[0].message.content` jest null; co jeśli JSON jest tablicą obiektów innego kształtu | Wszystkie failure modes obsługiwane przez serwis OpenRouter; co API route zwraca dla każdego; jak GenerateView parsuje error response | Unit testy dla generateFlashcards (warianty malformed) + GenerateView unit test (mock error response) | Testować że serwis rzuca wyjątek — nie sprawdzając czy błąd dociera do UI |
| R4 | Po błędzie batch-save GenerateView wraca do `review` state z zachowanymi zaakceptowanymi kartami; Retry nie resetuje accepted status; licznik "Save X cards" jest spójny przez cały cykl | "maszyna stanów wygląda ok w happy path" — saving→error może resetować cały stan komponentu | Jak `acceptedCards` jest zarządzane przez ViewState transitions; co się dzieje ze stanem po error; czy "Regenerate" czyści accepted cards | React unit test (vitest + RTL) z mock fetch dla error scenarios | Snapshot HTML — zmienia się, nie łapie logiki stanów |
| R5 | Request bez ważnego session cookie do dowolnego API route lub strony Astro dostaje redirect lub 401 — w tym nowych tras z S-03 | "PROTECTED_ROUTES zawiera /generate i /review = wszystko chronione" — API routes mają też własny auth guard; który jest load-bearing | Czy middleware to jedyna warstwa czy API routes też niezależnie sprawdzają auth; jak middleware reaguje na trasy spoza PROTECTED_ROUTES | Integration test middleware (brak sesji → redirect) + unit test każdego API route (brak user → 401) | Testować tylko że istniejące chronione trasy działają — bez testu mechanizmu dla przyszłych tras |
| R6 | Request z sesją usera A dla cardId usera B dostaje 404 lub 403 — nie dane karty B | "Supabase RLS zapewnia izolację" — jeśli service-role client użyty przez pomyłkę, RLS bypassowany | Który Supabase client (anon vs service-role) używany w każdym API route; czy jest app-level ownership check oprócz RLS | Integration test z dwoma mock users — cross-user cardId zwraca 403/404 | Testować tylko że owner dostaje 200 bez testowania odrzucenia cross-user request |
| R7 | Gdy POST/PUT zwraca błąd, FlashcardsListView wyświetla komunikat i NIE przełącza się w success state; edytowany tekst jest zachowany | "komponent wygląda ok w happy path" — czy error branch z non-2xx fetch aktualizuje stan UI czy go resetuje | Jak FlashcardsListView zarządza stanem `isSubmitting`/`error` przez cykl request; czy edytowany tekst jest przechowywany w stanie oddzielnym od server response | Component test (RTL) z mock fetch 500 — UI pokazuje błąd; tekst pola zachowany | Testować tylko happy path (201/200) — bug pattern to właśnie cicha failure path |
| R8 | Po błędzie POST `/api/flashcards/review`, SessionView wraca do `flipped` state i pokazuje `errorMessage` — sesja nie freezuje, ocena może być ponowiona | "handleRate łapie błąd catch = jest obsłużony" — czy `setViewState("flipped")` faktycznie odwraca stan, czy komponent utknął na `saving` | Jak `viewState` przechodzi przez `flipped → saving → flipped(error)` w SessionView; czy errorMessage jest widoczny w DOM po catch | Component test (RTL) z mock fetch 500 dla POST review — viewState = flipped, errorMessage widoczny | Testować tylko że catch istnieje bez weryfikacji że UI rzeczywiście wraca do użytecznego stanu |
| R9 | Request bez użytkownika do GET `/api/flashcards/list` i POST `/api/flashcards` dostaje 401 | "middleware chroni trasy = API routes też bezpieczne" — API routes mogą mieć własny auth check niezależny od middleware | Czy list.ts i index.ts sprawdzają `context.locals.user` niezależnie; co zwracają gdy `user === null` | API route unit test (brak user → 401) dla list.ts i index.ts — spójnie z wzorcem z §6.4 | Zakładać że middleware test (Phase 2) obejmuje też konkretne trasy — każda trasa musi być przetestowana osobno |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Core-loop integrity | Udowodnić że FSRS nie korumpuje harmonogramu, batch-save nie milczy po błędzie, AI error dociera do UI | R1 ✓ (`testing-core-loop-integrity`, impl_reviewed), R2, R3 | unit (extend), integration (new) | complete | context/changes/testing-r2-r3-error-paths |
| 2 | UI state + auth boundary | Udowodnić że GenerateView obsługuje błędy bez utraty kart; auth boundary trzyma się przy nowych trasach | R4, R5 | component tests (RTL), integration | complete | context/changes/testing-ui-state-auth-boundary |
| 3 | Data isolation + quality gates | Udowodnić cross-user rejection (IDOR); zamknąć obowiązkowe CI gates | R6 | integration (IDOR), CI gate wiring | complete | context/changes/testing-data-isolation |
| 4 | CRUD UI + SR session error paths | Udowodnić że FlashcardsListView nie milczy po błędzie API; SessionView wraca do użytecznego stanu po błędzie oceny; list/create routes mają testy 401 | R7, R8, R9 | component tests (RTL), API route unit tests | complete | context/changes/testing-crud-sr-error-paths |

---

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | vitest | ^4.1.7 | configured via `package.json`; `npm test` runs once, `npm run test:watch` in dev |
| component tests | @testing-library/react + @testing-library/user-event | installed in Phase 1 (testing-r2-r3-error-paths); see §3 Phase 1 for component test cookbook (§6.3) | needed for GenerateView state-machine tests; installed early to cover R2/R3 UI layer |
| API/fetch mocking | vi.stubGlobal("fetch") | built-in vitest | current pattern in openrouter tests; sufficient for unit layer |
| e2e | none yet | — | no Playwright/Cypress configured; not required for current risk map |
| accessibility | none | — | not in current risk map |

**Stack grounding tools (current session):**
- Docs: Context7 — available; not queried (no library-specific API ambiguity in current risk map; ts-fsrs and Supabase patterns already grounded in S-01/S-02 archive plans); checked: 2026-06-18
- Search: Exa.ai — available; not queried (local evidence sufficient for risk map); checked: 2026-06-18
- Runtime/browser: Claude in Chrome — available; not used for test layer (no Playwright framework configured; manual smoke tests viable for critical flows); checked: 2026-06-18
- Provider/platform: Supabase MCP — not available in current session; RLS verification must be done via integration tests or Supabase Studio manual check

---

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI (`.github/workflows/ci.yml`) | required (already wired) | syntactic / type drift |
| unit tests | local + CI | required after §3 Phase 1 | logic regressions in service layer |
| integration tests | local + CI | required after §3 Phase 1 | API route error paths, auth boundary |
| component tests | local + CI | required after §3 Phase 2 | UI state machine regressions |
| e2e on critical flows | — | not planned (no framework; add in future `--refresh` if risk map changes) | — |
| pre-prod smoke | manual | optional | environment-specific failures (Cloudflare Workers vs local) |

---

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section fills in once
the relevant rollout phase ships.

### 6.1 Adding a unit test for a service function

**Location**: `src/lib/<module>/__tests__/<module>.test.ts` — one test file per module, co-located with the module under `__tests__/`.

**Naming convention**:
```ts
describe("functionName", () => {
  it("scenario → expected outcome", () => { ... });
});
```
Each `it` names a concrete input scenario and an observable outcome — not implementation details.

**Reference test**: [`src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts`](../../../src/lib/spaced-repetition/__tests__/spaced-repetition.test.ts)

**Factory pattern** — define a typed factory at the top of the file with optional overrides:
```ts
const newCard = (overrides?: Partial<Flashcard>): Flashcard => ({
  id: "test-id", user_id: "user-id", front: "Q", back: "A",
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0,
  reps: 0, lapses: 0, state: 0, due_date: new Date().toISOString(), last_review: null,
  ...overrides,
});
```
Sibling module `flashcards.test.ts` uses the same pattern as `makeCard(overrides?)`.

**Run**: `npm test` (runs vitest once); `npm run test:watch` during dev.

### 6.2 Adding an integration test for FSRS scheduling

Use **real ts-fsrs** — no mocks. The library is pure math; mocking it produces tests that verify the mock, not the schedule.

**Capture `before` before the call** — ts-fsrs computes `due` from `new Date()` at call time:
```ts
const before = Date.now();
const result = computeNextCard(newCard(), "Good");
const dueMs = new Date(result.due_date).getTime();
```

**Date-range assertions** — tolerance ±30 s (ts-fsrs v5.4.1, `enable_fuzz = false`, deterministic):

| Rating | `state` | `scheduled_days` | lower bound | upper bound |
|--------|---------|-----------------|-------------|-------------|
| Again  | `1` (Learning) | `0` | `before + 30_000`        | `before + 90_000`        |
| Hard   | `1` (Learning) | `0` | `before + 330_000`       | `before + 390_000`       |
| Good   | `1` (Learning) | `0` | `before + 570_000`       | `before + 630_000`       |
| Easy   | `2` (Review)   | `> 0` | `before + 7 * 86_400_000` | `before + 9 * 86_400_000` |

**Assertion pattern**:
```ts
expect(result.state).toBe(1);
expect(result.scheduled_days).toBe(0);
expect(dueMs).toBeGreaterThan(before + 30_000);
expect(dueMs).toBeLessThan(before + 90_000);
```

**`scheduled_days` for Easy**: assert `toBeGreaterThan(0)`, not a literal like `toBe(8)` — the exact value derives from ts-fsrs default weights and may change on a minor library upgrade. The date-range assertion already catches schedule-length regressions.

**Regression smoke**: inject a temporary bug (`new Date(Date.now() + 86_400_000)` in place of `new Date()`) — the Again test must FAIL with an upper-bound violation. Revert and re-run: all green.

### 6.3 Adding a component test for a React island

**Location**: `src/components/<feature>/__tests__/<Component>.test.tsx` — co-located with the component.

**Required docblock** (vitest 4 glob doesn't match absolute paths — environmentMatchGlobs doesn't work):
```ts
// @vitest-environment jsdom
```
First line of every component test file, before any imports.

**Imports**:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MyComponent } from "../MyComponent";
```

**afterEach cleanup** (RTL does NOT auto-cleanup in vitest):
```ts
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
```

**Mocking fetch** — use `vi.stubGlobal`, never import fetch directly:
```ts
function makeJsonResponse(body: unknown, ok: boolean, status: number): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

vi.stubGlobal("fetch", vi.fn()
  .mockResolvedValueOnce(makeJsonResponse({ cards: [...] }, true, 200))
  .mockResolvedValueOnce(makeJsonResponse({ error: "..." }, false, 500))
);
```

**Button disabled check** — `jest-dom` is NOT installed; use the DOM property directly:
```ts
expect((screen.getByRole("button", { name: /Label/i }) as HTMLButtonElement).disabled).toBe(false);
```

**Async assertions** — always `findBy*` (not `getBy*`) after user actions that trigger state changes:
```ts
await screen.findByText(/Expected text/i);
```

**Reference test**: [`src/components/generate/__tests__/GenerateView.test.tsx`](../../../src/components/generate/__tests__/GenerateView.test.tsx)

### 6.4 Adding a test for a new API route or middleware

#### A) Astro API route unit test

**Location**: `src/pages/api/<module>/__tests__/<route>.test.ts`

**Pattern** — import the exported handler directly, no HTTP server needed:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/myService", () => ({ myFn: vi.fn() }));

import { myFn } from "@/lib/myService";
import { POST } from "../my-route";

function makeContext(user: unknown, body: unknown): APIContext {
  return {
    locals: { user },
    request: new Request("http://localhost/api/...", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    cookies: {},
  } as unknown as APIContext;
}

describe("POST /api/...", () => {
  afterEach(() => { vi.clearAllMocks(); });

  it("returns 401 when no user is authenticated", async () => {
    const response = await POST(makeContext(null, { ... }));
    expect(response.status).toBe(401);
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(myFn).mockRejectedValueOnce(new Error("db error"));
    const response = await POST(makeContext({ id: "user-1" }, { ... }));
    expect(response.status).toBe(500);
  });
});
```

**Note**: `vi.mock(...)` calls must appear before imports (vitest hoisting). For `astro:env/server`, mock as `vi.mock("astro:env/server", () => ({ MY_KEY: "test-key" }))`.

**Reference tests**: [`src/pages/api/flashcards/__tests__/batch-create.test.ts`](../../../src/pages/api/flashcards/__tests__/batch-create.test.ts), [`src/pages/api/flashcards/__tests__/generate.test.ts`](../../../src/pages/api/flashcards/__tests__/generate.test.ts)

#### B) Middleware unit test

**Location**: `src/__tests__/middleware.test.ts`

**Pattern** — mock `defineMiddleware` as identity, mock `createClient` to return null (no session):
```ts
vi.mock("astro:middleware", () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn().mockReturnValue(null) }));

import { onRequest } from "../middleware";

function makeContext(pathname: string) {
  return {
    url: new URL("http://localhost" + pathname),
    locals: {},
    request: new Request("http://localhost" + pathname),
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    cookies: {},
  };
}

it("redirects unauthenticated request to protected route", async () => {
  const next = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
  const response = await (onRequest as Function)(makeContext("/generate"), next);
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toContain("/auth/signin");
  expect(next).not.toHaveBeenCalled();
});
```

**Reference test**: [`src/__tests__/middleware.test.ts`](../../../src/__tests__/middleware.test.ts)

### 6.5 Adding a cross-user isolation test

Two patterns: (A) ownership-check unit test for a mutation route, (B) structural guard that enforces no route imports the service-role client.

#### A) IDOR unit test — cross-user mutation returns 403

**Location**: `src/pages/api/flashcards/__tests__/<route>.test.ts`

**Pattern** — mock `getFlashcard` to return a card owned by a different user, assert 403 and that the destructive function was never called:

```ts
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/flashcards", () => ({
  getFlashcard: vi.fn(),
  deleteFlashcard: vi.fn(),
  // add updateFlashcard etc. as needed
}));

import { getFlashcard, deleteFlashcard } from "@/lib/flashcards";
import { DELETE } from "../[id]";

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";
const CARD_ID  = "card-1";

function makeContext(userId: string, cardId = CARD_ID): APIContext {
  return {
    locals: { user: { id: userId } },
    params: { id: cardId },
    request: new Request(`http://localhost/api/flashcards/${cardId}`, { method: "DELETE" }),
    cookies: {},
  } as unknown as APIContext;
}

it("R6: returns 403 when card belongs to a different user", async () => {
  vi.mocked(getFlashcard).mockResolvedValueOnce(
    { id: CARD_ID, user_id: OTHER_ID } as Flashcard,
  );
  const response = await DELETE(makeContext(OWNER_ID));
  expect(response.status).toBe(403);
  expect(vi.mocked(deleteFlashcard)).not.toHaveBeenCalled();
});
```

**Prerequisite**: the route must fetch the card and compare `card.user_id !== user.id` before executing the mutation (see `src/pages/api/flashcards/[id].ts`). The anon Supabase client + RLS is the primary isolation layer; this is the belt-and-suspenders app-level check.

**Reference test**: [`src/pages/api/flashcards/__tests__/id.test.ts`](../../../src/pages/api/flashcards/__tests__/id.test.ts)

#### B) Structural guard — no flashcard route imports createAdminClient

**Location**: `src/__tests__/security.test.ts`

**Pattern** — read route files from disk and assert none contains the service-role client import:

```ts
// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectTsFiles(dir: string): string[] { /* recursive */ }

it("no API route imports createAdminClient", () => {
  const apiDir = join(process.cwd(), "src", "pages", "api", "flashcards");
  const violators = collectTsFiles(apiDir)
    .filter((f) => readFileSync(f, "utf-8").includes("createAdminClient"));
  expect(violators).toEqual([]);
});
```

**Note**: scope the scan to `src/pages/api/flashcards/` — auth routes (`src/pages/api/auth/`) legitimately use `createAdminClient` to delete Supabase Auth users.

**Reference test**: [`src/__tests__/security.test.ts`](../../../src/__tests__/security.test.ts)

### 6.6 Per-rollout-phase notes

(Fills in as phases ship.)

---

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5).

- **Marketing / landing pages** — zmieniają się co tydzień; snapshot tests generują false-positive failures bez wartościowego sygnału. Re-evaluate if marketing pages start carrying business logic. (Source: interview Q5.)
- **TypeScript type assertions** — kompilator (tsc via `npm run lint`) już to sprawdza; powielenie w testach jest implementation mirror. (Source: stack conventions, §1 principle #1.)
- **Reliability zewnętrznych serwisów** — dostępność Supabase, OpenRouter, Cloudflare Workers — to należy do observability/alerting (celowo odroczone per roadmap Parked). (Source: roadmap Parked section.)
- **Full e2e per każdy flow UI** — brak frameworka Playwright; koszt × signal nie uzasadnia instalacji dla obecnego risk map. Dodać w `--refresh` jeśli pojawi się nowy High×High risk wymagający end-to-end. (Source: §1 principle #1.)

---

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-18
- Stack versions last verified: 2026-06-18
- AI-native tool references last verified: 2026-06-18

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive (e.g. S-03 manual-card-management ships and introduces new CRUD surface),
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
