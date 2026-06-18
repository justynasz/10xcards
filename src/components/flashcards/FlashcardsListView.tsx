import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/lib/flashcards/types";

type ViewState = "loading" | "list" | "empty" | "error";

export function FlashcardsListView() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [cards, setCards] = useState<Flashcard[]>([]);

  useEffect(() => {
    fetch("/api/flashcards/list")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ cards: Flashcard[] }>;
      })
      .then((data) => {
        setCards(data.cards);
        setViewState(data.cards.length === 0 ? "empty" : "list");
      })
      .catch(() => {
        setViewState("error");
      });
  }, []);

  if (viewState === "loading") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-24 animate-pulse rounded bg-gray-200" />
        <div className="h-24 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Nie udało się załadować fiszek</h1>
        <p className="text-gray-600">Spróbuj odświeżyć stronę.</p>
      </div>
    );
  }

  if (viewState === "empty") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Nie masz jeszcze żadnych fiszek</h1>
        <p className="text-gray-600">Wygeneruj swój pierwszy zestaw fiszek z dowolnego tekstu.</p>
        <Button asChild>
          <a href="/generate">Wygeneruj swoje pierwsze fiszki</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Twoje fiszki</h1>
        <span className="text-sm text-gray-500">{cards.length}</span>
      </div>

      <div className="space-y-3">
        {cards.map((card) => (
          <div key={card.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Przód</p>
              <p className="text-sm text-gray-900">{card.front}</p>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Tył</p>
              <p className="text-sm text-gray-900">{card.back}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
