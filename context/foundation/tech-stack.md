---
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
---

## Why this stack

A solo developer shipping a 3-week after-hours web-app in TypeScript with auth
and AI card generation as the two primary feature flags. The 10x-astro-starter
is the recommended default for (web-app, js) and clears all four agent-friendly
quality gates: typed (TypeScript end-to-end with Zod at boundaries),
convention-based (file-based Astro routing + island architecture),
popular-in-training (Astro + React + Supabase are well-represented in training
data), and well-documented (all three components have current versioned docs).
Supabase covers auth + database out of the box, Cloudflare Pages is the starter's
native deploy target and suits edge-streaming AI responses. The AI card-generation
feature (FR-003/FR-004) is an npm package addition — no starter change required.
GitHub Actions with auto-deploy on merge is the straightforward CI default for a
solo project at this scale.
