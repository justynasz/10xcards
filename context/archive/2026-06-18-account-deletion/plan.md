# Account Deletion Implementation Plan

## Overview

Add self-service account deletion to 10xCards. A signed-in user navigates to a new `/account`
page, re-enters their password, and permanently deletes their account. Deletion goes through
Supabase's admin API (`auth.admin.deleteUser`), which requires a new server-only secret. The
existing `ON DELETE CASCADE` foreign key on `flashcards.user_id` removes all of the user's
flashcards automatically — no manual data cleanup is needed.

This feature is not part of the project roadmap (`context/foundation/roadmap.md`) — it's a
standalone addition outside the F-01/S-01/S-02/S-03 sequence.

## Current State Analysis

- **Auth scaffold** (`src/pages/api/auth/{signin,signup,signout}.ts`) is a thin, consistent
  pattern: parse `FormData` → `createClient()` (public anon-key client) → call one
  `supabase.auth.*` method → redirect, with `?error=<message>` on failure. None of these three
  routes validate input with Zod.
- **Newer API routes** (`src/pages/api/flashcards/{generate,review,batch-create}.ts`) do follow
  CLAUDE.md's "validate input with Zod" convention — this plan follows that newer convention, not
  the un-validated auth scaffold.
- **`src/lib/supabase.ts`** exports one `createClient(requestHeaders, cookies)` factory using
  `@supabase/ssr`'s `createServerClient` with the public `SUPABASE_KEY`. It returns `null` if
  `SUPABASE_URL`/`SUPABASE_KEY` are missing. There is no admin/service-role client anywhere in the
  codebase.
- **`src/middleware.ts`** resolves `context.locals.user` via `supabase.auth.getUser()` and
  redirects unauthenticated requests away from `PROTECTED_ROUTES = ["/dashboard", "/generate",
  "/review"]`. API routes are not covered by this list — they must guard themselves.
- **Database**: `supabase/migrations/20260525000000_create_flashcards.sql:3` —
  `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`. This
  is the only application table referencing `auth.users`. Deleting the auth user already cascades
  correctly with no plan changes needed here.
- **Env/config**: `astro.config.mjs` declares `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`
  as optional server secrets via `astro:env/server`. `src/lib/config-status.ts` derives
  `missingConfigs` from these, rendered as banners in `src/layouts/Layout.astro:22-37`. There is no
  `SUPABASE_SERVICE_ROLE_KEY` anywhere (not in `astro.config.mjs`, `.env.example`, or CI/deploy
  docs) — `auth.admin.deleteUser()` requires it and cannot work with the public key.
- **No account/settings page exists.** `src/pages/dashboard.astro` is the only authenticated
  landing page (email display + "Generate flashcards" link + sign-out form).
- **Reusable auth UI components** already exist and need no changes: `FormField.tsx`,
  `PasswordToggle.tsx`, `SubmitButton.tsx` (uses `useFormStatus()` for pending state), and
  `ServerError.tsx` (renders a `serverError` string prop). `SignInForm.tsx` shows the composition
  pattern: client-side `validate()` + `<form method="POST" action="/api/...">` + these four
  components.
- **Module convention** (CLAUDE.md): every module under `src/lib/` has `index.ts`, `types.ts`,
  `__tests__/`. `src/lib/flashcards/` is the reference implementation, including its
  `__tests__/flashcards.test.ts` pattern of building a chainable mock Supabase client with `vi.fn()`.

## Desired End State

A signed-in user can:
1. Open `/account` (linked from the dashboard) and see a "Danger zone" with a password field and
   a delete button.
2. Submit their password and have their account permanently removed: the Supabase Auth user is
   deleted, their flashcards are gone (cascade), their session is cleared, and they land on
   `/auth/signin?deleted=1` with a confirmation message.
3. Re-register with the same email afterward and succeed, proving the deletion was real (not a
   soft-ban or session-only logout).
4. If the password is wrong, or the service-role secret is missing, or the Supabase call fails,
   they see an inline error on `/account` and their account is untouched — they can retry.

**Verification**: see Phase 4 manual checklist (sign-out + cascade check + re-registration check,
per the confirmed verification depth).

### Key Discoveries:

- `supabase/migrations/20260525000000_create_flashcards.sql:3` — cascade already in place, zero
  migration work needed for data cleanup.
- `src/lib/config-status.ts:11-26` — banner pattern to extend for the new secret.
- `src/components/auth/SignInForm.tsx:42-86` — exact composition pattern to follow for the new
  `DeleteAccountForm`.
- `src/pages/api/flashcards/batch-create.ts:6-11` — Zod `safeParse` pattern to follow for the new
  route (adapted for `FormData` instead of JSON body).
- `src/lib/flashcards/__tests__/flashcards.test.ts:32-45` — chainable mock-client pattern to reuse
  for testing the admin client.

## What We're NOT Doing

- No soft delete, grace period, or account reactivation flow.
- No deletion confirmation email or any other email-sending integration (none exists in this repo).
- No audit log / `account_deletions` table — relying on Supabase's own auth logs, matching the
  project's roadmap-level decision to defer observability.
- No changes to the `flashcards` schema or RLS policies — the existing cascade already does the
  right thing.
- No rate limiting or CAPTCHA on the deletion endpoint — single self-service action, not a public
  unauthenticated endpoint.
- No admin-initiated deletion (deleting other users) — self-service only, scoped to
  `context.locals.user.id`.

## Implementation Approach

Add a server-only admin Supabase client (service-role key) alongside the existing public client,
following the same null-on-missing-config pattern. Extract the deletion call into a small
`src/lib/account/` module so it's unit-testable with a mocked admin client, mirroring
`src/lib/flashcards/`. Wire a new Zod-validated API route that re-verifies the user's password
before calling that module, then build the `/account` page and form by composing existing auth UI
components — no new design system work needed.

## Critical Implementation Details

**Security & ordering**: the delete endpoint must always operate on `context.locals.user.id` —
never accept or trust a user id from the request body — since this is a destructive,
irreversible action (IDOR would let one user delete another's account). Order of operations
matters: (1) re-verify the password via `signInWithPassword` while the account still exists, (2)
call `admin.deleteUser()`, (3) call the session client's `signOut()` to clear local cookies,
ignoring any error it returns — by this point the underlying user is already gone, so `signOut()`'s
revoke call may itself fail server-side, but it still clears the local session cookies, matching
the existing no-error-check pattern in `signout.ts`.

---

## Phase 1: Service-role admin client & config plumbing

### Overview

Introduce the new secret and a server-only admin client, and surface its configuration state in
the existing missing-config banner.

### Changes Required:

#### 1. Env schema

**File**: `astro.config.mjs`

**Intent**: Declare the new secret so it's available via `astro:env/server`, following the exact
shape of the existing `SUPABASE_URL`/`SUPABASE_KEY`/`OPENROUTER_API_KEY` fields.

**Contract**: Add `SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true })` to the `env.schema` object.

#### 2. Admin client factory

**File**: `src/lib/supabase.ts`

**Intent**: Add a second factory for a service-role client used only by server-side admin
operations (deleting a user). It needs no cookie/session plumbing since it doesn't act on behalf
of a browser session.

**Contract**: Export `createAdminClient()` (no arguments) that returns `null` if
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are missing, otherwise returns a client built with
`@supabase/supabase-js`'s plain `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (not the
`@supabase/ssr` cookie-aware variant). Import `SUPABASE_SERVICE_ROLE_KEY` from
`astro:env/server` alongside the existing imports.

#### 3. Missing-config banner

**File**: `src/lib/config-status.ts`

**Intent**: Surface to operators when account deletion is disabled due to the missing secret,
same as the existing Supabase/OpenRouter entries.

**Contract**: Import `SUPABASE_SERVICE_ROLE_KEY` and append one more `ConfigStatus` entry to
`configStatuses` — `name: "Account deletion"`, `configured: Boolean(SUPABASE_SERVICE_ROLE_KEY)`,
with a message in the same Polish style as the existing entries (e.g. "Usuwanie konta nie jest
skonfigurowane — funkcja jest wyłączona."). No `docsUrl` needed.

#### 4. Local dev env template

**File**: `.env.example`

**Intent**: Document the new var for local setup, matching the existing two-line format.

**Contract**: Add `SUPABASE_SERVICE_ROLE_KEY=###` as a new line.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (Astro's `env` schema is type-checked at build time)
- Linting passes: `npm run lint`

#### Manual Verification:

- With `SUPABASE_SERVICE_ROLE_KEY` unset in `.dev.vars`, the missing-config banner shows the new
  "Account deletion" message on any page.
- With the key set, the banner for "Account deletion" disappears while the other two banners
  behave unchanged.

---

## Phase 2: Account deletion module (`src/lib/account/`)

### Overview

A small, independently testable module that wraps the admin `deleteUser` call, following the
repo's `index.ts` / `types.ts` / `__tests__/` module convention.

### Changes Required:

#### 1. Module types

**File**: `src/lib/account/types.ts`

**Intent**: Define the minimal shape the module needs from a Supabase admin client, so the
function can be typed without importing the full `SupabaseClient` generic surface and so tests
can pass a lightweight mock.

**Contract**: Export an `AdminClient` type with the single member the module calls:
`auth: { admin: { deleteUser(id: string): Promise<{ error: { message: string } | null }> } }`.

#### 2. Deletion logic

**File**: `src/lib/account/index.ts`

**Intent**: Perform the actual account deletion and translate a Supabase error into a thrown
`Error`, matching the throw-on-error convention already used in `src/lib/flashcards/index.ts`.

**Contract**: Export `async function deleteAccount(adminClient: AdminClient, userId: string): Promise<void>` that calls `adminClient.auth.admin.deleteUser(userId)` and throws
`new Error(error.message)` if the call returns an error.

#### 3. Unit tests

**File**: `src/lib/account/__tests__/account.test.ts`

**Intent**: Verify both the success path and the error-translation path without hitting real
Supabase, following the mock-client pattern in `src/lib/flashcards/__tests__/flashcards.test.ts`.

**Contract**: Two `it()` cases — (a) resolves without throwing when `deleteUser` resolves with
`{ error: null }`, asserting `deleteUser` was called with the given `userId`; (b) rejects with the
underlying message when `deleteUser` resolves with `{ error: { message: "..." } }`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- None — this phase has no user-facing surface yet.

---

## Phase 3: API route — `POST /api/auth/delete-account`

### Overview

The endpoint that ties together password re-verification, the admin client, and the deletion
module, following the existing auth-route response shape (redirect with `?error=` / success
redirect) rather than the JSON-response shape used by the flashcards API routes, since this is
invoked from an HTML form like `signin`/`signup`, not `fetch`.

### Changes Required:

#### 1. Delete-account route

**File**: `src/pages/api/auth/delete-account.ts`

**Intent**: Validate the submitted password, confirm it against the current session's user via a
real sign-in check, delete the account through the admin client, clear the local session, and
redirect with the appropriate query param. The handler must guard against unauthenticated access
itself, since this path is not in `middleware.ts`'s `PROTECTED_ROUTES`.

**Contract**:
- `export const POST: APIRoute = async (context) => { ... }`, `export const prerender = false`.
- Zod schema: `z.object({ password: z.string().min(1) })`, parsed from `await context.request.formData()` the same way `signin.ts` extracts `email`/`password` (`form.get("password") as string`), then `safeParse`'d.
- If `!context.locals.user`, redirect to `/auth/signin`.
- If the Zod parse fails, redirect to `/account?error=<message>`.
- Build the session client via `createClient(context.request.headers, context.cookies)`; if `null`, redirect to `/account?error=Supabase is not configured`.
- Re-verify via `supabase.auth.signInWithPassword({ email: context.locals.user.email, password })`; on error, redirect to `/account?error=<error.message>` (covers "wrong password" as the natural error path — no separate wrong-password branch needed).
- Build the admin client via `createAdminClient()` from `@/lib/supabase`; if `null`, redirect to `/account?error=Account deletion is not configured`.
- Call `deleteAccount(adminClient, context.locals.user.id)` from `@/lib/account`; on thrown error, redirect to `/account?error=<message>` — account is left intact since `deleteUser` failed.
- On success, `await supabase.auth.signOut()` (no error check, matching `signout.ts:7`), then redirect to `/auth/signin?deleted=1`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Submitting with the wrong password leaves the account intact and shows an inline error on `/account`.
- Submitting with the correct password deletes the account and redirects to `/auth/signin?deleted=1`.
- Calling the route while signed out redirects to `/auth/signin` without error.

---

## Phase 4: UI — `/account` page, delete form, dashboard link, deleted-message

### Overview

Build the user-facing surface: a protected `/account` page with a password-confirmed delete
form, a link to it from the dashboard, and a success message on the sign-in page after deletion.

### Changes Required:

#### 1. Protected route registration

**File**: `src/middleware.ts`

**Intent**: Protect the new page the same way `/dashboard`, `/generate`, and `/review` are protected.

**Contract**: Add `"/account"` to the `PROTECTED_ROUTES` array.

#### 2. Delete account form component

**File**: `src/components/auth/DeleteAccountForm.tsx`

**Intent**: Password-confirmation form for account deletion, composed entirely from existing
components, following `SignInForm.tsx`'s structure (local `password` state, client-side
non-empty validation, `serverError` prop rendered via `ServerError`).

**Contract**: `export default function DeleteAccountForm({ serverError }: { serverError?: string | null })` rendering `<form method="POST" action="/api/auth/delete-account">` with one `FormField` (password, with `PasswordToggle`), a `ServerError`, and a `SubmitButton` labeled "Delete my account" / pending text "Deleting...". Client-side `validate()` blocks submit only when the password field is empty (the server is the source of truth for whether the password is correct).

#### 3. Account page

**File**: `src/pages/account.astro`

**Intent**: Authenticated page showing the user's email and the danger-zone delete form, following `dashboard.astro`'s layout structure (same `Layout` wrapper, same card styling) and `signin.astro`'s pattern of reading `?error=` from `Astro.url.searchParams` and passing it to the form as `serverError`.

**Contract**: Reads `Astro.locals.user` and `Astro.url.searchParams.get("error")`; renders `<DeleteAccountForm serverError={error} client:load />` inside a "Danger zone" section, plus a link back to `/dashboard`.

#### 4. Dashboard link

**File**: `src/pages/dashboard.astro`

**Intent**: Give users a way to discover the new page.

**Contract**: Add one more link/button next to "Generate flashcards" pointing to `/account` (e.g. "Account settings"), same styling as the existing link.

#### 5. Post-deletion confirmation message

**File**: `src/pages/auth/signin.astro`

**Intent**: Show a one-time confirmation when arriving via the post-deletion redirect, using the same query-param-driven pattern already used for `error`.

**Contract**: Read `Astro.url.searchParams.get("deleted")`; when truthy, render a success message above (or instead of) the sign-in form — e.g. reuse the `ServerError`-style banner pattern but with a neutral/success tone, or a plain `<p>` styled consistently with the existing card. Exact visual treatment is an implementation call; the only requirement is the message is visible and distinct from the error state.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Sign in, visit `/dashboard`, click through to `/account`, see email + danger zone.
- Submit the wrong password: inline error shown on `/account`, account still exists, can sign in again normally.
- Submit the correct password: redirected to `/auth/signin?deleted=1` with a visible confirmation message; signed out.
- In the Supabase dashboard (or via SQL), confirm the user's `flashcards` rows are gone (cascade check).
- Re-register with the same email used before deletion and confirm signup succeeds (proves the `auth.users` row was truly removed, not soft-banned).
- Visiting `/account` while signed out redirects to `/auth/signin`.

---

## Testing Strategy

### Unit Tests:

- `src/lib/account/__tests__/account.test.ts`: success path (resolves, calls `deleteUser` with the right id) and error path (Supabase error message surfaces as a thrown `Error`).

### Integration Tests:

- None added — no integration test infrastructure exists in this repo for hitting a real Supabase
  project (see "What We're NOT Doing").

### Manual Testing Steps:

1. Configure `SUPABASE_SERVICE_ROLE_KEY` in `.dev.vars` and confirm the "Account deletion" banner disappears.
2. Sign up a throwaway test account; sign in.
3. Visit `/account` via the dashboard link.
4. Attempt deletion with an incorrect password — verify inline error, account intact.
5. Attempt deletion with the correct password — verify redirect to `/auth/signin?deleted=1`, confirmation message visible, signed out.
6. Verify the test account's flashcards (create one beforehand) are gone from the `flashcards` table.
7. Re-register with the same email — verify signup succeeds.
8. Visit `/account` directly while signed out — verify redirect to `/auth/signin`.

## Performance Considerations

None — single-user, low-frequency, server-side admin API call. No caching or batching concerns.

## Migration Notes

No database migration needed — the existing `ON DELETE CASCADE` on `flashcards.user_id` (from
`20260525000000_create_flashcards.sql`) already handles cleanup. Deploying this feature requires
setting the new secret in production: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`,
matching the existing `SUPABASE_URL`/`SUPABASE_KEY` deploy step in `CLAUDE.md`'s Deploy section.
The CI build (`.github/workflows/ci.yml`) does not need a new secret since the env field is
optional and the build doesn't exercise the deletion path.

## References

- Related research: none (`context/changes/account-deletion/research.md` not created — this plan
  was scoped directly from codebase exploration during planning).
- Cascade FK: `supabase/migrations/20260525000000_create_flashcards.sql:3`
- Existing auth route pattern: `src/pages/api/auth/signin.ts`
- Existing Zod-validated route pattern: `src/pages/api/flashcards/batch-create.ts:6-33`
- Existing form composition pattern: `src/components/auth/SignInForm.tsx`
- Module convention reference: `src/lib/flashcards/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Service-role admin client & config plumbing

#### Automated

- [x] 1.1 Type checking passes: `npm run build` — d368574
- [x] 1.2 Linting passes: `npm run lint` — d368574

#### Manual

- [x] 1.3 Missing-config banner shows "Account deletion" message when secret unset — d368574
- [x] 1.4 Banner disappears when secret is set, other banners unaffected — d368574

### Phase 2: Account deletion module (`src/lib/account/`)

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 549192e
- [x] 2.2 Type checking passes: `npm run build` — 549192e
- [x] 2.3 Linting passes: `npm run lint` — 549192e

### Phase 3: API route — `POST /api/auth/delete-account`

#### Automated

- [x] 3.1 Type checking passes: `npm run build` — 69c0039
- [x] 3.2 Linting passes: `npm run lint` — 69c0039

#### Manual

- [x] 3.3 Wrong password leaves account intact, shows inline error — 9a55dcd
- [x] 3.4 Correct password deletes account, redirects to `/auth/signin?deleted=1` — 9a55dcd
- [x] 3.5 Signed-out request redirects to `/auth/signin` without error — 9a55dcd

### Phase 4: UI — `/account` page, delete form, dashboard link, deleted-message

#### Automated

- [x] 4.1 Type checking passes: `npm run build` — 9a55dcd
- [x] 4.2 Linting passes: `npm run lint` — 9a55dcd

#### Manual

- [x] 4.3 Dashboard → `/account` navigation shows email + danger zone — 9a55dcd
- [x] 4.4 Wrong password: inline error, account still usable — 9a55dcd
- [x] 4.5 Correct password: redirect + confirmation message + signed out — 9a55dcd
- [x] 4.6 Flashcards rows confirmed gone (cascade check) — 9a55dcd
- [x] 4.7 Re-registration with same email succeeds — 9a55dcd
- [x] 4.8 Signed-out `/account` visit redirects to `/auth/signin` — 9a55dcd
