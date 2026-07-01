# Account Deletion — Plan Brief

> Full plan: `context/changes/account-deletion/plan.md`

## What & Why

Add self-service account deletion to 10xCards. A signed-in user can permanently delete their own
account — and all their flashcards — from a new `/account` page, after re-entering their
password. This isn't on the project roadmap; it's a standalone addition.

## Starting Point

The auth scaffold (signin/signup/signout) is complete but has no account-management surface
beyond a bare dashboard. The `flashcards` table already has `ON DELETE CASCADE` on
`user_id → auth.users(id)`, so deleting the auth user already cleans up flashcard data with zero
schema changes. No service-role Supabase key exists anywhere in the repo today — and the admin
API that can actually remove an `auth.users` row requires one.

## Desired End State

A user opens `/account`, types their password, and clicks delete. Their account and flashcards
are gone, they're signed out, and they land on the sign-in page with a confirmation message. They
can immediately re-register with the same email. A wrong password, or a missing/misconfigured
service-role secret, leaves the account untouched with an inline error.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Entry point | New `/account` page | Separates an irreversible action from the routine dashboard | Plan |
| Confirmation UX | Re-enter password, re-verified server-side | Confirms the actual owner is present, not just an open session | Plan |
| Deletion type | Immediate hard delete | Matches project's speed goal; no cron infra exists for a grace period | Plan |
| Post-delete UX | Silent redirect + `?deleted=1` message | No email-sending infra exists anywhere in this repo | Plan |
| Failure handling | Inline error, account stays intact, retry | Matches existing signin/signup error-redirect pattern exactly | Plan |
| Verification depth | Sign-out + cascade check + re-registration check | Proves a true delete, not a soft-ban or session-only logout | Plan |
| Test coverage | Unit test with mocked admin client | Matches repo's `src/lib/<module>/__tests__` convention | Plan |
| Audit trail | None — rely on Supabase's own auth logs | Matches roadmap's explicit deferral of all observability | Plan |

## Scope

**In scope:**
- New `SUPABASE_SERVICE_ROLE_KEY` secret + admin Supabase client
- `src/lib/account/` module (deletion logic + unit tests)
- `POST /api/auth/delete-account` endpoint
- `/account` page + `DeleteAccountForm` + dashboard link + sign-in confirmation message

**Out of scope:**
- Soft delete / grace period / reactivation
- Deletion confirmation email
- Audit log table
- Rate limiting / CAPTCHA
- Admin-initiated (other-user) deletion

## Architecture / Approach

A second, server-only Supabase client (service-role key, no cookies) sits alongside the existing
public client. A thin `src/lib/account/` module wraps `admin.deleteUser()` so it's unit-testable.
The API route re-verifies the password via `signInWithPassword` before calling that module, then
clears the session. The UI is built entirely from existing form components (`FormField`,
`PasswordToggle`, `SubmitButton`, `ServerError`) — no new design system work.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Service-role plumbing | New secret, admin client factory, config banner entry | Secret must be added to Cloudflare deploy step or the feature silently stays disabled in prod |
| 2. Account deletion module | Testable `deleteAccount()` + unit tests | Low — small, isolated function |
| 3. API route | Password re-verification + deletion + sign-out + redirect | Must scope strictly to `context.locals.user.id` to avoid IDOR |
| 4. UI | `/account` page, delete form, dashboard link, deleted-message | Manual cascade/re-registration verification is easy to skip if rushed |

**Prerequisites:** F-01 (flashcards table + cascade FK) — done.
**Estimated effort:** ~1 session across 4 phases — small, well-bounded feature reusing existing patterns throughout.

## Open Risks & Assumptions

- Assumes `auth.admin.deleteUser()` is available and behaves as a true hard delete under the
  project's Supabase plan/version (`@supabase/supabase-js ^2.99.1` confirmed to support it).
- Deploying to production requires manually setting `SUPABASE_SERVICE_ROLE_KEY` via
  `wrangler secret put` — easy to forget since CI doesn't enforce it (the env field is optional).

## Success Criteria (Summary)

- A user can delete their own account and it's verifiably gone (auth user removed, flashcards
  cascade-deleted, email re-registrable).
- A wrong password or misconfigured secret never deletes anything and always shows a clear inline
  error.
- No other user's account can be deleted via this endpoint (always scoped to the caller's own id).
