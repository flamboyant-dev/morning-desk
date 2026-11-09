import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readStreamCookie, STREAM_COOKIE } from "@/lib/stream-cookie";
import { loadConfig } from "@/lib/store";

export async function GET() {
  const jar = await cookies();
  const config = await loadConfig(readStreamCookie(jar.get(STREAM_COOKIE)?.value));
  return NextResponse.json({
    servers: [
      { id: 1, label: "Stream 1", ready: Boolean(config.streamUrl) },
      { id: 2, label: "Stream 2", ready: Boolean(config.streamUrl2) },
    ],
  });
}
