# Reconcile test-plan.md with Playwright e2e — Implementation Plan

## Overview

`context/foundation/test-plan.md` still documents the test stack as it stood before Playwright/e2e was wired into CI (commits `381d9c9`, `f7cf898`, `9f7801f`, `8f40a2d`). §4 (Stack) and §7 (What We Deliberately Don't Test) assert "no e2e framework" / "not required" — both now factually wrong, and §5 (Quality Gates) still lists e2e as "not planned" when it's actually a required, deploy-blocking CI gate. This plan corrects those sections, adds a cookbook pattern for future Playwright specs, and updates the freshness ledger. No new risks are added — the e2e suite added so far covers R2, already tracked in §2.

## Current State Analysis

- `playwright.config.ts` — chromium project only, `storageState: "playwright/.auth/user.json"`, depends on a `setup` project that runs `tests/auth.setup.ts`.
- `tests/auth.setup.ts` — logs in via `/auth/signin` using `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` env vars (dedicated test account, not real user credentials), uses `pressSequentially` (not `fill()`) because React 19 controlled inputs don't reliably fire synthetic events from `fill()`, and persists `storageState` after redirect off `/auth/*`.
- `tests/seed.spec.ts` — happy-path generate flow, `getByRole` locators, Polish UI text assertions (`"Generuj fiszki"`, `"Przejrzyj fiszki"`).
- `tests/batch-save-error.spec.ts` — R2 (silent batch-save failure) at the e2e layer: mocks `/api/flashcards/generate` and `/api/flashcards/batch-create` via `page.route`, asserts the error state (retry button) appears and the success state does not.
- `.github/workflows/ci.yml` — `e2e` job runs after `ci`, builds, starts `wrangler dev` on port 8787, runs `npx playwright test`; `deploy` job now has `needs: [ci, e2e]` — e2e blocks production deploy.
- `context/foundation/test-plan.md` §4 row: `e2e | none | — | no Playwright/Cypress configured; not required for current risk map`.
- `context/foundation/test-plan.md` §5 row: `e2e on critical flows | — | not planned (no framework; add in future --refresh if risk map changes) | —`.
- `context/foundation/test-plan.md` §7 bullet: `Full e2e per każdy flow UI — brak frameworka Playwright; koszt × signal nie uzasadnia instalacji dla obecnego risk map.`
- §3 Phased Rollout table intentionally stays untouched (user decision) — it documents risk-driven rollout phases, and the e2e addition was ad-hoc infrastructure work, not a risk-response phase.

## Desired End State

`test-plan.md` §4, §5, §7, and §8 accurately describe the current test stack: Playwright is installed, e2e is a required CI gate that blocks deploy, and the "don't test everything e2e" principle is reframed around cost×signal rather than tool absence. §6 gains a cookbook subsection so the next person adding an e2e spec has a pattern to copy plus a decision rule for when e2e is (and isn't) the right layer. §2 (risk map) and §3 (phase table) are unchanged.

### Key Discoveries:

- The existing specs already establish conventions worth codifying: `pressSequentially` over `fill()` for React 19 controlled inputs, `getByRole` first, Polish locator text, `page.route` for deterministic API mocking, shared `storageState` auth via a `setup` project dependency.
- CI wiring (`8f40a2d`) already flipped e2e from advisory to blocking — this plan only needs to document that, not change CI.

## What We're NOT Doing

- Not adding a new row to §3 Phased Rollout (explicit user decision — e2e was ad-hoc, not risk-driven).
- Not adding new risks to §2 — the e2e suite covers R2, already tracked.
- Not changing `playwright.config.ts`, `.github/workflows/ci.yml`, or any test spec.
- Not writing new e2e tests.

## Implementation Approach

Single-file documentation update to `context/foundation/test-plan.md`, done as four small, independently-verifiable edits in sequence (each is a distinct section of the same file, so ordering doesn't matter functionally, but doing them in this order keeps the diff easy to review section-by-section).

## Phase 1: Correct §4 Stack and §5 Quality Gates

### Overview

Replace the two stale rows that describe e2e as absent/not-planned with rows describing the actual installed, CI-enforced state.

### Changes Required:

#### 1. §4 Stack table — e2e row

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the "none yet" e2e row with a row reflecting Playwright is installed and wired into CI, with a `checked:` date so future readers know when this was last verified.

**Contract**: Table row under `## 4. Stack`, column order `Layer | Tool | Version | Notes`. New row:

```
| e2e | Playwright | ^1.x (see package.json) | `playwright.config.ts` — chromium only, `storageState` auth via `tests/auth.setup.ts`; CI job `e2e` in `.github/workflows/ci.yml` blocks `deploy`; checked: 2026-07-01 |
```

(Implementer: read the actual `@playwright/test` version from `package.json` rather than hardcoding `^1.x`.)

#### 2. §5 Quality Gates table — e2e row

**File**: `context/foundation/test-plan.md`

**Intent**: Flip the e2e gate from "not planned" to "required," matching the `needs: [ci, e2e]` dependency already in CI.

**Contract**: Table row under `## 5. Quality Gates`, column order `Gate | Where | Required? | Catches`. New row:

```
| e2e on critical flows | CI (`.github/workflows/ci.yml`, job `e2e`) | required (blocks `deploy`) | UI regressions the unit/component/integration layers can't reach — full-stack flow through a real `wrangler dev` server |
```

### Success Criteria:

#### Automated Verification:

- [ ] `grep -q "playwright" context/foundation/test-plan.md` matches in §4
- [ ] `grep -q "blocks \`deploy\`" context/foundation/test-plan.md` matches in §5

#### Manual Verification:

- Both rows read correctly in context (table formatting intact, no broken markdown pipes)

---

## Phase 2: Reframe §7 What We Deliberately Don't Test

### Overview

The current §7 bullet justifies excluding full e2e coverage by citing tool absence ("brak frameworka Playwright"). That's no longer true. Reframe the same conclusion (don't chase e2e coverage of every flow) on its real justification: cost×signal, not tooling gap.

### Changes Required:

#### 1. §7 e2e bullet

**File**: `context/foundation/test-plan.md`

**Intent**: Keep the same policy (don't add e2e for every UI flow) but ground it in principle #1 (cost×signal) now that the tooling excuse no longer applies — otherwise a future reader sees Playwright already installed and assumes the exclusion no longer holds.

**Contract**: Replace the existing "Full e2e per każdy flow UI" bullet under `## 7. What We Deliberately Don't Test` with:

```
- **Full e2e per każdy flow UI** — Playwright jest zainstalowany i wpięty w CI (§4, §5) od 2026-07-01, ale to nie znaczy że każdy flow potrzebuje e2e. Obecne specy (`seed.spec.ts`, `batch-save-error.spec.ts`) celują w R2 na poziomie e2e jako uzupełnienie warstwy unit/component — nie duplikują całego risk mapu. Dodawaj nowy e2e spec tylko gdy pojawi się nowy High×High risk, dla którego niższa warstwa (unit/integration/component) nie daje wystarczającego sygnału — patrz §6.7 dla reguły decyzyjnej. (Source: §1 principle #1; zaktualizowano 2026-07-01.)
```

### Success Criteria:

#### Automated Verification:

- [ ] `grep -q "brak frameworka Playwright" context/foundation/test-plan.md` returns no match (old wording removed)

#### Manual Verification:

- Reframed bullet reads as a coherent continuation of §7's list style (bold lede + prose + Source parenthetical, matching sibling bullets)

---

## Phase 3: Add §6.7 cookbook pattern for Playwright specs

### Overview

§6 (Cookbook Patterns) has no subsection for e2e, so the next person adding a Playwright spec has nothing to copy. Add §6.7 codifying the conventions already established by the 3 existing specs, plus the decision rule for when e2e is (and isn't) the right layer.

### Changes Required:

#### 1. New §6.7 subsection

**File**: `context/foundation/test-plan.md`

**Intent**: Document the auth/storageState pattern, the `pressSequentially`-over-`fill()` React 19 gotcha, the `page.route` mocking pattern, and the Polish-locator convention — all already established in `tests/auth.setup.ts`, `tests/seed.spec.ts`, `tests/batch-save-error.spec.ts`. Close with the decision rule for when to add a new e2e spec vs. a cheaper layer, referenced from §7's reframed bullet.

**Contract**: New `### 6.7 Adding a Playwright e2e spec` subsection after existing §6.6, following the same style as §6.3/§6.4 (location, required setup, gotcha callout, reference test link). Must include:
- Location: `tests/<scenario>.spec.ts`, shared config at `playwright.config.ts`.
- Auth: reuse `storageState: "playwright/.auth/user.json"` via `test.use({...})` — do not re-implement login per spec; `tests/auth.setup.ts` runs once via the `setup` project dependency.
- React 19 gotcha: use `locator.pressSequentially(text)`, not `.fill(text)`, for controlled inputs — `fill()` sets the DOM value without reliably firing React's synthetic `onChange`.
- Mocking: use `page.route("**/api/...", (route) => route.fulfill({...}))` for deterministic API responses instead of depending on real OpenRouter/Supabase state.
- Locators: `getByRole`/`getByText` matching the Polish UI copy actually rendered (not translated placeholders) — same locator-priority rule as the project-wide `getByRole`/`getByLabel`/`getByText` convention.
- Reference tests: `tests/seed.spec.ts`, `tests/batch-save-error.spec.ts`, `tests/auth.setup.ts`.
- Decision rule (new prose, not from existing files): "Add a new e2e spec only when a risk needs full-stack signal that unit/integration/component tests cannot give cheaply — e.g., a real browser session crossing multiple routes, or a regression that only manifests through the actual `wrangler dev` runtime. If the risk can be proven at a cheaper layer (§6.1–§6.5), do that instead; e2e is the last resort, not the default, per §1 principle #1."

### Success Criteria:

#### Automated Verification:

- [ ] `grep -q "### 6.7 Adding a Playwright e2e spec" context/foundation/test-plan.md`
- [ ] `grep -q "pressSequentially" context/foundation/test-plan.md` (gotcha documented)

#### Manual Verification:

- Subsection reads consistently with §6.3/§6.4 style (Location/pattern/gotcha/reference-test structure)
- Decision rule is stated as a rule, not vague guidance ("only when X, not when Y")

---

## Phase 4: Update §8 Freshness Ledger

### Overview

§8 currently shows all dates as `2026-06-18`, predating this refresh. Add a line for the e2e reconciliation so the ledger reflects reality.

### Changes Required:

#### 1. §8 Freshness Ledger

**File**: `context/foundation/test-plan.md`

**Intent**: Record that §4/§5/§7 were reviewed today as part of this refresh, without claiming the rest of the strategy (§1–§3) was re-reviewed (it wasn't — the refresh scope was narrow).

**Contract**: Add one line under the existing bullets in `## 8. Freshness Ledger`:

```
- e2e stack facts (§4, §5, §7) last reviewed: 2026-07-01 (Playwright/CI reconciliation, `test-plan-refresh-2026-07-01`)
```

### Success Criteria:

#### Automated Verification:

- [ ] `grep -q "test-plan-refresh-2026-07-01" context/foundation/test-plan.md`

#### Manual Verification:

- Ledger line doesn't overstate scope (only claims §4/§5/§7 reviewed, not the whole strategy)

---

## Testing Strategy

### Manual Testing Steps:

1. Read the full updated `test-plan.md` top to bottom — confirm no contradictions remain between §4/§5/§7 and the rest of the document (e.g., §3's phase table still correctly shows no e2e phase, consistent with the "not doing" decision).
2. Confirm markdown tables in §4 and §5 still render correctly (pipe alignment, no missing cells).
3. Confirm §6.7 renders as a proper subsection under §6, not nested incorrectly under §6.6.

## References

- Related research: none (change notes in `context/changes/test-plan-refresh-2026-07-01/change.md` served as the scoping brief)
- Reference specs: `tests/auth.setup.ts`, `tests/seed.spec.ts`, `tests/batch-save-error.spec.ts`
- CI config: `.github/workflows/ci.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Correct §4 Stack and §5 Quality Gates

#### Automated

- [x] 1.1 `grep -q "playwright" context/foundation/test-plan.md` matches in §4 — 215d263
- [x] 1.2 `grep -q "blocks \`deploy\`" context/foundation/test-plan.md` matches in §5 — 215d263

#### Manual

- [x] 1.3 Both rows read correctly in context (table formatting intact) — 215d263

### Phase 2: Reframe §7 What We Deliberately Don't Test

#### Automated

- [x] 2.1 `grep -q "brak frameworka Playwright" context/foundation/test-plan.md` returns no match

#### Manual

- [x] 2.2 Reframed bullet reads consistently with §7's list style

### Phase 3: Add §6.7 cookbook pattern for Playwright specs

#### Automated

- [ ] 3.1 `grep -q "### 6.7 Adding a Playwright e2e spec" context/foundation/test-plan.md`
- [ ] 3.2 `grep -q "pressSequentially" context/foundation/test-plan.md`

#### Manual

- [ ] 3.3 Subsection style matches §6.3/§6.4; decision rule is a stated rule, not vague guidance

### Phase 4: Update §8 Freshness Ledger

#### Automated

- [ ] 4.1 `grep -q "test-plan-refresh-2026-07-01" context/foundation/test-plan.md`

#### Manual

- [ ] 4.2 Ledger line doesn't overstate scope
