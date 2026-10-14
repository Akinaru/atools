"use client";

import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

/** Ends the session. Hidden on the login screen. */
export function LogoutButton() {
  if (usePathname() === "/login") return null;
  return (
    <form action={logout}>
      <button title="Se déconnecter" className="flex h-14 items-center rounded-2xl bg-white/80 px-4 font-black shadow-sm backdrop-blur transition hover:scale-105">
        Déconnexion
      </button>
    </form>
  );
}
