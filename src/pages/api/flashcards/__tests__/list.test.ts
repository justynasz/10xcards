import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/flashcards", () => ({
  listFlashcards: vi.fn(),
}));

import { listFlashcards } from "@/lib/flashcards";
import { GET } from "../list";

function makeContext(user: unknown): APIContext {
  return {
    locals: { user },
    request: new Request("http://localhost/api/flashcards/list", { method: "GET" }),
    cookies: {},
  } as unknown as APIContext;
}

describe("GET /api/flashcards/list", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user is authenticated", async () => {
    const response = await GET(makeContext(null));

    expect(response.status).toBe(401);
  });

  it("returns 500 when listFlashcards throws", async () => {
    vi.mocked(listFlashcards).mockRejectedValueOnce(new Error("db error"));

    const response = await GET(makeContext({ id: "user-1" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to load flashcards");
  });
});
