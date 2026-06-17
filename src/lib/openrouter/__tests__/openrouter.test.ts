import { afterEach, describe, expect, it, vi } from "vitest";
import { generateFlashcards } from "../index";
import type { GenerateFlashcardsInput } from "../types";

const validInput: GenerateFlashcardsInput = {
  text: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
  apiKey: "test-key",
};

function makeResponse(content: string, ok = true, errorBody = ""): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
    text: () => Promise.resolve(errorBody),
  } as unknown as Response;
}

describe("generateFlashcards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed cards on valid OpenRouter response", async () => {
    const cards = [
      { front: "What is TypeScript?", back: "A typed superset of JavaScript." },
      { front: "What does TypeScript compile to?", back: "Plain JavaScript." },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(JSON.stringify(cards))));

    const result = await generateFlashcards(validInput);

    expect(result).toEqual(cards);
  });

  it("throws on malformed AI JSON output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse("```json\nnot valid json\n```")));

    await expect(generateFlashcards(validInput)).rejects.toThrow("invalid JSON");
  });

  it("throws on non-ok HTTP response from OpenRouter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse("", false, '{"error":{"message":"model not found","code":404}}')),
    );

    await expect(generateFlashcards(validInput)).rejects.toThrow("OpenRouter request failed: 500");
  });

  it("throws on fetch timeout (AbortError)", async () => {
    const abortError = Object.assign(new Error("The operation was aborted."), {
      name: "AbortError",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(generateFlashcards(validInput)).rejects.toThrow("Generation timed out after 10 seconds");
  });
});
