import { describe, expect, it } from "vitest";
import { computeNextCard } from "../index";
import type { Flashcard } from "@/lib/flashcards/types";

const newCard = (overrides?: Partial<Flashcard>): Flashcard => ({
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
  ...overrides,
});

describe("computeNextCard", () => {
  it("New + Again → Learning (1), scheduled_days=0, due ≈ now+1min", () => {
    const before = Date.now();
    const result = computeNextCard(newCard(), "Again");
    const dueMs = new Date(result.due_date).getTime();
    expect(result.reps).toBeGreaterThan(0);
    expect(result.state).toBe(1); // Learning
    expect(result.scheduled_days).toBe(0);
    expect(dueMs).toBeGreaterThan(before + 30_000); // > now+30s
    expect(dueMs).toBeLessThan(before + 90_000); // < now+90s
  });

  it("New + Hard → Learning (1), scheduled_days=0, due ≈ now+6min", () => {
    const before = Date.now();
    const result = computeNextCard(newCard(), "Hard");
    const dueMs = new Date(result.due_date).getTime();
    expect(result.reps).toBeGreaterThan(0);
    expect(result.state).toBe(1); // Learning
    expect(result.scheduled_days).toBe(0);
    expect(dueMs).toBeGreaterThan(before + 330_000); // > now+5.5min
    expect(dueMs).toBeLessThan(before + 390_000); // < now+6.5min
  });

  it("New + Good → Learning (1), scheduled_days=0, due ≈ now+10min", () => {
    const before = Date.now();
    const result = computeNextCard(newCard(), "Good");
    const dueMs = new Date(result.due_date).getTime();
    expect(result.reps).toBeGreaterThan(0);
    expect(result.lapses).toBe(0);
    expect(result.state).toBe(1); // Learning
    expect(result.scheduled_days).toBe(0);
    expect(dueMs).toBeGreaterThan(before + 570_000); // > now+9.5min
    expect(dueMs).toBeLessThan(before + 630_000); // < now+10.5min
  });

  it("New + Easy → Review (2), scheduled_days=8, due ≈ now+8d", () => {
    const before = Date.now();
    const result = computeNextCard(newCard(), "Easy");
    const dueMs = new Date(result.due_date).getTime();
    expect(result.reps).toBeGreaterThan(0);
    expect(result.lapses).toBe(0);
    expect(result.state).toBe(2); // Review
    expect(result.scheduled_days).toBeGreaterThan(0);
    expect(dueMs).toBeGreaterThan(before + 7 * 86_400_000); // > now+7d
    expect(dueMs).toBeLessThan(before + 9 * 86_400_000); // < now+9d
  });

  it("Review (state=2) + Again → lapses increased by 1", () => {
    const card = newCard({ state: 2, reps: 5, stability: 4, difficulty: 3 });
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

  it("invalid rating throws", () => {
    expect(() => computeNextCard(newCard(), "invalid" as SRRating)).toThrow('Invalid rating: "invalid"');
  });
});
