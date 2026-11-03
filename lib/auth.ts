import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "desk_session";
const PAYLOAD = "desk-v1";
const DEV_PASSWORD = "morning";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function adminPassword(): string {
  const configured = env("ADMIN_PASSWORD");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return DEV_PASSWORD;
  return "";
}

export function usingDevPassword(): boolean {
  return env("ADMIN_PASSWORD") === "" && process.env.NODE_ENV !== "production";
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function passwordsMatch(input: string, expected: string): boolean {
  if (!expected) return false;
  return safeEqual(input, expected);
}

export function createSessionToken(): string {
  const secret = adminPassword();
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const body = `${PAYLOAD}.${exp}`;
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = adminPassword();
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [payload, expRaw, sig] = parts;
  if (payload !== PAYLOAD) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const body = `${payload}.${expRaw}`;
  return safeEqual(sig, sign(body, secret));
}

export function isRequestAuthed(request: Request): boolean {
  const header = request.headers.get("cookie") ?? "";
  const pair = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!pair) return false;
  const token = decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1));
  return verifySessionToken(token);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
