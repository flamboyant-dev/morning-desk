import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const LOCKED_PAGES = ["/settings"];
const LOCKED_API = new Set([
  "/api/settings",
  "/api/trigger",
  "/api/drive/start",
  "/api/drive/callback",
]);

function isLocked(pathname: string): boolean {
  if (LOCKED_API.has(pathname)) return true;
  return LOCKED_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = verifySessionToken(token);

  if (isLocked(pathname) && !signedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/settings";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|samples/|icons/|sw.js|manifest.webmanifest).*)"],
};
