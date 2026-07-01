# Plan Brief — flashcard-crud

**3 fazy, MEDIUM złożoność**

## Phase 1: API Routes (nowe pliki)
- `src/pages/api/flashcards/index.ts` — `POST /api/flashcards`: auth → Zod `{front, back}` (min 1, max 500) → `createFlashcard` → 201 `{card}`
- `src/pages/api/flashcards/[id].ts` — `PUT`: Zod `{front?, back?}` → `updateFlashcard` → 200 `{card}`; `DELETE`: `deleteFlashcard` → 200 `{}`

## Phase 2: FlashcardsListView UI (modyfikacja)
- `src/components/flashcards/FlashcardsListView.tsx`
  - Nowe stany: `editingId`, `deletingId`, `newFront/Back`, `creating`, `createError/editError/deleteError`
  - Widok `empty` → zawsze `ready`, formularz tworzenia widoczny u góry
  - Wzorzec edycji z `CardReviewItem.tsx`
  - Potwierdzenie usunięcia inline: „Na pewno? Tak / Nie"
  - Optymistyczne aktualizacje: dodaj na górę / zastąp w tablicy / usuń z tablicy

## Phase 3: Unit Tests (modyfikacja)
- `src/lib/flashcards/__tests__/flashcards.test.ts`
  - Dodaj "throws on supabase error" do `createFlashcard`, `updateFlashcard`, `deleteFlashcard`
