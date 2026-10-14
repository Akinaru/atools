"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSessionToken, isUiOpen, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { clientIp, hit, underLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string };

/** Only a local path: "/apps/x" yes, "//evil.com" or "https://…" no. */
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/");

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const next = safeNext(String(formData.get("next") ?? "/"));
  if (isUiOpen()) redirect(next);

  const key = `login:${clientIp(await headers())}`;
  if (!underLimit(key, 5)) return { error: "Trop d'essais. Réessaie dans une minute." };
  if (!checkPassword(String(formData.get("password") ?? ""))) {
    hit(key);
    return { error: "Mot de passe incorrect." };
  }
  (await cookies()).set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
