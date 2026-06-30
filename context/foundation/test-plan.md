# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-19 (Phase 1 impl_reviewed; §6.1 + §6.2 filled in)

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

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| R1 | Po ocenie "Good" dla nowej karty `due_date` mieści się w udokumentowanym przedziale FSRS (nie dzisiaj, nie jutro); po "Again" `lapses` wzrasta o dokładnie 1 | "testy przechodzą z real ts-fsrs = harmonogramacja poprawna" — obecne testy asertują tylko `reps > 0`, `state in {...}` bez date-range assertions | Jakie przedziały interwałów definiuje FSRS dla każdego ratingu od stanu New; jak `Card.due` przechodzi przez ISO 8601 → DB → deserialization | Integration z real ts-fsrs + date-range assertions (bez e2e; ts-fsrs jest pure-math) | Asertować tylko `due_date > now()` — przepuści zarówno jutro jak i 6 miesięcy |
| R2 | Gdy endpoint zwraca błąd, UI wyświetla komunikat i NIE pokazuje success state; żadna karta nie jest cichym sukcesem | "route zwraca 5xx JSON = UI obsłuży błąd" — czy GenerateView faktycznie parsuje non-2xx i przechodzi do `error` state | Jak GenerateView obsługuje non-2xx z batch-create; czy `error` ViewState jest podłączony do ścieżki Supabase error | Unit test GenerateView (mock fetch 500) + unit test serwisu (mock Supabase error) | Testować tylko happy path (Supabase sukces) — bug pattern to właśnie cicha failure path |
| R3 | Gdy content OpenRouter to nie-JSON lub brakuje pól `front`/`back`, API zwraca opisowy błąd (nie 200 z pustą tablicą); UI pokazuje error inline z opcją Retry | "Zod safeParse wystarczy" — co jeśli `choices[0].message.content` jest null; co jeśli JSON jest tablicą obiektów innego kształtu | Wszystkie failure modes obsługiwane przez serwis OpenRouter; co API route zwraca dla każdego; jak GenerateView parsuje error response | Unit testy dla generateFlashcards (warianty malformed) + GenerateView unit test (mock error response) | Testować że serwis rzuca wyjątek — nie sprawdzając czy błąd dociera do UI |
| R4 | Po błędzie batch-save GenerateView wraca do `review` state z zachowanymi zaakceptowanymi kartami; Retry nie resetuje accepted status; licznik "Save X cards" jest spójny przez cały cykl | "maszyna stanów wygląda ok w happy path" — saving→error może resetować cały stan komponentu | Jak `acceptedCards` jest zarządzane przez ViewState transitions; co się dzieje ze stanem po error; czy "Regenerate" czyści accepted cards | React unit test (vitest + RTL) z mock fetch dla error scenarios | Snapshot HTML — zmienia się, nie łapie logiki stanów |
| R5 | Request bez ważnego session cookie do dowolnego API route lub strony Astro dostaje redirect lub 401 — w tym nowych tras z S-03 | "PROTECTED_ROUTES zawiera /generate i /review = wszystko chronione" — API routes mają też własny auth guard; który jest load-bearing | Czy middleware to jedyna warstwa czy API routes też niezależnie sprawdzają auth; jak middleware reaguje na trasy spoza PROTECTED_ROUTES | Integration test middleware (brak sesji → redirect) + unit test każdego API route (brak user → 401) | Testować tylko że istniejące chronione trasy działają — bez testu mechanizmu dla przyszłych tras |
| R6 | Request z sesją usera A dla cardId usera B dostaje 404 lub 403 — nie dane karty B | "Supabase RLS zapewnia izolację" — jeśli service-role client użyty przez pomyłkę, RLS bypassowany | Który Supabase client (anon vs service-role) używany w każdym API route; czy jest app-level ownership check oprócz RLS | Integration test z dwoma mock users — cross-user cardId zwraca 403/404 | Testować tylko że owner dostaje 200 bez testowania odrzucenia cross-user request |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Core-loop integrity | Udowodnić że FSRS nie korumpuje harmonogramu, batch-save nie milczy po błędzie, AI error dociera do UI | R1 ✓ (`testing-core-loop-integrity`, impl_reviewed), R2, R3 | unit (extend), integration (new) | change opened | context/changes/testing-r2-r3-error-paths |
| 2 | UI state + auth boundary | Udowodnić że GenerateView obsługuje błędy bez utraty kart; auth boundary trzyma się przy nowych trasach | R4, R5 | component tests (RTL), integration | not started | — |
| 3 | Data isolation + quality gates | Udowodnić cross-user rejection (IDOR); zamknąć obowiązkowe CI gates | R6 | integration (IDOR), CI gate wiring | not started | — |

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

TBD — see §3 Phase 2. Will document RTL setup, ViewState transition testing pattern, fetch mock approach, and `npm test` run command.

### 6.4 Adding a test for a new API route

TBD — see §3 Phase 2. Will document auth guard test pattern (missing user → 401) and how to extend coverage to new routes added in S-03.

### 6.5 Adding a cross-user isolation test

TBD — see §3 Phase 3. Will document IDOR test pattern (two mock users, cross-user cardId → 403/404) and which Supabase client mock to use.

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
