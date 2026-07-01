// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FlashcardsListView } from "../FlashcardsListView";
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
  front: "Original Q",
  back: "Original A",
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

describe("FlashcardsListView", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("R7a: create error — shows alert, text fields preserved", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ cards: [] }, true, 200))
        .mockResolvedValueOnce(makeJsonResponse({ error: "Nie udało się dodać fiszki." }, false, 500)),
    );

    render(<FlashcardsListView />);

    await screen.findByText(/Nowa fiszka/i);

    fireEvent.change(screen.getByLabelText(/Przód/i), { target: { value: "My Question" } });
    fireEvent.change(screen.getByLabelText(/Tył/i), { target: { value: "My Answer" } });
    fireEvent.click(screen.getByRole("button", { name: /Dodaj fiszkę/i }));

    await screen.findByRole("alert");

    expect(screen.getByLabelText<HTMLInputElement>(/Przód/i).value).toBe("My Question");
    expect(screen.getByLabelText<HTMLInputElement>(/Tył/i).value).toBe("My Answer");
  });

  it("R7b: edit error — shows alert, edit fields preserved", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ cards: [MOCK_CARD] }, true, 200))
        .mockResolvedValueOnce(makeJsonResponse({ error: "Nie udało się zaktualizować fiszki." }, false, 500)),
    );

    render(<FlashcardsListView />);

    await screen.findByText("Original Q");
    fireEvent.click(screen.getByRole("button", { name: /Edytuj/i }));

    const [, editFrontInput] = screen.getAllByLabelText(/Przód/i);
    fireEvent.change(editFrontInput, { target: { value: "Modified Q" } });

    fireEvent.click(screen.getByRole("button", { name: /Zapisz/i }));

    await screen.findByRole("alert");

    expect((screen.getAllByLabelText(/Przód/i)[1] as HTMLTextAreaElement).value).toBe("Modified Q");
  });

  it("R7c: delete error — shows alert, confirmation state preserved", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ cards: [MOCK_CARD] }, true, 200))
        .mockResolvedValueOnce(makeJsonResponse({ error: "Nie udało się usunąć fiszki." }, false, 500)),
    );

    render(<FlashcardsListView />);

    await screen.findByText("Original Q");
    fireEvent.click(screen.getByRole("button", { name: /Usuń/i }));

    await screen.findByText(/Na pewno\?/i);
    fireEvent.click(screen.getByRole("button", { name: /^Tak$/i }));

    await screen.findByRole("alert");

    expect(screen.getByText(/Na pewno\?/i)).toBeTruthy();
  });
});
