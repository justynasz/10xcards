import { describe, expect, it } from "vitest";
import { computeNextCard } from "../index";
import type { Flashcard } from "@/lib/flashcards/types";

const newCard = (): Flashcard => ({
  id: "test-id",
  user_id: "user-id",
  front: "Q",
  back: "A",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  due_date: new Date().toISOString(),
  last_review: null,
});

describe("computeNextCard", () => {
  it("New + Again → Learning state, due_date in future", () => {
    const result = computeNextCard(newCard(), "Again");
    expect([1, 3]).toContain(result.state); // Learning or Relearning
    expect(new Date(result.due_date).getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("New + Good → Learning state, reps > 0, due_date in future", () => {
    const result = computeNextCard(newCard(), "Good");
    expect(result.reps).toBeGreaterThan(0);
    expect(result.state).toBe(1); // Learning
    expect(new Date(result.due_date).getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("New + Easy → reps > 0, scheduled_days > 0", () => {
    const result = computeNextCard(newCard(), "Easy");
    expect(result.reps).toBeGreaterThan(0);
    expect(result.scheduled_days).toBeGreaterThan(0);
  });

  it("Review (state=2) + Again → lapses increased by 1", () => {
    const card: Flashcard = { ...newCard(), state: 2, reps: 5, stability: 4, difficulty: 3 };
    const result = computeNextCard(card, "Again");
    expect(result.lapses).toBe(card.lapses + 1);
  });

  it("due_date in result is valid ISO 8601 string", () => {
    const result = computeNextCard(newCard(), "Good");
    expect(() => new Date(result.due_date)).not.toThrow();
    expect(new Date(result.due_date).toISOString()).toBe(result.due_date);
  });

  it("last_review is not null after first review", () => {
    const result = computeNextCard(newCard(), "Good");
    expect(result.last_review).not.toBeNull();
  });
});
