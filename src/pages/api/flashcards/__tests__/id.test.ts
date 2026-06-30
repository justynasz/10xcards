import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/flashcards", () => ({
  getFlashcard: vi.fn(),
  updateFlashcard: vi.fn(),
  deleteFlashcard: vi.fn(),
}));

import { getFlashcard, updateFlashcard, deleteFlashcard } from "@/lib/flashcards";
import { DELETE, PUT } from "../[id]";

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";
const CARD_ID = "card-1";

const ownCard = { id: CARD_ID, user_id: OWNER_ID, front: "Q", back: "A" };
const otherCard = { id: CARD_ID, user_id: OTHER_ID, front: "Q", back: "A" };

function makeDeleteContext(userId: string, cardId = CARD_ID): APIContext {
  return {
    locals: { user: { id: userId } },
    params: { id: cardId },
    request: new Request(`http://localhost/api/flashcards/${cardId}`, { method: "DELETE" }),
    cookies: {},
  } as unknown as APIContext;
}

function makePutContext(userId: string, body: unknown, cardId = CARD_ID): APIContext {
  return {
    locals: { user: { id: userId } },
    params: { id: cardId },
    request: new Request(`http://localhost/api/flashcards/${cardId}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    cookies: {},
  } as unknown as APIContext;
}

describe("DELETE /api/flashcards/[id]", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("R6: returns 403 when card belongs to a different user", async () => {
    vi.mocked(getFlashcard).mockResolvedValueOnce(
      otherCard as ReturnType<typeof getFlashcard> extends Promise<infer T> ? T : never,
    );

    const response = await DELETE(makeDeleteContext(OWNER_ID));

    expect(response.status).toBe(403);
    expect(vi.mocked(deleteFlashcard)).not.toHaveBeenCalled();
  });

  it("returns 200 when card belongs to the authenticated user", async () => {
    vi.mocked(getFlashcard).mockResolvedValueOnce(
      ownCard as ReturnType<typeof getFlashcard> extends Promise<infer T> ? T : never,
    );
    vi.mocked(deleteFlashcard).mockResolvedValueOnce(undefined);

    const response = await DELETE(makeDeleteContext(OWNER_ID));

    expect(response.status).toBe(200);
    expect(vi.mocked(deleteFlashcard)).toHaveBeenCalledWith(expect.anything(), CARD_ID);
  });
});

describe("PUT /api/flashcards/[id]", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("R6: returns 403 when card belongs to a different user", async () => {
    vi.mocked(getFlashcard).mockResolvedValueOnce(
      otherCard as ReturnType<typeof getFlashcard> extends Promise<infer T> ? T : never,
    );

    const response = await PUT(makePutContext(OWNER_ID, { front: "New Q" }));

    expect(response.status).toBe(403);
    expect(vi.mocked(updateFlashcard)).not.toHaveBeenCalled();
  });

  it("returns 200 when card belongs to the authenticated user", async () => {
    vi.mocked(getFlashcard).mockResolvedValueOnce(
      ownCard as ReturnType<typeof getFlashcard> extends Promise<infer T> ? T : never,
    );
    vi.mocked(updateFlashcard).mockResolvedValueOnce({ ...ownCard, front: "New Q" } as ReturnType<
      typeof updateFlashcard
    > extends Promise<infer T>
      ? T
      : never);

    const response = await PUT(makePutContext(OWNER_ID, { front: "New Q" }));

    expect(response.status).toBe(200);
    expect(vi.mocked(updateFlashcard)).toHaveBeenCalledWith(expect.anything(), CARD_ID, { front: "New Q" });
  });
});
