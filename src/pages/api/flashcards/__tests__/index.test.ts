import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/flashcards", () => ({
  createFlashcard: vi.fn(),
}));

import { createFlashcard } from "@/lib/flashcards";
import { POST } from "../index";

const validCard = { front: "Q", back: "A" };

function makeContext(user: unknown, body: unknown): APIContext {
  return {
    locals: { user },
    request: new Request("http://localhost/api/flashcards", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    cookies: {},
  } as unknown as APIContext;
}

describe("POST /api/flashcards", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user is authenticated", async () => {
    const response = await POST(makeContext(null, validCard));

    expect(response.status).toBe(401);
  });

  it("returns 400 when body is missing back", async () => {
    const response = await POST(makeContext({ id: "user-1" }, { front: "Q" }));

    expect(response.status).toBe(400);
  });

  it("returns 500 when createFlashcard throws", async () => {
    vi.mocked(createFlashcard).mockRejectedValueOnce(new Error("db error"));

    const response = await POST(makeContext({ id: "user-1" }, validCard));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(data.error).toContain("Nie udało się dodać fiszki");
  });
});
