import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY } from "astro:env/server";
import { z } from "zod";
import { generateFlashcards } from "@/lib/openrouter";

const bodySchema = z.object({
  text: z.string().min(50).max(5000),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!OPENROUTER_API_KEY) {
    return Response.json({ error: "OpenRouter is not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const cards = await generateFlashcards({ text: parsed.data.text, apiKey: OPENROUTER_API_KEY });
    return Response.json({ cards }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timed out")) {
      return Response.json({ error: "Generation timed out" }, { status: 504 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
};
