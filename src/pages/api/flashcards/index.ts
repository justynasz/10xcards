import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createFlashcard } from "@/lib/flashcards";

export const prerender = false;

const createSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(500),
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const card = await createFlashcard(supabase, parsed.data);
    return Response.json({ card }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[flashcards create] Supabase error:", err);
    return Response.json({ error: "Nie udało się dodać fiszki." }, { status: 500 });
  }
};
