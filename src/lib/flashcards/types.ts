export interface Flashcard {
  id: string;
  user_id: string;
  front: string;
  back: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFlashcardDto {
  front: string;
  back: string;
}

export interface UpdateFlashcardDto {
  front?: string;
  back?: string;
}
