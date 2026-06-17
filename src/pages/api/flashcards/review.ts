import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { listDueFlashcards, getFlashcard, updateFlashcardSR } from "@/lib/flashcards";
import { computeNextCard } from "@/lib/spaced-repetition";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  try {
    const cards = await listDueFlashcards(supabase);

    let nextDue: string | null = null;
    if (cards.length === 0) {
      const { data } = await supabase
        .from("flashcards")
        .select("due_date")
        .gt("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      nextDue = data?.[0]?.due_date ?? null;
    }

    return Response.json({ cards, nextDue });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[review GET] Error:", err);
    return Response.json({ error: "Failed to load review session." }, { status: 500 });
  }
};

const postSchema = z.object({
  cardId: z.uuid(),
  rating: z.enum(["Again", "Hard", "Good", "Easy"]),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const { cardId, rating } = parsed.data;
    const card = await getFlashcard(supabase, cardId);
    const dto = computeNextCard(card, rating);
    const updatedCard = await updateFlashcardSR(supabase, cardId, dto);
    return Response.json({ card: updatedCard });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[review POST] Error:", err);
    return Response.json({ error: "Failed to process rating." }, { status: 500 });
  }
};
