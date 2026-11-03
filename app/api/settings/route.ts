import { NextResponse } from "next/server";
import { connectionStatus, loadConfig, saveConfig } from "@/lib/store";
import type { DeskConfig } from "@/lib/types";

export async function GET() {
  try {
    const config = await loadConfig();
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
  try {
    const config = await saveConfig({
      streamUrl: String(body.streamUrl ?? ""),
      retentionDays: Number(body.retentionDays),
    });
    return NextResponse.json({ config, status: connectionStatus() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
