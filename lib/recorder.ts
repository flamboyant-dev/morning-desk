import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clearActiveRecording, readActiveRecording, writeActiveRecording } from "@/lib/lock";
import { browserUserAgent, resolveStreamUrl } from "@/lib/resolve-stream";
import {
  assertCanStore,
  loadConfig,
  pruneRecordings,
  storeCapturedFiles,
  upsertRecording,
} from "@/lib/store";
import { env } from "@/lib/env";
import {
  sendTelegramAudio,
  sendTelegramMessage,
  sendTelegramVideo,
  telegramConfigured,
} from "@/lib/telegram";
import {
  DAILY_SECONDS,
  formatDuration,
  formatIst,
  recordingStamp,
  waitUntilWindow,
} from "@/lib/time";
import type { Recording } from "@/lib/types";

type Capture = { videoPath?: string; audioPath?: string };

function ffmpegBin(): string {
  return env("FFMPEG_PATH") || "ffmpeg";
}

function clampSeconds(seconds: number | undefined, scheduled: boolean): number {
  if (scheduled) return DAILY_SECONDS;
  const value = Number(seconds);
  if (!Number.isFinite(value)) return 30;
  return Math.min(900, Math.max(5, Math.round(value)));
}

function run(command: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 12_000) stderr = stderr.slice(-12_000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(tail(stderr) || `${command} timed out.`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        error.message.includes("ENOENT")
          ? new Error("ffmpeg is not installed on the recorder.")
          : error,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(tail(stderr) || `ffmpeg exited ${code}.`));
    });
  });
}

function tail(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" ");
}

async function nonempty(file: string, min = 800): Promise<boolean> {
  try {
    const info = await stat(file);
    return info.size >= min;
  } catch {
    return false;
  }
}

function inputArgs(playlist: string, seconds: number): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-rw_timeout",
    "15000000",
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_on_network_error",
    "1",
    "-reconnect_delay_max",
    "5",
    "-user_agent",
    browserUserAgent(),
    "-protocol_whitelist",
    "http,https,tcp,tls,crypto",
    "-allowed_extensions",
    "ALL",
    "-i",
    playlist,
    "-t",
    String(seconds),
  ];
}

async function capture(
  playlist: string,
  seconds: number,
  work: string,
  log: (message: string) => void,
): Promise<Capture> {
  const copied = path.join(work, "capture.ts");
  const videoPath = path.join(work, "clip.mp4");
  const audioPath = path.join(work, "clip.mp3");
  const captureTimeout = (seconds + 50) * 1000;
  const transcodeTimeout = Math.min(20 * 60 * 1000, seconds * 3000 + 60_000);

  log(`Recording ${formatDuration(seconds)} from the stream.`);
  let copiedOk = false;
  try {
    await run(
      ffmpegBin(),
      [...inputArgs(playlist, seconds), "-c", "copy", "-f", "mpegts", copied],
      captureTimeout,
    );
    copiedOk = await nonempty(copied);
  } catch (error) {
    log(
      `Stream copy did not finish (${error instanceof Error ? error.message : "unknown"}). Trying a direct encode.`,
    );
  }

  if (copiedOk) {
    try {
      await run(
        ffmpegBin(),
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          copied,
          "-vf",
          "scale=-2:720",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-b:v",
          "1000k",
          "-maxrate",
          "1200k",
          "-bufsize",
          "2000k",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          videoPath,
        ],
        transcodeTimeout,
      );
    } catch (error) {
      log(
        `Video transcode failed (${error instanceof Error ? error.message : "unknown"}). Keeping audio only.`,
      );
    }
    if (!(await nonempty(audioPath))) {
      const source = (await nonempty(videoPath)) ? videoPath : copied;
      await run(
        ffmpegBin(),
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          source,
          "-vn",
          "-c:a",
          "libmp3lame",
          "-b:a",
          "128k",
          audioPath,
        ],
        transcodeTimeout,
      ).catch(() => undefined);
    }
    if ((await nonempty(videoPath)) || (await nonempty(audioPath))) {
      return {
        videoPath: (await nonempty(videoPath)) ? videoPath : undefined,
        audioPath: (await nonempty(audioPath)) ? audioPath : undefined,
      };
    }
    throw new Error("The stream was captured, but it could not be turned into video or audio.");
  }

  try {
    await run(
      ffmpegBin(),
      [
        ...inputArgs(playlist, seconds),
        "-vf",
        "scale=-2:720",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-b:v",
        "1000k",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        videoPath,
      ],
      captureTimeout,
    );
  } catch (error) {
    log(
      `Direct video encode failed (${error instanceof Error ? error.message : "unknown"}). Trying audio only.`,
    );
  }

  if (await nonempty(videoPath)) {
    await run(
      ffmpegBin(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        videoPath,
        "-vn",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        audioPath,
      ],
      transcodeTimeout,
    ).catch(() => undefined);
    return {
      videoPath,
      audioPath: (await nonempty(audioPath)) ? audioPath : undefined,
    };
  }

  await run(
    ffmpegBin(),
    [
      ...inputArgs(playlist, seconds),
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      audioPath,
    ],
    captureTimeout,
  );
  if (!(await nonempty(audioPath))) {
    throw new Error("The recording finished without a video or audio file.");
  }
  return { audioPath };
}

const TELEGRAM_VIDEO_LIMIT = 45 * 1024 * 1024;

async function videoForTelegram(
  videoPath: string | undefined,
  work: string,
  seconds: number,
  log: (message: string) => void,
): Promise<string | undefined> {
  if (!videoPath || !(await nonempty(videoPath, 1))) return undefined;
  const current = await stat(videoPath);
  if (current.size <= TELEGRAM_VIDEO_LIMIT) return videoPath;
  const compact = path.join(work, "telegram.mp4");
  log("The full video is over Telegram's 50 MB limit. Making a smaller copy.");
  await run(
    ffmpegBin(),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-vf",
      "scale=640:-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-b:v",
      "280k",
      "-maxrate",
      "320k",
      "-bufsize",
      "640k",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      "-movflags",
      "+faststart",
      compact,
    ],
    Math.min(20 * 60 * 1000, seconds * 3000 + 60_000),
  ).catch((error: unknown) => {
    log(error instanceof Error ? error.message : "Could not shrink the video.");
  });
  if (!(await nonempty(compact))) return undefined;
  const shrunk = await stat(compact);
  if (shrunk.size <= TELEGRAM_VIDEO_LIMIT) return compact;
  log("The smaller video still does not fit on Telegram. Sending audio only.");
  return undefined;
}

async function deliverTelegram(
  recording: Recording,
  audioPath: string | undefined,
  videoPath: string | undefined,
  log: (message: string) => void,
): Promise<Recording> {
  if (!telegramConfigured()) {
    return {
      ...recording,
      telegramSent: false,
      telegramError: "Telegram is not connected.",
    };
  }
  const when = formatIst(recording.startedAt);
  const link = recording.video?.openUrl || recording.audio?.openUrl;
  const lines = [
    "Morning recording",
    `${when} IST · ${formatDuration(recording.durationSec)}`,
    link ? `Video: ${link}` : "Saved in this chat.",
  ];
  if (videoPath) {
    try {
      log("Sending video to Telegram.");
      await sendTelegramVideo({
        filePath: videoPath,
        filename: `${recording.id}.mp4`,
        caption: lines.join("\n"),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Telegram video failed.";
      log(`Telegram video failed (${message}).`);
    }
  }
  try {
    if (!audioPath) throw new Error("This recording has no audio track to send.");
    log("Sending audio to Telegram.");
    await sendTelegramAudio({
      filePath: audioPath,
      filename: recording.audio?.name || `${recording.id}.mp3`,
      caption: lines.join("\n"),
    });
    return { ...recording, telegramSent: true, telegramError: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram send failed.";
    log(`Telegram audio failed (${message}). Sending the link instead.`);
    try {
      await sendTelegramMessage(`${lines.join("\n")}\n\nAudio was not attached: ${message}`);
      return {
        ...recording,
        telegramSent: true,
        telegramError: message,
      };
    } catch (messageError) {
      return {
        ...recording,
        telegramSent: false,
        telegramError:
          messageError instanceof Error ? messageError.message : message,
      };
    }
  }
}

export async function record(options: {
  seconds?: number;
  scheduled?: boolean;
  waitForWindow?: boolean;
  sourceUrl?: string;
  log?: (message: string) => void;
}): Promise<Recording> {
  const log = options.log ?? ((message: string) => console.log(message));
  const active = await readActiveRecording();
  if (active) throw new Error("A recording is already running.");

  const scheduled = Boolean(options.scheduled);
  const seconds = clampSeconds(options.seconds, scheduled);
  const config = await loadConfig();
  const sourceUrl = (options.sourceUrl || env("STREAM_URL") || config.streamUrl).trim();
  const id = `${recordingStamp()}-${Math.random().toString(36).slice(2, 6)}`;
  await writeActiveRecording(id);

  let recording: Recording = {
    id,
    startedAt: new Date().toISOString(),
    durationSec: seconds,
    scheduled,
    status: "failed",
    sourceUrl,
    telegramSent: false,
  };
  const work = path.join(os.tmpdir(), "morning-desk", id);

  try {
    assertCanStore();
    if (!sourceUrl) {
      throw new Error("Add a stream URL in Settings before recording.");
    }
    if (options.waitForWindow) {
      const gate = await waitUntilWindow(log);
      if (gate === "missed") {
        log("No clip was saved for this run.");
        return { ...recording, status: "ready", error: undefined, durationSec: 0 };
      }
    }
    recording.startedAt = new Date().toISOString();
    log("Resolving the m3u8 address.");
    const resolved = await resolveStreamUrl(sourceUrl);
    recording.resolvedUrl = resolved;
    await mkdir(work, { recursive: true });
    const captured = await capture(resolved, seconds, work, log);
    if (!captured.videoPath && !captured.audioPath) {
      throw new Error("The recording finished without a video or audio file.");
    }
    log("Storing the recording.");
    const telegramVideo = await videoForTelegram(
      captured.videoPath,
      work,
      seconds,
      log,
    );
    recording = await storeCapturedFiles(recording, captured);
    recording.status = "ready";
    recording.error = undefined;
    await upsertRecording(recording);
    recording = await deliverTelegram(
      recording,
      captured.audioPath,
      telegramVideo,
      log,
    );
    await upsertRecording(recording);
    await pruneRecordings(config.retentionDays);
    log(`Saved ${recording.id}.`);
    return recording;
  } catch (error) {
    recording.status = "failed";
    recording.error = error instanceof Error ? error.message : "Recording failed.";
    log(recording.error);
    await upsertRecording(recording).catch(() => undefined);
    return recording;
  } finally {
    await rm(work, { recursive: true, force: true });
    await clearActiveRecording();
  }
}
