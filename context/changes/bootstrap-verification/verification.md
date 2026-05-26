---
bootstrapped_at: 2026-05-25T00:00:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: 10xcards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10xcards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack:** A solo developer shipping a 3-week after-hours web-app in TypeScript with auth and AI card generation as the two primary feature flags. The 10x-astro-starter is the recommended default for (web-app, js) and clears all four agent-friendly quality gates: typed (TypeScript end-to-end with Zod at boundaries), convention-based (file-based Astro routing + island architecture), popular-in-training (Astro + React + Supabase are well-represented in training data), and well-documented (all three components have current versioned docs). Supabase covers auth + database out of the box, Cloudflare Pages is the starter's native deploy target and suits edge-streaming AI responses. The AI card-generation feature (FR-003/FR-004) is an npm package addition — no starter change required. GitHub Actions with auto-deploy on merge is the straightforward CI default for a solo project at this scale.

## Pre-scaffold verification

| Signal      | Value                                          | Severity | Notes                              |
| ----------- | ---------------------------------------------- | -------- | ---------------------------------- |
| npm package | not run                                        | n/a      | git-clone strategy; no npm CLI     |
| GitHub repo | przeprogramowani/10x-astro-starter pushed 2026-05-17 | fresh | from card.docs_url            |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 20
**Conflicts (.scaffold siblings)**: CLAUDE.md → CLAUDE.md.scaffold
**.gitignore handling**: moved silently (not present in cwd prior)
**.bootstrap-scaffold cleanup**: deleted

Note: upstream `.git/` was stripped before move-up (expected behavior for git-clone strategy).

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: HIGH finding is in `devalue` (direct advisory)

#### HIGH findings

- **devalue** (versions 5.6.3 – 5.8.0) — advisory in devalue itself. Check `npm audit` output for fix version and update when available.

#### MODERATE findings

9 moderate findings — see `npm audit` for the full list. None require immediate attention for a fresh scaffold; address per your project's risk tolerance before first production deploy.

## Hints recorded but not acted on

| Hint                    | Value              |
| ----------------------- | ------------------ |
| bootstrapper_confidence | first-class        |
| quality_override        | false              |
| path_taken              | standard           |
| self_check_answers      | null               |
| team_size               | solo               |
| deployment_target       | cloudflare-pages   |
| ci_provider             | github-actions     |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true               |
| has_payments            | false              |
| has_realtime            | false              |
| has_ai                  | true               |
| has_background_jobs     | false              |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` — the starter shipped its own CLAUDE.md; compare it with your existing `CLAUDE.md` and merge what's useful.
- Address the HIGH finding in `devalue` when a fix version is available (`npm audit fix`).
- Address remaining MODERATE findings per your project's risk tolerance before first production deploy.
