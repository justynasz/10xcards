import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateFlashcardDto, Flashcard, UpdateFlashcardDto, UpdateFlashcardSRDto } from "./types";

const TABLE = "flashcards" as const;

export async function listFlashcards(supabase: SupabaseClient): Promise<Flashcard[]> {
  const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Flashcard[];
}

export async function getFlashcard(supabase: SupabaseClient, id: string): Promise<Flashcard> {
  const result = await supabase.from(TABLE).select("*").eq("id", id).single();
  if (result.error) throw result.error;
  return result.data as Flashcard;
}

export async function createFlashcard(supabase: SupabaseClient, dto: CreateFlashcardDto): Promise<Flashcard> {
  const result = await supabase.from(TABLE).insert(dto).select().single();
  if (result.error) throw result.error;
  return result.data as Flashcard;
}

export async function updateFlashcard(
  supabase: SupabaseClient,
  id: string,
  dto: UpdateFlashcardDto,
): Promise<Flashcard> {
  const result = await supabase.from(TABLE).update(dto).eq("id", id).select().single();
  if (result.error) throw result.error;
  return result.data as Flashcard;
}

export async function deleteFlashcard(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function listDueFlashcards(supabase: SupabaseClient): Promise<Flashcard[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .lte("due_date", new Date().toISOString())
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data as Flashcard[];
}

export async function updateFlashcardSR(
  supabase: SupabaseClient,
  id: string,
  dto: UpdateFlashcardSRDto,
): Promise<Flashcard> {
  const result = await supabase.from(TABLE).update(dto).eq("id", id).select().single();
  if (result.error) throw result.error;
  return result.data as Flashcard;
}
