import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/lib/flashcards/types";

type ViewState = "loading" | "ready" | "error";

export function FlashcardsListView() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [cards, setCards] = useState<Flashcard[]>([]);

  // create form
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // inline delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/flashcards/list")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ cards: Flashcard[] }>;
      })
      .then((data) => {
        setCards(data.cards);
        setViewState("ready");
      })
      .catch(() => {
        setViewState("error");
      });
  }, []);

  async function handleCreate() {
    if (!newFront.trim() || !newBack.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: newFront.trim(), back: newBack.trim() }),
      });
      const data = (await r.json()) as { card?: Flashcard; error?: string };
      if (!r.ok) {
        setCreateError(data.error ?? "Nie udało się dodać fiszki.");
        return;
      }
      const newCard = data.card;
      if (newCard) {
        setCards((prev) => [newCard, ...prev]);
        setNewFront("");
        setNewBack("");
      }
    } catch {
      setCreateError("Nie udało się dodać fiszki.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    setEditError(null);
    try {
      const r = await fetch(`/api/flashcards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: editFront.trim(), back: editBack.trim() }),
      });
      const data = (await r.json()) as { card?: Flashcard; error?: string };
      if (!r.ok) {
        setEditError(data.error ?? "Nie udało się zaktualizować fiszki.");
        return;
      }
      const updatedCard = data.card;
      if (updatedCard) {
        setCards((prev) => prev.map((c) => (c.id === id ? updatedCard : c)));
        setEditingId(null);
      }
    } catch {
      setEditError("Nie udało się zaktualizować fiszki.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function startDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
  }

  async function handleConfirmDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      const r = await fetch(`/api/flashcards/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const data = (await r.json()) as { error?: string };
        setDeleteError(data.error ?? "Nie udało się usunąć fiszki.");
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== id));
      setDeletingId(null);
    } catch {
      setDeleteError("Nie udało się usunąć fiszki.");
    } finally {
      setDeleting(false);
    }
  }

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

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Twoje fiszki</h1>
        <span className="text-sm text-gray-500">{cards.length}</span>
      </div>

      {/* Create form */}
      <section aria-label="Dodaj fiszkę" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nowa fiszka</h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="new-front" className="text-xs font-semibold text-gray-500 uppercase">
              Przód
            </label>
            <textarea
              id="new-front"
              className="mt-1 w-full resize-none rounded border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              rows={2}
              maxLength={500}
              value={newFront}
              onChange={(e) => {
                setNewFront(e.target.value);
              }}
              placeholder="Pytanie lub pojęcie"
            />
          </div>
          <div>
            <label htmlFor="new-back" className="text-xs font-semibold text-gray-500 uppercase">
              Tył
            </label>
            <textarea
              id="new-back"
              className="mt-1 w-full resize-none rounded border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              rows={2}
              maxLength={500}
              value={newBack}
              onChange={(e) => {
                setNewBack(e.target.value);
              }}
              placeholder="Odpowiedź lub definicja"
            />
          </div>
          {createError && (
            <p role="alert" className="text-sm text-red-600">
              {createError}
            </p>
          )}
          <Button
            size="sm"
            disabled={!newFront.trim() || !newBack.trim() || creating}
            onClick={() => void handleCreate()}
          >
            {creating ? "Dodawanie…" : "Dodaj fiszkę"}
          </Button>
        </div>
      </section>

      {/* Card list */}
      {cards.length === 0 ? (
        <p className="text-center text-gray-500">Nie masz jeszcze żadnych fiszek.</p>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            if (editingId === card.id) {
              return (
                <div key={card.id} className="rounded-lg border-2 border-blue-400 bg-blue-50 p-4">
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor={`edit-front-${card.id}`}
                        className="text-xs font-semibold text-gray-500 uppercase"
                      >
                        Przód
                      </label>
                      <textarea
                        id={`edit-front-${card.id}`}
                        className="mt-1 w-full resize-none rounded border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                        rows={2}
                        maxLength={500}
                        value={editFront}
                        onChange={(e) => {
                          setEditFront(e.target.value);
                        }}
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-back-${card.id}`} className="text-xs font-semibold text-gray-500 uppercase">
                        Tył
                      </label>
                      <textarea
                        id={`edit-back-${card.id}`}
                        className="mt-1 w-full resize-none rounded border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                        rows={2}
                        maxLength={500}
                        value={editBack}
                        onChange={(e) => {
                          setEditBack(e.target.value);
                        }}
                      />
                    </div>
                    {editError && (
                      <p role="alert" className="text-sm text-red-600">
                        {editError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!editFront.trim() || !editBack.trim() || saving}
                        onClick={() => void handleSaveEdit(card.id)}
                      >
                        {saving ? "Zapisywanie…" : "Zapisz"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        Anuluj
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }

            if (deletingId === card.id) {
              return (
                <div key={card.id} className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Przód</p>
                    <p className="text-sm text-gray-900">{card.front}</p>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Tył</p>
                    <p className="text-sm text-gray-900">{card.back}</p>
                  </div>
                  {deleteError && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      {deleteError}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-sm text-gray-700">Na pewno?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleting}
                      onClick={() => void handleConfirmDelete(card.id)}
                    >
                      {deleting ? "Usuwanie…" : "Tak"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDeletingId(null);
                      }}
                    >
                      Nie
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={card.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Przód</p>
                  <p className="text-sm text-gray-900">{card.front}</p>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Tył</p>
                  <p className="text-sm text-gray-900">{card.back}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      startEdit(card);
                    }}
                  >
                    Edytuj
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => {
                      startDelete(card.id);
                    }}
                  >
                    Usuń
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
