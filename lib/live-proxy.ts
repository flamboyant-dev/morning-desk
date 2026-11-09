import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { adminPassword } from "@/lib/auth";
import { browserUserAgent } from "@/lib/resolve-stream";

const TOKEN_TTL_MS = 3 * 60 * 1000;
const MAX_PLAYLIST_BYTES = 2_000_000;

function secret(): string {
  return adminPassword() || "morning";
}

function mac(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signMediaToken(target: string): string {
  const body = Buffer.from(
    JSON.stringify({ u: target, e: Date.now() + TOKEN_TTL_MS }),
    "utf8",
  ).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function readMediaToken(token: string): string {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new Error("That media link is not valid.");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = mac(body);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("That media link is not valid.");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
    u?: string;
    e?: number;
  };
  if (!parsed.u || !parsed.e || parsed.e < Date.now()) {
    throw new Error("That media link expired. Reload the player.");
  }
  return parsed.u;
}

export function rewritePlaylist(
  body: string,
  base: string,
  sign: (absolute: string) => string,
): string {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/\bURI="([^"]+)"/g, (_match, uri: string) => {
          return `URI="${sign(new URL(uri, base).toString())}"`;
        });
      }
      return sign(new URL(trimmed, base).toString());
    })
    .join("\n");
}

export function mediaProxyUrl(origin: string, target: string): string {
  const token = signMediaToken(target);
  return `${origin}/api/live/media?t=${encodeURIComponent(token)}`;
}

function isPrivateIp(ip: string): boolean {
  const mapped = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (mapped === "::1" || mapped === "0.0.0.0") return true;
  const version = isIP(mapped);
  if (version === 4) {
    const [a, b] = mapped.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (version === 6) {
    const head = mapped.toLowerCase();
    return (
      head === "::1" ||
      head.startsWith("fc") ||
      head.startsWith("fd") ||
      head.startsWith("fe80")
    );
  }
  return true;
}

export async function assertPublicUrl(target: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new Error("The stream returned a link this player cannot open.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The stream returned a link this player cannot open.");
  }
  if (url.username || url.password) {
    throw new Error("The stream returned a link this player cannot open.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new Error("The stream returned a link this player cannot open.");
    }
    return url;
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    !host.includes(".")
  ) {
    throw new Error("The stream returned a link this player cannot open.");
  }
  const records = await lookup(host, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("The stream returned a link this player cannot open.");
  }
  return url;
}

export async function fetchPublic(
  target: string,
  referer: string,
  hops = 0,
  range?: string | null,
): Promise<{ url: string; response: Response }> {
  const url = await assertPublicUrl(target);
  const headers: Record<string, string> = {
    "user-agent": browserUserAgent(),
    accept: "*/*",
    referer,
  };
  if (range) headers.range = range;
  const response = await fetch(url, {
    redirect: "manual",
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location || hops >= 4) {
      throw new Error("The stream redirected too many times.");
    }
    return fetchPublic(new URL(location, url).toString(), referer, hops + 1, range);
  }
  if (!response.ok) {
    throw new Error(`The stream did not open (${response.status}).`);
  }
  return { url: url.toString(), response };
}

export function isPlaylistResponse(url: string, contentType: string): boolean {
  const type = contentType.toLowerCase();
  if (type.includes("mpegurl") || type.includes("m3u8") || type.includes("mpegURL")) {
    return true;
  }
  const path = new URL(url).pathname.toLowerCase();
  return path.endsWith(".m3u8") || path.endsWith(".m3u");
}

export async function readPlaylist(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_PLAYLIST_BYTES) {
    throw new Error("That playlist is too large to play here.");
  }
  const text = await response.text();
  if (text.length > MAX_PLAYLIST_BYTES) {
    throw new Error("That playlist is too large to play here.");
  }
  if (!text.trimStart().startsWith("#EXTM3U")) {
    throw new Error("The stream did not return a playlist.");
  }
  return text;
}
