import { NextResponse } from "next/server";
import {
  adminPassword,
  createSessionToken,
  passwordsMatch,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  const expected = adminPassword();
  if (!expected) {
    return NextResponse.json(
      { error: "Set ADMIN_PASSWORD on the server before anyone can sign in." },
      { status: 503 },
    );
  }
  if (!passwordsMatch(password, expected)) {
    return NextResponse.json(
      { error: "That password does not match." },
      { status: 401 },
    );
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
  return response;
}
