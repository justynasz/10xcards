---
id: sr-review-session
title: "Sesja powtarzania SR (SM-2)"
status: implemented
roadmap_id: S-02
created: 2026-06-17
updated: 2026-06-17
---

# S-02: Sesja powtarzania SR

## Outcome

User can rozpocząć sesję powtarzania spaced repetition; dla każdej karty ocenić recall (skala 0–5); app wylicza następną datę powtórki algorytmem SM-2 i zapisuje do Supabase.

## PRD refs

FR-009, FR-010

## Decyzja techniczna

**Algorytm:** FSRS via `ts-fsrs` v5.4.1 (nie SM-2)
- Zero runtime deps, ESM+CJS+UMD, czysta matematyka → kompatybilne z Cloudflare Workers
- `engines.node >= 20` dotyczy budowania, nie runtime

**Implikacja:** schemat DB z F-01 ma pola SM-2 (`easiness_factor`, `interval_days`,
`repetitions`, `due_date`). S-02 wymaga migracji Supabase — zamiana na pola FSRS:
`stability`, `difficulty`, `state`, `elapsed_days`, `scheduled_days`, `reps`, `lapses`.

## Prerequisites

S-01 (ai-generate-and-review) — done
Migracja schematu DB (jako część S-02)
