// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SessionView } from "../SessionView";
import type { Flashcard } from "@/lib/flashcards/types";

function makeJsonResponse(body: unknown, ok: boolean, status: number): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const MOCK_CARD: Flashcard = {
  id: "c-1",
  user_id: "u-1",
  front: "Pytanie testowe",
  back: "Odpowiedź testowa",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  due_date: new Date().toISOString(),
  last_review: null,
};

describe("SessionView", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("R8a: GET load error — shows error message in empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeJsonResponse({}, false, 500)));

    render(<SessionView />);

    await screen.findByText(/Nie udało się załadować sesji/i);
  });

  it("R8b: handleRate error — shows error message, card stays flipped", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ cards: [MOCK_CARD], nextDue: null }, true, 200))
        .mockResolvedValueOnce(makeJsonResponse({}, false, 500)),
    );

    render(<SessionView />);

    await screen.findByText("Pytanie");
    fireEvent.click(screen.getByRole("button", { name: /Pokaż odpowiedź/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Nie umiem$/i }));

    await screen.findByText(/Nie udało się zapisać oceny/i);

    expect(screen.getByText("Odpowiedź")).toBeTruthy();
  });
});
