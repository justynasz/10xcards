---
project: 10xCards
researched_at: 2026-05-26
recommended_platform: Cloudflare Workers + Pages
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 SSR
  runtime: Cloudflare Workers (workerd)
  database: Supabase (external)
  ai: OpenRouter (external)
---

## Recommendation

**Deploy on Cloudflare Workers + Pages.**

The project already ships `@astrojs/cloudflare`, `wrangler v4`, and `.dev.vars` — zero adapter migration cost, which is the decisive advantage over every other platform. Cloudflare scored 10/10 on agent-friendly criteria (only platform with all five Pass), the free tier covers 10k–100k monthly requests at zero cost, and the `wrangler` CLI plus 17 official MCP servers make the full operational loop scriptable without a browser. The user's existing Cloudflare familiarity (Q3) breaks the tie against Vercel.

## Platform Comparison

### Scoring Matrix

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP/Integration | **Total** |
|---|---|---|---|---|---|---|
| **Cloudflare Workers/Pages** | Pass | Pass | Pass | Pass | Pass | **10** |
| **Vercel** | Pass | Pass | Pass | Pass | Partial | **9** |
| **Netlify** | Partial | Pass | Pass | Pass | Pass | **9** |
| **Railway** | Pass | Pass | Partial | Pass | Partial | **8** |
| **Fly.io** | Pass | Partial | Partial | Pass | Partial | **7** |
| **Render** | Partial | Partial | Pass | Partial | Pass | **7** |

Hard filters applied: none (no persistent connections required; external Supabase + OpenRouter — no co-location needed).
Interview weights applied: Cloudflare familiarity +1 tiebreaker (already leading); single-region preference — neutral; cost ≈ DX — no adjustment.

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (Recommended)

Zero migration cost: `@astrojs/cloudflare`, `wrangler v4`, and `wrangler.toml` are already in the project. The only mandatory config gate is the `nodejs_compat` compatibility flag in `wrangler.toml` — without it, Astro SSR runtime throws at request time. The `astro:env/server` env schema already used in this codebase is native to this adapter. Free tier: 100k req/day (~3M/month) at $0; paid plan $5/month covers 10M req/month. Agent docs are best-in-class: `llms.txt` at multiple granularities plus per-page Markdown. 17 official MCP servers (builds, observability, docs, Workers API) — MCP Portals layer in open beta as of August 2025.

#### 2. Vercel

Runner-up primarily because of the best-in-class agent documentation (`llms-full.txt` — entire corpus in one fetch) and a clean `vercel rollback` CLI command. However, switching from Cloudflare would require replacing `@astrojs/cloudflare` with `@astrojs/vercel/serverless`, removing all `astro:env/server` imports (non-trivial: used in `src/lib/supabase.ts` and `src/middleware.ts`), and removing `wrangler.toml` + `.dev.vars`. Vercel MCP is Public Beta (August 2025, read-oriented, 13 tools). Function timeout on Hobby is 10s — OpenRouter AI calls approaching this limit would require a Pro upgrade ($20/seat/month).

#### 3. Netlify

Strongest MCP offering (GA since June 2025, 43 tools, full write access) and confirmed "Astro 6 just works" (March 2026 changelog). Key gap: no `netlify rollback` CLI command — rollback requires UI "Publish Deploy" click or knowing the deploy ID. New credit-based pricing (September 2025) makes the free tier a hard-pause risk in production; Pro ($20/month) is the safe baseline. Cold starts of 800ms–1.5s on standard functions are the highest of any serverless platform in the shortlist.

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate — Weaknesses

1. **`astro:env/server` is Cloudflare-specific lock-in.** The entire codebase already uses this import pattern. Future platform migration would require touching every file that imports env vars — an invisible technical debt that grows as the codebase grows.

2. **workerd ≠ Node.js — transitive deps crash silently at prod.** Libraries using `fs`, `Buffer`, or `crypto` outside the `nodejs_compat` polyfill surface fail only on Cloudflare, not during local `astro dev` (which runs Node.js). Every new dependency added to the AI SDK path is a potential silent failure point.

3. **1 MB compressed script bundle limit is a hard stop.** As AI SDK, Zod, and SR algorithm libraries accumulate, the bundle may exceed the Workers size limit. Unlike Vercel/Netlify (where function size limits are higher), exceeding the Workers limit aborts deployment entirely — not a graceful degradation.

4. **CPU-time limit per invocation (10ms free / 30ms paid) is distinct from wall-clock time.** Post-inference processing — parsing OpenRouter responses, writing SR schedule to Supabase — counts against CPU time. Complex SR queries could hit the ceiling even if wall-clock time is acceptable.

5. **`wrangler dev` vs `astro dev` divergence.** `npm run dev` runs `astro dev` (Node.js, not workerd). For full runtime parity with production, `wrangler dev` is required. This discrepancy is the most common source of "works locally, fails in prod" bugs on Cloudflare.

### Pre-Mortem — How This Could Fail

The team deployed 10xCards on Cloudflare Workers. Six months later, the AI card generation endpoint became the source of every production incident.

The root cause: an OpenRouter SDK update brought a transitive dependency using `crypto.getRandomValues` in a way the `nodejs_compat` flag didn't cover. The generation endpoint started returning 500 errors for ~30% of requests. Cloudflare's log tail gave a generic "Worker threw exception" — no useful stack trace. Locally, `astro dev` ran on Node.js, so the bug was invisible in development. Two weeks of debugging an issue that would have been a 2-hour fix on a standard Node.js platform.

In parallel: as the SR algorithm grew more complex, scheduling queries started exceeding the CPU-time limit per invocation. Review sessions completed without saving scores — users lost review data, exactly the "unrecoverable failure" the PRD identified as a guardrail violation. The team eventually migrated to Vercel (3 days of adapter-swap work), but the reputation damage from lost review data was already done.

### Unknown Unknowns

1. **The hybrid prerender bug (#15237) will surface when adding a landing page.** Today `output: "server"` bypasses the known Astro 6 + Cloudflare hybrid SSR bug. The first attempt to prerender a landing or marketing page will hit it. This is an architectural constraint invisible until you try.

2. **Free tier limit is per day, not per month — viral cliff.** 100k req/day resets daily. A Product Hunt feature or social media spike can exhaust the daily quota by noon; subsequent requests are rejected (not rate-limited, rejected). Paid plan ($5/month) eliminates this cliff.

3. **`wrangler dev` should replace `astro dev` for local dev parity.** CLAUDE.md documents `npm run dev = astro dev`. For workerd runtime parity, `wrangler dev` is the correct command. This discrepancy isn't documented in the starter and typically surfaces only when a workerd-specific bug appears in production.

4. **Cloudflare Pages vs Workers terminology confusion.** `tech-stack.md` says `cloudflare-pages` but the project uses Workers config (`wrangler.toml`, `wrangler deploy`). Pages Functions run on Workers, but deployment commands differ between modes. Mixing them inadvertently creates orphaned resources.

5. **AI streaming through workerd is undocumented for Astro 6 SSR.** Streaming HTTP responses via `ReadableStream` work in Workers, but the behavior when streaming OpenRouter SSE or chunked responses through Astro 6's SSR layer is not explicitly documented. This is a potential unknown until the AI generation feature is first deployed.

## Operational Story

- **Preview deploys**: `wrangler deploy --dry-run` validates the bundle locally. For actual preview URLs, Cloudflare Pages CI integration creates a preview deployment on every push to a non-production branch (requires connecting the GitHub repo in the Pages dashboard). Preview URLs are public by default — protect with Cloudflare Access if needed.
- **Secrets**: Environment variables go in Cloudflare Workers Secrets via `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. For local dev, they live in `.dev.vars` (gitignored). Secrets are encrypted at rest and not readable after creation — only the bound Worker can access them. Rotation: `wrangler secret put` overwrites the existing value; the new value takes effect on next deploy.
- **Rollback**: `wrangler rollback [VERSION_ID]` creates a new deployment pointing to a previous script version. Time-to-revert: ~30 seconds. Database migrations (Supabase) do not roll back automatically — maintain backward-compatible migrations and run schema changes as separate steps from code deploys.
- **Approval**: Deploying to production (`wrangler deploy`), rotating secrets (`wrangler secret put`), and deleting Workers/routes are agent-permitted operations with a scoped API token. Dropping Supabase tables, rotating the primary Supabase service key, or billing changes are human-only panel operations.
- **Logs**: `wrangler tail [WORKER] --format pretty` for live log tail. `--status error` to filter to failures only. `--search <text>` for keyword filtering. For structured output pipe with `--format json`. The Cloudflare observability MCP server (`observability.mcp.cloudflare.com/mcp`) provides structured log querying without shell output parsing.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Transitive dep uses Node.js API not covered by `nodejs_compat` | Pre-mortem | M | H | Run `wrangler dev` (not `astro dev`) for all development; add `wrangler dev` smoke test to CI before merging AI SDK dependencies |
| Bundle size exceeds 1 MB Workers limit after adding AI SDK | Devil's advocate | M | H | Monitor bundle size in CI (`wrangler deploy --dry-run` reports size); use dynamic `import()` for heavy deps; consider `wrangler deploy --minify` |
| CPU-time limit hit by SR scheduling queries | Devil's advocate | L | H | Profile Supabase query CPU cost with `wrangler tail` during load test; offload complex SR date calculations to Supabase RPC (runs in DB, not Worker) |
| Daily free-tier cliff on traffic spike | Unknown unknowns | L | M | Upgrade to Workers Paid ($5/month) before any public launch; set billing alert at 80% of daily quota |
| Hybrid prerender bug breaks future static pages | Unknown unknowns | H | M | Document: never set `prerender = true` on any page until issue #15237 is resolved; monitor the GitHub issue |
| `astro dev` vs `wrangler dev` divergence causes missed workerd bugs | Unknown unknowns | H | M | Update `npm run dev` to invoke `wrangler dev`; document in CLAUDE.md |
| AI streaming (OpenRouter SSE) untested through workerd | Unknown unknowns | M | M | Build a minimal streaming proof-of-concept before implementing full AI generation feature; test with `wrangler dev` |
| `astro:env/server` lock-in grows over time | Devil's advocate | H | L | Accept for MVP; document as known constraint in CLAUDE.md; keep env imports centralized in `src/lib/` modules |

## Getting Started

1. **Verify `nodejs_compat` flag is set** — open `wrangler.toml` (or `wrangler.jsonc`) and confirm `compatibility_flags = ["nodejs_compat"]` is present. Without it, the Astro SSR runtime will throw at request time.

2. **Set Cloudflare secrets for production:**
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```

3. **Deploy to production:**
   ```bash
   npm run build
   npx wrangler deploy
   ```

4. **Confirm deployed URL and tail live logs:**
   ```bash
   npx wrangler tail --format pretty
   ```

5. **Switch local dev to `wrangler dev` for workerd parity:**
   ```bash
   npx wrangler dev
   ```
   Update `npm run dev` in `package.json` to invoke `wrangler dev` instead of `astro dev` to eliminate the Node.js vs workerd divergence.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions wiring, branch deploy rules)
- Production-scale architecture (multi-region, HA, DR)
