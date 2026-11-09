import { createHmac, timingSafeEqual } from "node:crypto";
import { adminPassword } from "@/lib/auth";

export const STREAM_COOKIE = "desk_stream";

function secret(): string {
  return adminPassword() || "morning";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signStreamCookie(url: string): string {
  const body = Buffer.from(url, "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readStreamCookie(value: string | undefined | null): string {
  if (!value) return "";
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return "";
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(body);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return "";
  try {
    return Buffer.from(body, "base64url").toString("utf8").trim().slice(0, 2000);
  } catch {
    return "";
  }
}
