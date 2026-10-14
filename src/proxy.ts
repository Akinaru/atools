import { NextResponse, type NextRequest } from "next/server";
import { isUiAuthorized } from "@/lib/auth";

/** Protects the web UI (pages and Server Actions): without a session, pages redirect to /login. */
export function proxy(request: NextRequest) {
  if (isUiAuthorized(request)) return NextResponse.next();
  if (request.method !== "GET" && request.method !== "HEAD") return new NextResponse("Session expirée", { status: 401 });
  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the API, the login page, Next internals and public assets.
  matcher: ["/((?!api(?:/|$)|login(?:/|$)|_next/|favicon.ico|assets/).*)"],
};
