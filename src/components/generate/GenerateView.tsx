import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardReviewItem } from "./CardReviewItem";
import type { CardEntry } from "./CardReviewItem";

type ViewState = "idle" | "loading" | "review" | "saving" | "success" | "error";

const MIN_CHARS = 50;
const MAX_CHARS = 5000;

function cardForm(n: number) {
  if (n === 1) return "fiszkę";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "fiszki";
  return "fiszek";
}

export function GenerateView() {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [text, setText] = useState("");
  const [cards, setCards] = useState<CardEntry[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorSource, setErrorSource] = useState<"generate" | "save" | null>(null);

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
      if (!res.ok) throw new Error(data.error ?? "Generowanie nie powiodło się");
      const entries: CardEntry[] = (data.cards ?? []).map((c, i) => ({
        id: String(i),
        front: c.front,
        back: c.back,
        status: "pending",
      }));
      setCards(entries);
      setViewState("review");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Nieznany błąd");
      setErrorSource("generate");
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
      if (!res.ok) throw new Error(data.error ?? "Zapisanie nie powiodło się");
      setSavedCount(acceptedCards.length);
      setViewState("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Nieznany błąd");
      setErrorSource("save");
      setViewState("error");
    }
  }

  function handleRetry() {
    setErrorMessage("");
    setViewState(errorSource === "save" ? "review" : "idle");
    setErrorSource(null);
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
        <h1 className="text-2xl font-bold text-gray-900">Generuj fiszki</h1>
        <p className="text-sm text-gray-500">Wklej tekst, by wygenerować propozycje fiszek z pomocą AI.</p>
        <div>
          <textarea
            className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            rows={10}
            placeholder="Wklej tekst do wygenerowania fiszek… (50–5000 znaków)"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            disabled={isLoading}
          />
          <div className="mt-1 flex justify-between text-xs text-gray-400">
            <span>
              {charCount < MIN_CHARS
                ? `Brakuje jeszcze ${MIN_CHARS - charCount} znaków`
                : charCount > MAX_CHARS
                  ? `Przekroczono limit o ${charCount - MAX_CHARS} znaków`
                  : ""}
            </span>
            <span className={charCount > MAX_CHARS ? "text-red-500" : ""}>
              {charCount} / {MAX_CHARS}
            </span>
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={!canGenerate || isLoading} className="w-full">
          {isLoading ? "Generowanie…" : "Generuj fiszki"}
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
          <h1 className="text-2xl font-bold text-gray-900">Przejrzyj fiszki</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setViewState("idle");
            }}
            disabled={isSaving}
          >
            Generuj ponownie
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
          {isSaving ? "Zapisywanie…" : `Zapisz ${acceptedCount} ${cardForm(acceptedCount)}`}
        </Button>
      </div>
    );
  }

  if (viewState === "success") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="text-2xl font-bold text-gray-900">
          Dodano {savedCount} {cardForm(savedCount)} do twojej talii!
        </h1>
        <div className="flex justify-center gap-3">
          <Button onClick={handleGenerateMore}>Generuj więcej</Button>
          <Button variant="outline" asChild>
            <a href="/dashboard">Przejdź do dashboardu</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {errorSource === "save" ? "Zapisanie nie powiodło się" : "Generowanie nie powiodło się"}
        </p>
        <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
      </div>
      <Button onClick={handleRetry}>Spróbuj ponownie</Button>
    </div>
  );
}
