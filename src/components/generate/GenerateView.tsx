import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardReviewItem } from "./CardReviewItem";
import type { CardEntry } from "./CardReviewItem";

type ViewState = "idle" | "loading" | "review" | "saving" | "success" | "error";

const MIN_CHARS = 50;
const MAX_CHARS = 5000;

export function GenerateView() {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [text, setText] = useState("");
  const [cards, setCards] = useState<CardEntry[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const acceptedCards = cards.filter((c) => c.status === "accepted" || c.status === "edited");

  function handleAccept(id: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: "accepted" as const } : c)));
  }

  function handleEdit(id: string, front: string, back: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, front, back, status: "edited" as const } : c)));
  }

  function handleReject(id: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: "rejected" as const } : c)));
  }

  async function handleGenerate() {
    setViewState("loading");
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { cards?: { front: string; back: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const entries: CardEntry[] = (data.cards ?? []).map((c, i) => ({
        id: String(i),
        front: c.front,
        back: c.back,
        status: "pending",
      }));
      setCards(entries);
      setViewState("review");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setViewState("error");
    }
  }

  async function handleSave() {
    setViewState("saving");
    try {
      const res = await fetch("/api/flashcards/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: acceptedCards.map((c) => ({ front: c.front, back: c.back })) }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSavedCount(acceptedCards.length);
      setViewState("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setViewState("error");
    }
  }

  function handleRetry() {
    setErrorMessage("");
    setViewState("idle");
  }

  function handleGenerateMore() {
    setCards([]);
    setErrorMessage("");
    setViewState("idle");
  }

  if (viewState === "idle" || viewState === "loading") {
    const isLoading = viewState === "loading";
    const charCount = text.length;
    const canGenerate = charCount >= MIN_CHARS && charCount <= MAX_CHARS;

    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Generate Flashcards</h1>
        <p className="text-sm text-gray-500">Paste text to generate flashcard proposals with AI.</p>
        <div>
          <textarea
            className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            rows={10}
            placeholder="Paste text to generate flashcards… (50–5000 characters)"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            disabled={isLoading}
          />
          <div className="mt-1 flex justify-between text-xs text-gray-400">
            <span>
              {charCount < MIN_CHARS
                ? `${MIN_CHARS - charCount} more characters needed`
                : charCount > MAX_CHARS
                  ? `${charCount - MAX_CHARS} characters over limit`
                  : ""}
            </span>
            <span className={charCount > MAX_CHARS ? "text-red-500" : ""}>
              {charCount} / {MAX_CHARS}
            </span>
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={!canGenerate || isLoading} className="w-full">
          {isLoading ? "Generating…" : "Generate cards"}
        </Button>
      </div>
    );
  }

  if (viewState === "review" || viewState === "saving") {
    const isSaving = viewState === "saving";
    const acceptedCount = acceptedCards.length;

    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Review Cards</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setViewState("idle");
            }}
            disabled={isSaving}
          >
            Regenerate
          </Button>
        </div>
        <div className="space-y-3">
          {cards.map((card) => (
            <CardReviewItem
              key={card.id}
              card={card}
              onAccept={handleAccept}
              onEdit={handleEdit}
              onReject={handleReject}
            />
          ))}
        </div>
        <Button onClick={handleSave} disabled={acceptedCount === 0 || isSaving} className="w-full">
          {isSaving ? "Saving…" : `Save ${acceptedCount} accepted card${acceptedCount !== 1 ? "s" : ""}`}
        </Button>
      </div>
    );
  }

  if (viewState === "success") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="text-2xl font-bold text-gray-900">
          {savedCount} card{savedCount !== 1 ? "s" : ""} added to your deck!
        </h1>
        <div className="flex justify-center gap-3">
          <Button onClick={handleGenerateMore}>Generate more</Button>
          <Button variant="outline" asChild>
            <a href="/dashboard">Go to dashboard</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">Generation failed</p>
        <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
      </div>
      <Button onClick={handleRetry}>Retry</Button>
    </div>
  );
}
