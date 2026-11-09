import { createHmac, timingSafeEqual } from "node:crypto";
import { adminPassword } from "@/lib/auth";

export const STREAM_COOKIE = "desk_stream";

function secret(): string {
  return adminPassword() || "12345";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export type StreamSlots = {
  streamUrl: string;
  streamUrl2: string;
};

const EMPTY_SLOTS: StreamSlots = { streamUrl: "", streamUrl2: "" };

function clip(value: unknown): string {
  return String(value ?? "").trim().slice(0, 2000);
}

export function signStreamCookie(slots: StreamSlots): string {
  const body = Buffer.from(
    JSON.stringify({ streamUrl: clip(slots.streamUrl), streamUrl2: clip(slots.streamUrl2) }),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readStreamCookie(value: string | undefined | null): StreamSlots {
  if (!value) return EMPTY_SLOTS;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return EMPTY_SLOTS;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(body);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return EMPTY_SLOTS;
  try {
    const text = Buffer.from(body, "base64url").toString("utf8").trim();
    if (text.startsWith("{")) {
      const parsed = JSON.parse(text) as Partial<StreamSlots>;
      return { streamUrl: clip(parsed.streamUrl), streamUrl2: clip(parsed.streamUrl2) };
    }
    return { streamUrl: clip(text), streamUrl2: "" };
  } catch {
    return EMPTY_SLOTS;
  }
}
