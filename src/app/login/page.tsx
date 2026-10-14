import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion · atools" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-8">
      <div className="pop-in w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-[0_8px_40px_rgba(0,0,0,0.10)]">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent)] text-5xl font-black text-white shadow-[0_0_0_6px_white,0_0_0_10px_var(--accent)]">
          a
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-tight">Connexion</h1>
        <p className="mt-1 text-sm font-bold text-zinc-500">Entre le mot de passe pour ouvrir atools.</p>
        {/* Reads ?next=, so it renders at request time. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
