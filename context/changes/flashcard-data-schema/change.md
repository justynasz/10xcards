---
change_id: flashcard-data-schema
roadmap_id: F-01
title: "Flashcard data schema + SM-2 fields"
status: implementing
created: 2026-05-27
updated: 2026-06-15
prd_refs:
  - "NFR (data isolation)"
  - FR-001
  - FR-009
  - FR-010
roadmap_ref: "context/foundation/roadmap.md#F-01"
---

## Summary

Uzupełnienie istniejącej migracji Supabase o pola SM-2 (easiness_factor,
interval_days, repetitions, due_date) oraz naprawienie buga user_id przez
dodanie DEFAULT auth.uid(). Rozszerzenie TypeScript modułu flashcards o
nowe typy i funkcje serwisowe potrzebne przez S-02 (sesja SR).

## Scope

- Modyfikacja `supabase/migrations/20260525000000_create_flashcards.sql`
- Modyfikacja `src/lib/flashcards/types.ts`
- Modyfikacja `src/lib/flashcards/index.ts`
- Modyfikacja `src/lib/flashcards/__tests__/flashcards.test.ts`

## Out of Scope

- Implementacja algorytmu SM-2 (należy do S-02: sr-review-session)
- API routes dla flashcards (należy do S-03: manual-card-management)
- UI (downstream S-01, S-02, S-03)
