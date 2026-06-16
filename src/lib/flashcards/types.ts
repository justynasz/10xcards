export interface Flashcard {
  id: string;
  user_id: string;
  front: string;
  back: string;
  created_at: string;
  updated_at: string;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
}

export interface UpdateFlashcardSRDto {
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string; // ISO 8601 timestamp
}

export interface CreateFlashcardDto {
  front: string;
  back: string;
}

export interface UpdateFlashcardDto {
  front?: string;
  back?: string;
}
