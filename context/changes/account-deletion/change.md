---
id: account-deletion
title: "Account deletion"
status: impl_reviewed
roadmap_id: null
created: 2026-06-18
updated: 2026-07-01
---

# Account deletion

## Outcome

A signed-in user can permanently delete their own account from a new `/account` page by
re-entering their password. Deletion removes the Supabase Auth user via the admin API and
cascades to remove all their flashcards (existing `ON DELETE CASCADE` FK). The user is signed
out and redirected with a confirmation message; their email becomes available for re-registration.

## PRD refs

Not on the roadmap (`context/foundation/roadmap.md`) — standalone addition outside the F-01/S-01/S-02/S-03
slice sequence. No FR/PRD reference; this is account self-service, not part of the MVP learning loop.

## Decyzja techniczna

**Deletion type:** immediate hard delete via `supabase.auth.admin.deleteUser()` — no soft-delete /
grace period. Requires a new server-only secret `SUPABASE_SERVICE_ROLE_KEY` (not previously
configured anywhere in this repo).

**Confirmation UX:** re-enter current password (re-verified server-side via `signInWithPassword`)
before deletion — not a "type DELETE" or plain confirm dialog.

## Prerequisites

F-01 (flashcards table + `ON DELETE CASCADE` on `user_id`) — done.
