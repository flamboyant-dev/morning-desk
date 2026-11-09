import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { driveConfigured } from "@/lib/drive";
import { isVercel } from "@/lib/env";
import { signStreamCookie, readStreamCookie, STREAM_COOKIE } from "@/lib/stream-cookie";
import { connectionStatus, loadConfig, normalizeConfig, saveConfig } from "@/lib/store";
import type { DeskConfig } from "@/lib/types";

async function browserStreams() {
  const jar = await cookies();
  return readStreamCookie(jar.get(STREAM_COOKIE)?.value);
}

export async function GET() {
  try {
    const config = await loadConfig(await browserStreams());
    return NextResponse.json({ config, status: connectionStatus() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<DeskConfig> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Settings were empty." }, { status: 400 });
  }
  const next = normalizeConfig({
    streamUrl: String(body.streamUrl ?? ""),
    streamUrl2: String(body.streamUrl2 ?? ""),
    retentionDays: Number(body.retentionDays),
  });
  try {
    if (isVercel() && !driveConfigured()) {
      const jar = await cookies();
      if (next.streamUrl || next.streamUrl2) {
        jar.set(STREAM_COOKIE, signStreamCookie(next), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        });
      } else {
        jar.delete(STREAM_COOKIE);
      }
      return NextResponse.json({
        config: next,
        status: connectionStatus(),
        message:
          "Saved in this browser. Live plays Stream 1 and switches to Stream 2 if Stream 1 does not start. The 7:10 job still uses Stream 1 from GitHub.",
      });
    }
    const config = await saveConfig(next);
    return NextResponse.json({
      config,
      status: connectionStatus(),
      message: "Saved. Live plays Stream 1 and switches to Stream 2 if Stream 1 does not start.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
