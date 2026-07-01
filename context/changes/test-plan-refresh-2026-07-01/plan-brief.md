# Reconcile test-plan.md with Playwright e2e — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-07-01/plan.md`

## What & Why

Playwright/e2e was wired into CI (commits `381d9c9`, `f7cf898`, `9f7801f`, `8f40a2d`) outside the `/10x-test-plan` process. `context/foundation/test-plan.md` still says "no e2e framework" / "not required" in §4 and §7, and lists the e2e gate as "not planned" in §5 — all now false. This plan brings the document back in sync with reality so it stops misleading the next reader into re-litigating "should we add Playwright."

## Starting Point

Playwright is installed (`playwright.config.ts`, chromium project, shared `storageState` auth), 3 specs exist in `tests/` (`auth.setup.ts`, `seed.spec.ts`, `batch-save-error.spec.ts`), and CI's `e2e` job now blocks the `deploy` job (`needs: [ci, e2e]`). None of this is reflected in `test-plan.md`.

## Desired End State

`test-plan.md` §4/§5 accurately list Playwright as installed and required; §7 explains that e2e exclusion is now a cost×signal choice, not a tooling gap; §6 gains a cookbook pattern (§6.7) so the next e2e spec follows the existing conventions (storageState reuse, `pressSequentially` for React 19 inputs, `page.route` mocking, Polish locators) and a clear rule for when e2e is warranted vs. overkill.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| §3 Phased Rollout table | Leave untouched, no retroactive e2e row | e2e was ad-hoc infra work, not a risk-driven rollout phase — adding a row would force an artificial "risks covered" mapping | Plan (user chose) |
| §6.7 scope | Code pattern + explicit "when to add e2e" decision rule | Prevents future e2e sprawl that would violate §1's cost×signal principle if left only as tribal knowledge | Plan (user chose) |
| §2 risk map | No changes | Existing e2e specs cover R2, already tracked — no new risk surfaced | Plan |

## Scope

**In scope:** `context/foundation/test-plan.md` §4, §5, §6 (new §6.7), §7, §8.

**Out of scope:** §1–§3 (unchanged), any code/CI/test file changes, new e2e specs, roadmap's newly-parked OAuth item (no test surface — unimplemented).

## Architecture / Approach

Pure documentation edit, four small independent section updates in one file, done in sequence for reviewability.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. §4 Stack + §5 Gates | Correct e2e tool/version/gate status | Low — factual table edit |
| 2. §7 reframe | Cost×signal justification replaces stale "no tool" excuse | Low — must not accidentally invite unbounded e2e growth |
| 3. §6.7 cookbook | Pattern + decision rule for future e2e specs | Low — must match existing §6.3/§6.4 style |
| 4. §8 freshness ledger | Records this refresh's scope honestly | Low — must not overclaim full-strategy review |

**Prerequisites:** none — file is available, no external dependencies.
**Estimated effort:** single short session, one file, no code.

## Open Risks & Assumptions

- Assumes `@playwright/test` version should be read from `package.json` at implementation time rather than hardcoded here.
- Assumes the 3 existing specs remain the canonical reference examples (no new specs are planned as part of this change).

## Success Criteria (Summary)

- `test-plan.md` no longer contradicts the actual CI/test state.
- A future contributor reading §6.7 can copy a working e2e spec without reverse-engineering the existing 3 files.
- §7's exclusion of full e2e coverage is justified by cost×signal, not by a tooling gap that no longer exists.
