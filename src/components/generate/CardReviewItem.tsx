import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface CardEntry {
  id: string;
  front: string;
  back: string;
  status: "pending" | "accepted" | "edited" | "rejected";
}

interface Props {
  card: CardEntry;
  onAccept: (id: string) => void;
  onEdit: (id: string, front: string, back: string) => void;
  onReject: (id: string) => void;
}

const borderByStatus: Record<CardEntry["status"], string> = {
  pending: "border-gray-200",
  accepted: "border-green-400 bg-green-50",
  edited: "border-blue-400 bg-blue-50",
  rejected: "border-gray-200 bg-gray-50 opacity-60",
};

export function CardReviewItem({ card, onAccept, onEdit, onReject }: Props) {
  const [editing, setEditing] = useState(false);
  const [editFront, setEditFront] = useState(card.front);
  const [editBack, setEditBack] = useState(card.back);

  function saveEdit() {
    onEdit(card.id, editFront, editBack);
    setEditing(false);
  }

  function cancelEdit() {
    setEditFront(card.front);
    setEditBack(card.back);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={cn("space-y-3 rounded-lg border-2 p-4", borderByStatus[card.status])}>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Przód</label>
          <textarea
            className="mt-1 w-full resize-none rounded border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            rows={2}
            value={editFront}
            onChange={(e) => {
              setEditFront(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Tył</label>
          <textarea
            className="mt-1 w-full resize-none rounded border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            rows={2}
            value={editBack}
            onChange={(e) => {
              setEditBack(e.target.value);
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={saveEdit}>
            Zapisz
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEdit}>
            Anuluj
          </Button>
        </div>
      </div>
    );
  }

  const isAccepted = card.status === "accepted" || card.status === "edited";

  return (
    <div className={cn("rounded-lg border-2 p-4", borderByStatus[card.status])}>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase">Przód</p>
        <p className={cn("text-sm text-gray-900", card.status === "rejected" && "line-through")}>{card.front}</p>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase">Tył</p>
        <p className={cn("text-sm text-gray-900", card.status === "rejected" && "line-through")}>{card.back}</p>
      </div>
      <div className="mt-3 flex gap-2">
        {isAccepted ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700">
            ✓ {card.status === "edited" ? "Edytowano" : "Zaakceptowano"}
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onAccept(card.id);
            }}
          >
            Akceptuj
          </Button>
        )}
        {card.status !== "rejected" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(true);
            }}
          >
            Edytuj
          </Button>
        )}
        {card.status !== "rejected" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700"
            onClick={() => {
              onReject(card.id);
            }}
          >
            Odrzuć
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onAccept(card.id);
            }}
          >
            Przywróć
          </Button>
        )}
      </div>
    </div>
  );
}
