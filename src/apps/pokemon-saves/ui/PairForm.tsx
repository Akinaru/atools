"use client";

import { useActionState } from "react";
import { approveDevice, removeDevice, type UploadState } from "../server/actions";

export function PairForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(approveDevice, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input
        name="code"
        required
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={16}
        placeholder="K7M2QX"
        aria-label="Code d'appairage"
        className="w-48 rounded-2xl border-2 border-zinc-200 bg-white px-4 py-2 font-mono text-xl font-black uppercase tracking-[0.3em] outline-none focus:border-[var(--accent)]"
      />
      <button disabled={pending} className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white shadow hover:brightness-105 disabled:opacity-50">
        {pending ? "Validation…" : "Valider"}
      </button>
      {state.error && <p className="w-full text-sm font-extrabold text-red-500">{state.error}</p>}
      {state.message && <p className="w-full text-sm font-extrabold text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function RevokeButton({ id, name }: { id: string; name: string }) {
  return (
    <button
      onClick={async () => {
        if (confirm(`Révoquer « ${name} » ? Sa clé ne fonctionnera plus.`)) await removeDevice(id);
      }}
      className="rounded-full bg-white px-4 py-2 text-sm font-bold text-red-500 shadow-sm transition hover:bg-red-500 hover:text-white"
    >
      Révoquer
    </button>
  );
}
