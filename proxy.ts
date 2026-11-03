import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC_PAGES = new Set(["/login"]);
const PUBLIC_API = new Set(["/api/login", "/api/session"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = verifySessionToken(token);
  const isApi = pathname.startsWith("/api/");
  const isPublic = PUBLIC_PAGES.has(pathname) || PUBLIC_API.has(pathname);

  if (!signedIn && !isPublic) {
    if (isApi) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|samples/).*)"],
};
