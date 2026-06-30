// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GenerateView } from "../GenerateView";

function makeJsonResponse(body: unknown, ok: boolean, status: number): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const ENOUGH_TEXT = "a".repeat(50);

describe("GenerateView", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("R3: shows error state when /generate returns 500, never enters review state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeJsonResponse({ error: "Generation failed. Please try again." }, false, 500)),
    );

    render(<GenerateView />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: ENOUGH_TEXT } });
    expect(screen.getByRole("button", { name: /Generuj fiszki/i }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Generuj fiszki/i }));

    await screen.findByText(/Generowanie nie powiodło się/i);

    expect(screen.queryByText(/Przejrzyj fiszki/i)).toBeNull();
  });

  it("R4a: retry after save error returns to review state, not idle", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ cards: [{ front: "Q", back: "A" }] }, true, 200))
        .mockResolvedValueOnce(makeJsonResponse({ error: "Failed to save cards. Please try again." }, false, 500)),
    );

    render(<GenerateView />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: ENOUGH_TEXT } });
    fireEvent.click(screen.getByRole("button", { name: /Generuj fiszki/i }));

    await screen.findByText(/Przejrzyj fiszki/i);
    fireEvent.click(screen.getByRole("button", { name: /Akceptuj/i }));
    fireEvent.click(screen.getByRole("button", { name: /Zapisz/i }));

    await screen.findByText(/Zapisanie nie powiodło się/i);
    fireEvent.click(screen.getByRole("button", { name: /Spróbuj ponownie/i }));

    await screen.findByText(/Przejrzyj fiszki/i);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("R4b: accepted card status preserved through saving→error→review cycle", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ cards: [{ front: "Q", back: "A" }] }, true, 200))
        .mockResolvedValueOnce(makeJsonResponse({ error: "Failed to save cards. Please try again." }, false, 500)),
    );

    render(<GenerateView />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: ENOUGH_TEXT } });
    fireEvent.click(screen.getByRole("button", { name: /Generuj fiszki/i }));

    await screen.findByText(/Przejrzyj fiszki/i);
    fireEvent.click(screen.getByRole("button", { name: /Akceptuj/i }));
    fireEvent.click(screen.getByRole("button", { name: /Zapisz/i }));

    await screen.findByText(/Zapisanie nie powiodło się/i);
    fireEvent.click(screen.getByRole("button", { name: /Spróbuj ponownie/i }));

    await screen.findByText(/Zaakceptowano/i);
    await screen.findByText(/Zapisz 1/i);
  });

  it("R2: shows error state when /batch-create returns 500, never enters success state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ cards: [{ front: "Q", back: "A" }] }, true, 200))
        .mockResolvedValueOnce(makeJsonResponse({ error: "Failed to save cards. Please try again." }, false, 500)),
    );

    render(<GenerateView />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: ENOUGH_TEXT } });
    expect(screen.getByRole("button", { name: /Generuj fiszki/i }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Generuj fiszki/i }));

    await screen.findByText(/Przejrzyj fiszki/i);

    fireEvent.click(screen.getByRole("button", { name: /Akceptuj/i }));
    fireEvent.click(screen.getByRole("button", { name: /Zapisz/i }));

    await screen.findByText(/Zapisanie nie powiodło się/i);

    expect(screen.queryByText(/Dodano/i)).toBeNull();
  });
});
