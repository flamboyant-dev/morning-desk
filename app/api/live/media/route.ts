import {
  fetchPublic,
  isPlaylistResponse,
  mediaProxyUrl,
  readMediaToken,
  readPlaylist,
  rewritePlaylist,
} from "@/lib/live-proxy";

export const maxDuration = 60;

function originOf(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) return `${forwardedProto || "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  try {
    const media = readMediaToken(token);
    const target = media.url;
    const referer = media.referer;
    const range = request.headers.get("range");
    const fetched = await fetchPublic(target, referer, 0, range);
    const type = fetched.response.headers.get("content-type") ?? "application/octet-stream";
    if (!range) {
      const length = Number(fetched.response.headers.get("content-length") || 0);
      if (length > 25_000_000) {
        throw new Error("That stream file is too large to play here.");
      }
    }
    if (isPlaylistResponse(fetched.url, type)) {
      const playlist = await readPlaylist(fetched.response);
      const origin = originOf(request);
      const rewritten = rewritePlaylist(playlist, fetched.url, (absolute) =>
        mediaProxyUrl(origin, absolute, referer),
      );
      return new Response(rewritten, {
        headers: {
          "content-type": "application/vnd.apple.mpegurl",
          "cache-control": "private, no-store",
        },
      });
    }
    const headers = new Headers();
    headers.set("content-type", type.split(";")[0] || "application/octet-stream");
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "private, max-age=30");
    const length = fetched.response.headers.get("content-length");
    const contentRange = fetched.response.headers.get("content-range");
    if (length) headers.set("content-length", length);
    if (contentRange) headers.set("content-range", contentRange);
    return new Response(fetched.response.body, {
      status: fetched.response.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "That part of the stream did not open.";
    return new Response(message, { status: 502 });
  }
}
