"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const next = useSearchParams().get("next") ?? "/";
  return (
    <form action={action} className="mt-6 grid gap-4">
      <input type="hidden" name="next" value={next} />
      <input
        type="password"
        name="password"
        required
        autoFocus
        autoComplete="current-password"
        placeholder="Mot de passe"
        aria-label="Mot de passe"
        className="w-full rounded-2xl border-[3px] border-zinc-200 bg-zinc-50 px-5 py-3 text-center text-lg font-black outline-none transition placeholder:font-bold placeholder:text-zinc-400 focus:border-[var(--accent)] focus:bg-white"
      />
      {state.error && <p className="text-sm font-black text-red-500">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-full bg-[var(--accent)] px-6 py-3 text-lg font-black text-white shadow-[0_4px_0_#0089b6] transition hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#0089b6] disabled:opacity-50"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
