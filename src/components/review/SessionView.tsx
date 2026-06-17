import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/lib/flashcards/types";
import type { SRRating } from "@/lib/spaced-repetition";

type ViewState = "loading" | "session" | "flipped" | "saving" | "summary" | "empty";

interface Results {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export function SessionView() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [results, setResults] = useState<Results>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetch("/api/flashcards/review")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ cards: Flashcard[]; nextDue: string | null }>;
      })
      .then((data) => {
        if (data.cards.length === 0) {
          setNextDue(data.nextDue);
          setViewState("empty");
        } else {
          setCards(data.cards);
          setViewState("session");
        }
      })
      .catch(() => {
        setErrorMessage("Nie udało się załadować sesji.");
        setViewState("empty");
      });
  }, []);

  async function handleRate(rating: SRRating) {
    const card = cards[currentIndex];
    setViewState("saving");

    try {
      const res = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, rating }),
      });
      if (!res.ok) throw new Error("Failed");

      setResults((prev) => ({ ...prev, [rating.toLowerCase()]: prev[rating.toLowerCase() as keyof Results] + 1 }));

      const nextIndex = currentIndex + 1;
      if (nextIndex >= cards.length) {
        setViewState("summary");
      } else {
        setCurrentIndex(nextIndex);
        setViewState("session");
      }
    } catch {
      setErrorMessage("Nie udało się zapisać oceny. Spróbuj ponownie.");
      setViewState("flipped");
    }
  }

  if (viewState === "loading") {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-40 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (viewState === "empty") {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Brak kart do powtórki</h1>
        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : nextDue ? (
          <p className="text-gray-600">
            Następna powtórka:{" "}
            <span className="font-medium">
              {new Date(nextDue).toLocaleDateString("pl-PL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </p>
        ) : (
          <p className="text-gray-600">Nie masz jeszcze żadnych kart. Wygeneruj je najpierw.</p>
        )}
        <Button asChild variant="outline">
          <a href="/dashboard">Wróć do dashboard</a>
        </Button>
      </div>
    );
  }

  if (viewState === "summary") {
    const total = cards.length;
    return (
      <div className="mx-auto max-w-xl space-y-6 p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Sesja ukończona!</h1>
        <p className="text-gray-600">
          Przejrzałeś <span className="font-semibold">{total}</span>{" "}
          {total === 1 ? "kartę" : total < 5 ? "karty" : "kart"}.
        </p>
        <div className="rounded-lg border border-gray-200 p-4 text-left">
          <p className="mb-2 text-sm font-medium text-gray-700">Rozkład ocen:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-red-600">Again: {results.again}</span>
            <span className="text-orange-500">Hard: {results.hard}</span>
            <span className="text-green-600">Good: {results.good}</span>
            <span className="text-blue-600">Easy: {results.easy}</span>
          </div>
        </div>
        <Button asChild>
          <a href="/dashboard">Wróć do dashboard</a>
        </Button>
      </div>
    );
  }

  const card = cards[currentIndex];
  const isFlipped = viewState === "flipped";
  const isSaving = viewState === "saving";

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Powtórka</h1>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-gray-500">Pytanie</p>
        <p className="mt-2 text-lg text-gray-900">{card.front}</p>

        {isFlipped || isSaving ? (
          <>
            <hr className="my-4 border-gray-100" />
            <p className="text-sm font-medium text-gray-500">Odpowiedź</p>
            <p className="mt-2 text-lg text-gray-900">{card.back}</p>
          </>
        ) : null}
      </div>

      {!isFlipped && !isSaving ? (
        <Button
          className="w-full"
          onClick={() => {
            setViewState("flipped");
          }}
        >
          Pokaż odpowiedź
        </Button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {(["Again", "Hard", "Good", "Easy"] as SRRating[]).map((rating) => (
            <Button
              key={rating}
              disabled={isSaving}
              onClick={() => void handleRate(rating)}
              className={cn(
                "w-full",
                rating === "Again" && "bg-red-500 text-white hover:bg-red-600",
                rating === "Hard" && "bg-orange-400 text-white hover:bg-orange-500",
                rating === "Good" && "bg-green-500 text-white hover:bg-green-600",
                rating === "Easy" && "bg-blue-500 text-white hover:bg-blue-600",
              )}
            >
              {rating}
            </Button>
          ))}
        </div>
      )}

      {errorMessage && <p className="text-center text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}
