import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { updateFlashcard, deleteFlashcard } from "@/lib/flashcards";

export const prerender = false;

const updateSchema = z
  .object({
    front: z.string().min(1).max(500).optional(),
    back: z.string().min(1).max(500).optional(),
  })
  .refine((d) => d.front !== undefined || d.back !== undefined, {
    message: "Wymagane co najmniej jedno pole.",
  });

export const PUT: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const { id } = context.params;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const card = await updateFlashcard(supabase, id, parsed.data);
    return Response.json({ card });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[flashcards update] Supabase error:", err);
    return Response.json({ error: "Nie udało się zaktualizować fiszki." }, { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const { id } = context.params;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await deleteFlashcard(supabase, id);
    return Response.json({});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[flashcards delete] Supabase error:", err);
    return Response.json({ error: "Nie udało się usunąć fiszki." }, { status: 500 });
  }
};
