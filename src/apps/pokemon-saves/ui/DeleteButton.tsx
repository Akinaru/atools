"use client";

import { removeSave } from "../server/actions";

export function DeleteButton({ id }: { id: string }) {
  return (
    <button
      onClick={async () => {
        if (confirm("Supprimer définitivement cette save ?")) await removeSave(id);
      }}
      className="rounded-full bg-white px-4 py-2 text-sm font-bold text-red-500 shadow-sm transition hover:bg-red-500 hover:text-white"
    >
      Supprimer
    </button>
  );
}
