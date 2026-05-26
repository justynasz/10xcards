import { describe, expect, it, vi } from "vitest";
import { createFlashcard, deleteFlashcard, listFlashcards, updateFlashcard } from "../index";
import type { Flashcard } from "../types";

const makeCard = (overrides?: Partial<Flashcard>): Flashcard => ({
  id: "card-1",
  user_id: "user-1",
  front: "What is TypeScript?",
  back: "A typed superset of JavaScript.",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeSupabase = (result: { data: unknown; error: unknown }) => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue(result),
  single: vi.fn().mockResolvedValue(result),
});

describe("listFlashcards", () => {
  it("returns cards ordered by created_at desc", async () => {
    const cards = [makeCard()];
    const supabase = makeSupabase({ data: cards, error: null });

    const result = await listFlashcards(supabase as never);

    expect(supabase.from).toHaveBeenCalledWith("flashcards");
    expect(result).toEqual(cards);
  });

  it("throws on supabase error", async () => {
    const supabase = makeSupabase({ data: null, error: new Error("db error") });
    await expect(listFlashcards(supabase as never)).rejects.toThrow("db error");
  });
});

describe("createFlashcard", () => {
  it("inserts and returns the new card", async () => {
    const card = makeCard();
    const supabase = makeSupabase({ data: card, error: null });

    const result = await createFlashcard(supabase as never, {
      front: card.front,
      back: card.back,
    });

    expect(supabase.insert).toHaveBeenCalledWith({ front: card.front, back: card.back });
    expect(result).toEqual(card);
  });
});

describe("updateFlashcard", () => {
  it("updates and returns the patched card", async () => {
    const updated = makeCard({ front: "Updated question?" });
    const supabase = makeSupabase({ data: updated, error: null });

    const result = await updateFlashcard(supabase as never, "card-1", {
      front: "Updated question?",
    });

    expect(supabase.eq).toHaveBeenCalledWith("id", "card-1");
    expect(result).toEqual(updated);
  });
});

describe("deleteFlashcard", () => {
  it("deletes by id and resolves void", async () => {
    const supabase = makeSupabase({ data: null, error: null });

    await expect(deleteFlashcard(supabase as never, "card-1")).resolves.toBeUndefined();
    expect(supabase.eq).toHaveBeenCalledWith("id", "card-1");
  });
});
