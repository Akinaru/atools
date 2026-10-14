"use client";

import { useActionState, useState } from "react";
import { replaceSave, type UploadState } from "../server/actions";

/** Replaces the save file; the previous one is kept in the versions. */
export function ReplaceForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(replaceSave.bind(null, id), {});
  const [fileDate, setFileDate] = useState("");
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        name="file"
        required
        onChange={(e) => setFileDate(String(e.target.files?.[0]?.lastModified ?? ""))}
        className="text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:font-bold file:text-zinc-700"
      />
      <input type="hidden" name="fileDate" value={fileDate} />
      <button disabled={pending} className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white shadow hover:brightness-105 disabled:opacity-50">
        {pending ? "Envoi…" : "Remplacer"}
      </button>
      {state.error && <p className="w-full text-sm font-extrabold text-red-500">{state.error}</p>}
      {state.message && <p className="w-full text-sm font-extrabold text-emerald-600">{state.message}</p>}
    </form>
  );
}
