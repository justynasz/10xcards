import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { listFlashcards } from "@/lib/flashcards";

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
    const cards = await listFlashcards(supabase);
    return Response.json({ cards });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[flashcards list GET] Error:", err);
    return Response.json({ error: "Failed to load flashcards." }, { status: 500 });
  }
};
