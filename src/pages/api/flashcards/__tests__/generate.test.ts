import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("astro:env/server", () => ({
  OPENROUTER_API_KEY: "test-key",
}));

vi.mock("@/lib/openrouter", () => ({
  generateFlashcards: vi.fn(),
}));

import { generateFlashcards } from "@/lib/openrouter";
import { POST } from "../generate";

function makeContext(body: unknown): APIContext {
  return {
    locals: { user: { id: "user-1" } },
    request: new Request("http://localhost/api/flashcards/generate", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    cookies: {},
  } as unknown as APIContext;
}

describe("POST /api/flashcards/generate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when generateFlashcards throws a generic error", async () => {
    vi.mocked(generateFlashcards).mockRejectedValueOnce(new Error("AI returned invalid JSON: [bad content]"));

    const response = await POST(makeContext({ text: "a".repeat(50) }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(data.error).toContain("Generation failed");
  });

  it("returns 504 when generateFlashcards throws a timeout error", async () => {
    vi.mocked(generateFlashcards).mockRejectedValueOnce(new Error("Generation timed out after 10 seconds"));

    const response = await POST(makeContext({ text: "a".repeat(50) }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(504);
    expect(data.error).toContain("timed out");
  });
});
