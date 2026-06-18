import { fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import type { Flashcard, UpdateFlashcardSRDto } from "@/lib/flashcards/types";
import type { SRRating } from "./types";

export type { SRRating };

export function computeNextCard(card: Flashcard, rating: SRRating): UpdateFlashcardSRDto {
  const tsCard: Card = {
    due: new Date(card.due_date),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
    learning_steps: 0,
  };

  const ratingEnum = Rating[rating as keyof typeof Rating] as Grade;
  const result = fsrs().next(tsCard, new Date(), ratingEnum);

  return {
    due_date: result.card.due.toISOString(),
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    elapsed_days: result.card.elapsed_days,
    scheduled_days: result.card.scheduled_days,
    reps: result.card.reps,
    lapses: result.card.lapses,
    state: result.card.state,
    last_review: result.card.last_review?.toISOString() ?? null,
  };
}
