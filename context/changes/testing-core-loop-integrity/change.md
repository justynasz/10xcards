---
id: testing-core-loop-integrity
title: "Phase 1: Core-loop integrity tests"
status: implemented
created: 2026-06-19
updated: 2026-06-19
risks: [R1, R2, R3]
phase: 1
---

# Change: testing-core-loop-integrity

Prove that FSRS does not corrupt the schedule, batch-save does not silently swallow errors, and AI errors reach the UI.

## Goals

- R1: Date-range assertions on `due_date` per Rating from New state (integration, real ts-fsrs)
- R2: Batch-create error path → UI error state, no silent success (unit)
- R3: Malformed AI output → descriptive API error + UI Retry path (unit)

## Artifacts

- `research.md` — oracle grounding per risk (this change)
- `plan.md` — ordered implementation phases (TBD)
