export type MediaAsset = {
  name: string;
  driveId?: string;
  /** Same-origin play URL, or a direct Drive download for audio. */
  url?: string;
  openUrl?: string;
};

export type Recording = {
  id: string;
  startedAt: string;
  durationSec: number;
  scheduled: boolean;
  status: "ready" | "failed";
  error?: string;
  sourceUrl: string;
  resolvedUrl?: string;
  video?: MediaAsset;
  audio?: MediaAsset;
  telegramSent: boolean;
  telegramError?: string;
  sample?: boolean;
};

export type DeskConfig = {
  streamUrl: string;
  retentionDays: number;
};

export const DEFAULT_CONFIG: DeskConfig = {
  streamUrl: "",
  retentionDays: 60,
};

export type ConnectionStatus = {
  drive: boolean;
  driveMode: "oauth" | "service-account" | "off";
  telegram: boolean;
  github: boolean;
  localRecord: boolean;
  schedule: string;
  storage: "drive" | "local";
};

export type RecordingsPayload = {
  recordings: Recording[];
  usingSamples: boolean;
  recordingNow: boolean;
  storage: "drive" | "local";
};
