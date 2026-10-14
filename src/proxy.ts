import { NextResponse, type NextRequest } from "next/server";
import { isUiAuthorized } from "@/lib/auth";

/** Protects the web UI (pages and Server Actions) with Basic auth. The API checks its own key. */
export function proxy(request: NextRequest) {
  if (isUiAuthorized(request)) return NextResponse.next();
  return new NextResponse("Authentification requise", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="atools", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except the API, Next internals and public assets.
  matcher: ["/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|assets/).*)"],
};
