import { z } from "zod";
import type { GeneratedCard, GenerateFlashcardsInput } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT =
  "You are a flashcard generator. Given text, generate 3 to 10 flashcards as a JSON array. " +
  "Return ONLY a valid JSON array with no markdown, no code blocks, and no explanation. " +
  'Each element must have exactly two string fields: "front" (a question) and "back" (the answer). ' +
  'Example: [{"front":"What is X?","back":"X is Y."}]';

const cardsSchema = z.array(z.object({ front: z.string(), back: z.string() }));

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GeneratedCard[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input.text },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Generation timed out after 10 seconds");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText} — ${errorBody}`);
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`AI returned invalid JSON: ${content.slice(0, 100)}`);
  }

  const result = cardsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`AI output does not match expected schema: ${String(result.error)}`);
  }

  return result.data;
}
