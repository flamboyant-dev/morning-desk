import { NextResponse } from "next/server";
import { readActiveRecording } from "@/lib/lock";
import { SAMPLE_RECORDINGS } from "@/lib/samples";
import { connectionStatus, loadRecordings } from "@/lib/store";

export async function GET() {
  try {
    const [recordings, active] = await Promise.all([
      loadRecordings(),
      readActiveRecording(),
    ]);
    const usingSamples = recordings.length === 0;
    const status = await connectionStatus();
    return NextResponse.json({
      recordings: usingSamples ? SAMPLE_RECORDINGS : recordings,
      usingSamples,
      recordingNow: Boolean(active),
      storage: status.storage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load recordings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
