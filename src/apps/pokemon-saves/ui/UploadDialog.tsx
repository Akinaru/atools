"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { isTyping, playSound } from "@/components/console/sound";
import { uploadSave } from "../server/actions";
import { GAMES } from "../games";

const field = "rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30";

/** "Add a save" button (X key) opening a console-style dialog. */
export function UploadDialog({ defaultGameId }: { defaultGameId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(uploadSave, {});
  const [fileDate, setFileDate] = useState("");

  const open = () => {
    playSound("select");
    dialog.current?.showModal();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isTyping(event) && (event.key === "x" || event.key === "X")) open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <button onClick={open} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm transition hover:scale-105 hover:shadow-md">
        + Ajouter une save
      </button>
      <dialog ref={dialog} className="pop-in m-auto w-[min(32rem,92vw)] rounded-3xl bg-white p-0 shadow-2xl backdrop:bg-black/30 backdrop:backdrop-blur-sm">
        <form action={action} className="grid gap-4 p-7">
          <h2 className="text-xl font-black">Ajouter une save</h2>
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
            Jeu
            <select name="gameId" defaultValue={defaultGameId ?? ""} required className={field}>
              <option value="" disabled>Choisir…</option>
              {[...new Set(GAMES.map((g) => g.gen))].map((gen) => (
                <optgroup key={gen} label={`Génération ${gen}`}>
                  {GAMES.filter((g) => g.gen === gen).map((g) => (
                    <option key={g.id} value={g.id}>Pokémon {g.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
            Fichier de save
            <input
              type="file"
              name="file"
              required
              onChange={(e) => setFileDate(String(e.target.files?.[0]?.lastModified ?? ""))}
              className="text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:font-bold file:text-zinc-700"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
            Nom (optionnel)
            <input name="label" placeholder="Ma partie principale" className={field} />
          </label>
          <input type="hidden" name="fileDate" value={fileDate} />
          {state.error && <p className="text-sm font-extrabold text-red-500">{state.error}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-full px-5 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100">
              Annuler
            </button>
            <button disabled={pending} className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow hover:brightness-105 disabled:opacity-50">
              {pending ? "Envoi…" : "Ajouter"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
