import type { Recording } from "@/lib/types";

/** Stand-in clip so the player works before the first real morning take. */
export const SAMPLE_RECORDINGS: Recording[] = [
  {
    id: "sample-morning",
    startedAt: "2026-11-03T01:40:00.000Z",
    durationSec: 6,
    scheduled: true,
    status: "ready",
    sourceUrl: "https://example.com/live/index.m3u8",
    resolvedUrl: "https://example.com/live/index.m3u8",
    video: { name: "sample.mp4", url: "/samples/sample.mp4" },
    audio: { name: "sample.mp3", url: "/samples/sample.mp3" },
    telegramSent: false,
    telegramError: "Sample clip. Telegram is not used for samples.",
    sample: true,
  },
];
