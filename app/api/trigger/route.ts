import { NextResponse } from "next/server";
import { isVercel } from "@/lib/env";
import { dispatchTestRecording, githubDispatchConfigured } from "@/lib/github";
import { readActiveRecording } from "@/lib/lock";
import { record } from "@/lib/recorder";
import { loadConfig } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { seconds?: unknown };
  const requested = Number(body.seconds ?? 30);
  const seconds = Number.isFinite(requested)
    ? Math.min(90, Math.max(5, Math.round(requested)))
    : 30;

  try {
    const config = await loadConfig();
    if (!config.streamUrl.trim()) {
      return NextResponse.json(
        { error: "Add a stream URL in Settings before recording." },
        { status: 400 },
      );
    }
    if (await readActiveRecording()) {
      return NextResponse.json(
        { error: "A recording is already running." },
        { status: 409 },
      );
    }

    if (githubDispatchConfigured()) {
      await dispatchTestRecording(seconds);
      return NextResponse.json({
        mode: "github",
        message: `GitHub Actions is recording ${seconds} seconds. The clip shows up here after it lands in Drive, usually a few minutes.`,
      });
    }

    if (isVercel()) {
      return NextResponse.json(
        {
          error:
            "Record now needs GITHUB_DISPATCH_TOKEN and GITHUB_REPOSITORY on the hosted site. The 7:10 job uses the same GitHub Action.",
        },
        { status: 400 },
      );
    }

    void record({ seconds, scheduled: false, waitForWindow: false }).catch((error) => {
      console.error(error instanceof Error ? error.message : error);
    });
    return NextResponse.json({
      mode: "local",
      message: `Recording on this machine for ${seconds} seconds. Open the archive and it will refresh when the file is ready.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start a recording.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
