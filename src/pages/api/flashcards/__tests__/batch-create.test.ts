import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/flashcards", () => ({
  batchCreateFlashcards: vi.fn(),
}));

import { batchCreateFlashcards } from "@/lib/flashcards";
import { POST } from "../batch-create";

const validCards = [{ front: "Q", back: "A" }];

function makeContext(user: unknown, body: unknown): APIContext {
  return {
    locals: { user },
    request: new Request("http://localhost/api/flashcards/batch-create", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    cookies: {},
  } as unknown as APIContext;
}

describe("POST /api/flashcards/batch-create", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user is authenticated", async () => {
    const response = await POST(makeContext(null, { cards: validCards }));

    expect(response.status).toBe(401);
  });

  it("returns 500 when batchCreateFlashcards throws", async () => {
    vi.mocked(batchCreateFlashcards).mockRejectedValueOnce(new Error("db error"));

    const response = await POST(makeContext({ id: "user-1" }, { cards: validCards }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to save cards");
  });
});
