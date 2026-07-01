---
change_id: test-plan-refresh-2026-07-01
title: Reconcile test-plan.md with Playwright e2e added outside the rollout process
status: archived
created: 2026-07-01
updated: 2026-07-01
archived_at: 2026-07-01T14:22:02Z
---

## Notes

Trigger: Playwright/e2e was wired into CI (commits `381d9c9`, `f7cf898`, `9f7801f`, `8f40a2d`) outside `/10x-test-plan`. `context/foundation/test-plan.md` §4 and §7 still assert "no e2e framework" / "not required" — now factually wrong.

Facts on disk:
- `playwright.config.ts` exists (chromium project, `storageState` via `tests/auth.setup.ts`).
- `tests/` has 3 specs: `auth.setup.ts`, `seed.spec.ts` (generate happy path), `batch-save-error.spec.ts` (R2 at e2e layer).
- CI has a new `e2e` job (`.github/workflows/ci.yml`) that **blocks `deploy`** (`needs: [ci, e2e]`) — now a required gate, not optional.
- Hot-spot scan (last 30d) confirms `tests/`, `.github/workflows/ci.yml`, `playwright.config.ts` are actively churned.

Refresh scope (no new risks — R2 already tracked in §2):
1. §4 Stack — update e2e row from "none" to installed Playwright, `checked:` date.
2. §5 Quality Gates — e2e row from "not planned" to "required" (blocks deploy).
3. §7 What We Deliberately Don't Test — reframe from "no framework installed" to "framework exists; full e2e coverage of every UI flow still not justified by cost×signal — targeted, not exhaustive."
4. §6 Cookbook — add a new pattern subsection for adding a Playwright spec (storageState auth pattern, `page.route` mocking, Polish-locator convention already used in `seed.spec.ts` / `batch-save-error.spec.ts`).

Out of scope: the newly-parked OAuth item (roadmap) has no test surface — unimplemented, no test-plan changes needed.
