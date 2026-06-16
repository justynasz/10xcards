import { describe, expect, it, vi } from "vitest";
import {
  batchCreateFlashcards,
  createFlashcard,
  deleteFlashcard,
  listDueFlashcards,
  listFlashcards,
  updateFlashcard,
  updateFlashcardSR,
} from "../index";
import type { Flashcard, UpdateFlashcardSRDto } from "../types";

const makeCard = (overrides?: Partial<Flashcard>): Flashcard => ({
  id: "card-1",
  user_id: "user-1",
  front: "What is TypeScript?",
  back: "A typed superset of JavaScript.",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  easiness_factor: 2.5,
  interval_days: 1,
  repetitions: 0,
  due_date: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeSupabase = (result: { data: unknown; error: unknown }) => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
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

describe("listDueFlashcards", () => {
  it("returns cards with due_date <= now", async () => {
    const cards = [makeCard()];
    const supabase = makeSupabase({ data: cards, error: null });

    const result = await listDueFlashcards(supabase as never);

    expect(supabase.from).toHaveBeenCalledWith("flashcards");
    expect(supabase.lte).toHaveBeenCalledWith("due_date", expect.any(String));
    expect(result).toEqual(cards);
  });

  it("throws on supabase error", async () => {
    const supabase = makeSupabase({ data: null, error: new Error("db error") });
    await expect(listDueFlashcards(supabase as never)).rejects.toThrow("db error");
  });
});

describe("updateFlashcardSR", () => {
  it("updates SM-2 fields and returns updated card", async () => {
    const dto: UpdateFlashcardSRDto = {
      easiness_factor: 2.6,
      interval_days: 6,
      repetitions: 1,
      due_date: "2026-01-07T00:00:00Z",
    };
    const updated = makeCard({ ...dto });
    const supabase = makeSupabase({ data: updated, error: null });

    const result = await updateFlashcardSR(supabase as never, "card-1", dto);

    expect(supabase.update).toHaveBeenCalledWith(dto);
    expect(supabase.eq).toHaveBeenCalledWith("id", "card-1");
    expect(result).toEqual(updated);
  });

  it("throws on supabase error", async () => {
    const dto: UpdateFlashcardSRDto = {
      easiness_factor: 2.5,
      interval_days: 1,
      repetitions: 0,
      due_date: "2026-01-01T00:00:00Z",
    };
    const supabase = makeSupabase({ data: null, error: new Error("db error") });
    await expect(updateFlashcardSR(supabase as never, "card-1", dto)).rejects.toThrow("db error");
  });
});

const makeSupabaseBatch = (result: { data: unknown; error: unknown }) => ({
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockResolvedValue(result),
});

describe("batchCreateFlashcards", () => {
  it("inserts multiple cards and returns them", async () => {
    const cards = [makeCard(), makeCard({ id: "card-2", front: "Q2?", back: "A2." })];
    const supabase = makeSupabaseBatch({ data: cards, error: null });

    const result = await batchCreateFlashcards(supabase as never, [
      { front: cards[0].front, back: cards[0].back },
      { front: cards[1].front, back: cards[1].back },
    ]);

    expect(supabase.insert).toHaveBeenCalledWith([
      { front: cards[0].front, back: cards[0].back },
      { front: cards[1].front, back: cards[1].back },
    ]);
    expect(result).toEqual(cards);
  });

  it("throws on supabase error", async () => {
    const supabase = makeSupabaseBatch({ data: null, error: new Error("db error") });
    await expect(batchCreateFlashcards(supabase as never, [{ front: "Q", back: "A" }])).rejects.toThrow("db error");
  });
});
