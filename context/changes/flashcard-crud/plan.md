# Flashcard CRUD — Manual Create, Edit, Delete in List View

## Overview

Add manual single-card create, inline edit, and inline delete to the `/flashcards` list view.
This covers FR-005 (manual create), FR-007 (edit), FR-008 (delete).

The lib layer (`createFlashcard`, `updateFlashcard`, `deleteFlashcard`) already exists in
`src/lib/flashcards/index.ts`. What is missing: two API route files and a UI extension to
`FlashcardsListView.tsx`.

## Current State Analysis

- **`src/lib/flashcards/index.ts`** — all three lib functions are implemented and follow the
  throw-on-error convention: `createFlashcard`, `updateFlashcard`, `deleteFlashcard`.
- **`src/components/flashcards/FlashcardsListView.tsx`** — renders a read-only card list.
  Has 4 view states: `loading`, `list`, `empty`, `error`. Fetches from `/api/flashcards/list` on
  mount. Has no create/edit/delete functionality.
- **`src/pages/api/flashcards/`** — has `list.ts`, `batch-create.ts`, `generate.ts`, `review.ts`.
  No single-card create route, no update/delete routes.
- **`src/components/generate/CardReviewItem.tsx`** — contains the inline edit pattern: a local
  `editing` boolean state, two textarea fields, and Zapisz/Anuluj buttons. This is the pattern
  to reuse in the list view for Phase 2.
- **API route pattern**: auth guard → supabase guard → JSON body parse + Zod `safeParse` →
  lib call → `Response.json({ ... })`. See `src/pages/api/flashcards/batch-create.ts` and
  `src/pages/api/flashcards/review.ts`.
- **RLS**: flashcards table uses `auth.uid()` for ownership — Supabase client built from the
  user's session automatically scopes all operations to the authenticated user. No manual
  ownership check is needed in the route.
- **Tests**: `src/lib/flashcards/__tests__/flashcards.test.ts` has happy-path tests for
  `createFlashcard`, `updateFlashcard`, `deleteFlashcard` but no error-path cases for these
  three functions. Error tests exist for `listFlashcards`, `listDueFlashcards`,
  `batchCreateFlashcards`, `updateFlashcardSR`.

## Desired End State

A user signed in to `/flashcards` can:

1. **Create** — fill in a front and back field (always visible inline at the top), press "Dodaj
   fiszkę". The new card appears at the top of the list immediately (optimistic).
2. **Edit** — press "Edytuj" on any card; the card row switches to an inline form pre-filled with
   current values. After pressing "Zapisz" the card row updates in place (optimistic).
3. **Delete** — press "Usuń" on any card; a confirmation appears inline ("Na pewno?", "Tak",
   "Nie"). After pressing "Tak" the card disappears from the list (optimistic).
4. Errors from any operation are shown inline near the form/card that triggered them; the user
   can retry without losing context.

## What We're NOT Doing

- No modal dialogs for create or edit — strictly inline.
- No pagination — the existing list loads all user cards and this plan continues that pattern.
- No undo / soft-delete — destructive by design.
- No bulk delete — single-card at a time only (FR-008 scope).
- No new shadcn/ui components — compose from the existing `Button` and plain elements.
- No integration tests or E2E tests — unit tests for error paths are the only testing addition.

---

## Phase 1: API Routes — create, update, delete

### Overview

Add three new API operations. The create route lives at `POST /api/flashcards` (Astro's
`index.ts` in the existing directory). The update and delete routes share a single dynamic-param
file `[id].ts` exporting `PUT` and `DELETE`, following Astro's file-based routing for dynamic
segments.

### Changes Required

#### 1. POST /api/flashcards — single-card create

**File**: `src/pages/api/flashcards/index.ts` (new)

**Intent**: Accept a JSON body with `front` and `back`, validate with Zod, call `createFlashcard`,
return the new card.

**Contract**:
- `export const prerender = false`
- Auth guard: `!context.locals.user` → 401
- Supabase guard: `createClient(...)` returns null → 500
- Zod schema: `z.object({ front: z.string().min(1).max(500), back: z.string().min(1).max(500) })`
- Body parse failure → 400 `{ error: "Invalid JSON body" }`
- Zod parse failure → 400 `{ error: parsed.error.message }`
- Success → 201 `{ card: Flashcard }`
- Caught lib error → 500 `{ error: "Nie udało się dodać fiszki." }`
- Log prefix: `[flashcards create]`

#### 2. PUT + DELETE /api/flashcards/[id] — update and delete

**File**: `src/pages/api/flashcards/[id].ts` (new)

**Intent**: Update a card's front/back fields (PUT), or delete a card (DELETE). Both operations
are scoped to the authenticated user automatically by RLS.

**Contract**:
- `export const prerender = false`
- Auth guard on both handlers: `!context.locals.user` → 401
- Supabase guard on both handlers: `createClient(...)` returns null → 500
- `PUT`: read `context.params.id`; Zod schema `z.object({ front: z.string().min(1).max(500).optional(), back: z.string().min(1).max(500).optional() })`; validate JSON body; call `updateFlashcard(supabase, id, parsed.data)`; success → 200 `{ card: Flashcard }`; caught lib error → 500 `{ error: "Nie udało się zaktualizować fiszki." }`; log prefix `[flashcards update]`
- `DELETE`: read `context.params.id`; no body needed; call `deleteFlashcard(supabase, id)`;
  success → 200 `{}`; caught lib error → 500 `{ error: "Nie udało się usunąć fiszki." }`; log prefix `[flashcards delete]`

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- `GET /api/flashcards` (no matching export) → Astro 405 (not a new route conflict)
- `POST /api/flashcards` without auth → 401
- `POST /api/flashcards` with auth, body `{ front: "Q", back: "A" }` → 201 with card object
- `PUT /api/flashcards/<id>` with auth, body `{ front: "Updated" }` → 200 with updated card
- `DELETE /api/flashcards/<id>` with auth → 200 `{}`

---

## Phase 2: FlashcardsListView UI — inline create, edit, delete

### Overview

Extend `FlashcardsListView.tsx` with create, edit, and delete UI, adding optimistic state
updates. The view state transitions: `loading` → `ready` | `error`. The `empty` case is handled
inline within `ready` (zero cards shows a message below the always-visible create form, not a
separate branch).

### Changes Required

#### 1. FlashcardsListView rewrite

**File**: `src/components/flashcards/FlashcardsListView.tsx` (modify)

**Intent**: Keep the same fetch-on-mount pattern, add create/edit/delete operations and their
state.

**State additions**:
```ts
// view
type ViewState = "loading" | "ready" | "error";

// create form
const [newFront, setNewFront] = useState("");
const [newBack, setNewBack] = useState("");
const [creating, setCreating] = useState(false);
const [createError, setCreateError] = useState<string | null>(null);

// edit
const [editingId, setEditingId] = useState<string | null>(null);
const [editFront, setEditFront] = useState("");
const [editBack, setEditBack] = useState("");
const [editError, setEditError] = useState<string | null>(null);

// delete
const [deletingId, setDeletingId] = useState<string | null>(null);
const [deleteError, setDeleteError] = useState<string | null>(null);
```

**Create handler** (`handleCreate`):
- Set `creating = true`, clear `createError`
- `POST /api/flashcards` with `{ front: newFront, back: newBack }`
- On success: prepend card to `cards`, clear `newFront`/`newBack`
- On error (`!r.ok` or network failure): set `createError` to error message from response or
  fallback
- Always: `creating = false`

**Edit handler** (`startEdit(card)` / `handleSaveEdit(id)`):
- `startEdit`: set `editingId = card.id`, `editFront = card.front`, `editBack = card.back`,
  clear `editError`
- `handleSaveEdit`: `PUT /api/flashcards/${id}` with `{ front: editFront, back: editBack }`; on
  success: update card in `cards` array, clear `editingId`; on error: set `editError`

**Delete handler** (`startDelete(id)` / `handleConfirmDelete(id)`):
- `startDelete`: set `deletingId = id`, clear `deleteError`
- `handleConfirmDelete`: `DELETE /api/flashcards/${id}`; on success: filter card from `cards`,
  clear `deletingId`; on error: set `deleteError`

**Render structure in `ready` state**:
```
<div mx-auto max-w-2xl p-6 space-y-6>
  <h1>Twoje fiszki</h1>

  {/* Create form — always visible */}
  <section aria-label="Dodaj fiszkę">
    <label>Przód</label>
    <textarea value={newFront} onChange={...} maxLength={500} />
    <label>Tył</label>
    <textarea value={newBack} onChange={...} maxLength={500} />
    {createError && <p role="alert">{createError}</p>}
    <Button disabled={!newFront.trim() || !newBack.trim() || creating} onClick={handleCreate}>
      {creating ? "Dodawanie…" : "Dodaj fiszkę"}
    </Button>
  </section>

  {/* Card list */}
  {cards.length === 0 ? (
    <p>Nie masz jeszcze żadnych fiszek.</p>
  ) : (
    <div space-y-3>
      {cards.map(card => (
        <div key={card.id} ...>
          {editingId === card.id ? (
            /* inline edit form — CardReviewItem pattern */
          ) : deletingId === card.id ? (
            /* delete confirmation */
          ) : (
            /* read view + Edit/Usuń buttons */
          )}
        </div>
      ))}
    </div>
  )}
</div>
```

**Inline edit form** (when `editingId === card.id`):
- Two textareas (`editFront`, `editBack`), Zapisz button, Anuluj button
- On Anuluj: clear `editingId`, clear `editError`
- `editError` shown below textareas as `role="alert"`

**Inline delete confirmation** (when `deletingId === card.id`):
- Display "Na pewno?" text, "Tak" button (calls `handleConfirmDelete`), "Nie" button (clears
  `deletingId`)
- `deleteError` shown as `role="alert"`

**Read view** (default):
- Show card front/back (same layout as current)
- "Edytuj" button → `startEdit(card)`
- "Usuń" button → `startDelete(card.id)`

**Count in header**: show `cards.length` next to title (same as current)

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- Sign in, navigate to `/flashcards`; create form is visible immediately above the card list
- Create a card: fill front and back, press "Dodaj fiszkę"; card appears at top of list without
  page reload
- Edit a card: press "Edytuj"; inline form appears pre-filled; change text and press "Zapisz";
  card updates in place
- Cancel edit: press "Anuluj"; form disappears, original text restored
- Delete a card: press "Usuń"; "Na pewno?" prompt appears; press "Nie" → prompt disappears,
  card stays; press "Usuń" again → press "Tak" → card disappears from list

---

## Phase 3: Unit Tests — error paths for create, update, delete

### Overview

The existing test file has error-path tests for `listFlashcards`, `listDueFlashcards`,
`batchCreateFlashcards`, and `updateFlashcardSR` but is missing them for the three functions this
feature exercises: `createFlashcard`, `updateFlashcard`, `deleteFlashcard`. Add one "throws on
supabase error" case to each.

### Changes Required

#### 1. Error-path tests

**File**: `src/lib/flashcards/__tests__/flashcards.test.ts` (modify)

**Intent**: Each existing `describe` block for create/update/delete gets a second `it()` that
verifies the throw-on-error path, matching the `makeSupabase` mock pattern already in the file.

**Contract** (three additions — append to their existing `describe` blocks):

```ts
// inside describe("createFlashcard")
it("throws on supabase error", async () => {
  const supabase = makeSupabase({ data: null, error: new Error("db error") });
  await expect(
    createFlashcard(supabase as never, { front: "Q", back: "A" })
  ).rejects.toThrow("db error");
});

// inside describe("updateFlashcard")
it("throws on supabase error", async () => {
  const supabase = makeSupabase({ data: null, error: new Error("db error") });
  await expect(
    updateFlashcard(supabase as never, "card-1", { front: "Q" })
  ).rejects.toThrow("db error");
});

// inside describe("deleteFlashcard")
it("throws on supabase error", async () => {
  const supabase = makeSupabase({ data: null, error: new Error("db error") });
  await expect(deleteFlashcard(supabase as never, "card-1")).rejects.toThrow("db error");
});
```

### Success Criteria

#### Automated Verification

- Unit tests pass (all existing + 3 new): `npm test`
- Type checking passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- None — no new user-facing surface.

---

## Testing Strategy

### Unit Tests

- Three new error-path `it()` cases in
  `src/lib/flashcards/__tests__/flashcards.test.ts` (Phase 3).
- The lib functions themselves were already covered by happy-path tests; the new cases close the
  gap for error propagation.

### Integration / E2E Tests

- None added — all three operations are covered by the unit tests; the existing
  `batch-save-error.spec.ts` E2E test already validates the error-path pattern for the save flow.

### Manual Testing Steps

See per-phase Manual Verification sections above.

---

## References

- Lib functions: `src/lib/flashcards/index.ts`
- Existing API route pattern: `src/pages/api/flashcards/batch-create.ts`, `review.ts`
- Inline edit pattern: `src/components/generate/CardReviewItem.tsx`
- FlashcardsListView (current): `src/components/flashcards/FlashcardsListView.tsx`
- Existing unit test pattern: `src/lib/flashcards/__tests__/flashcards.test.ts:32-45`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: API Routes — create, update, delete

#### Automated

- [x] 1.1 Type checking passes: `npm run build` — a309af0
- [x] 1.2 Linting passes: `npm run lint` — a309af0

#### Manual

- [x] 1.3 `POST /api/flashcards` without auth → 401 — a309af0
- [x] 1.4 `POST /api/flashcards` with auth and valid body → 201 with card — a309af0
- [x] 1.5 `PUT /api/flashcards/<id>` with auth → 200 with updated card — a309af0
- [x] 1.6 `DELETE /api/flashcards/<id>` with auth → 200 `{}` — a309af0

### Phase 2: FlashcardsListView UI — inline create, edit, delete

#### Automated

- [x] 2.1 Type checking passes: `npm run build` — db0c09d
- [x] 2.2 Linting passes: `npm run lint` — db0c09d

#### Manual

- [x] 2.3 Create form is visible at top of `/flashcards` after loading — db0c09d
- [x] 2.4 Creating a card adds it to the top of the list without reload — db0c09d
- [x] 2.5 Editing a card updates it in place without reload — db0c09d
- [x] 2.6 Cancelling edit restores original text — db0c09d
- [x] 2.7 Delete confirmation ("Na pewno?") appears; "Nie" cancels; "Tak" removes card — db0c09d

### Phase 3: Unit Tests — error paths

#### Automated

- [x] 3.1 Unit tests pass (all including 3 new): `npm test` — 8a5de7a
- [x] 3.2 Type checking passes: `npm run build` — 8a5de7a
- [x] 3.3 Linting passes: `npm run lint` — 8a5de7a
