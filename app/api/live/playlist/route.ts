import { cookies } from "next/headers";
import {
  fetchPublic,
  isPlaylistResponse,
  mediaProxyUrl,
  readPlaylist,
  rewritePlaylist,
} from "@/lib/live-proxy";
import { resolveStreamUrl } from "@/lib/resolve-stream";
import { readStreamCookie, STREAM_COOKIE } from "@/lib/stream-cookie";
import { loadConfig, streamBySlot } from "@/lib/store";

export const maxDuration = 60;

function originOf(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) return `${forwardedProto || "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  try {
    const jar = await cookies();
    const config = await loadConfig(readStreamCookie(jar.get(STREAM_COOKIE)?.value));
    const requested = new URL(request.url).searchParams.get("server");
    const slot = requested === "2" ? 2 : 1;
    const source = streamBySlot(config, slot);
    if (!source) {
      return new Response(`Add Stream ${slot} in Settings.`, { status: 404 });
    }
    const resolved = await resolveStreamUrl(source);
    const fetched = await fetchPublic(resolved, source);
    if (!isPlaylistResponse(fetched.url, fetched.response.headers.get("content-type") ?? "")) {
      throw new Error("The stream did not return a playlist.");
    }
    const playlist = await readPlaylist(fetched.response);
    const origin = originOf(request);
    const rewritten = rewritePlaylist(playlist, fetched.url, (absolute) =>
      mediaProxyUrl(origin, absolute, source),
    );
    return new Response(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The live stream did not open.";
    return new Response(message, { status: 502 });
  }
}
