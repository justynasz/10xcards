export interface Flashcard {
  id: string;
  user_id: string;
  front: string;
  back: string;
  created_at: string;
  updated_at: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  due_date: string;
  last_review: string | null;
}

export interface UpdateFlashcardSRDto {
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  due_date: string;
  last_review: string | null;
}

export interface CreateFlashcardDto {
  front: string;
  back: string;
}

export interface UpdateFlashcardDto {
  front?: string;
  back?: string;
}
