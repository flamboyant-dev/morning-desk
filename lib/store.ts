import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  deleteDriveFile,
  driveConfigured,
  driveDownloadUrl,
  driveMode,
  driveViewUrl,
  readDriveJson,
  shareAnyone,
  uploadLocalFile,
  writeDriveJson,
} from "@/lib/drive";
import { env, isGitHubActions, isVercel } from "@/lib/env";
import { STREAM_1, STREAM_2 } from "@/lib/streams";
import { telegramConfigured } from "@/lib/telegram";
import { WINDOW_LABEL } from "@/lib/time";
import {
  DEFAULT_CONFIG,
  type ConnectionStatus,
  type DeskConfig,
  type Recording,
} from "@/lib/types";
import { githubDispatchConfigured } from "@/lib/github";

export const dataDir = path.join(process.cwd(), "data");
export const mediaDir = path.join(dataDir, "media");
const configPath = path.join(dataDir, "config.json");
const recordingsPath = path.join(dataDir, "recordings.json");

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

export function safeRecordingId(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error("That recording id is not valid.");
  return id;
}

export function connectionStatus(): ConnectionStatus {
  const drive = driveConfigured();
  return {
    drive,
    driveMode: driveMode(),
    telegram: telegramConfigured(),
    github: githubDispatchConfigured(),
    localRecord: !isVercel(),
    storage: drive ? "drive" : "local",
    schedule: `Every morning, ${WINDOW_LABEL}`,
  };
}

export function normalizeConfig(input: Partial<DeskConfig> | null | undefined): DeskConfig {
  const retention = Number(input?.retentionDays ?? DEFAULT_CONFIG.retentionDays);
  const retentionDays = Number.isFinite(retention)
    ? Math.min(365, Math.max(7, Math.round(retention)))
    : DEFAULT_CONFIG.retentionDays;
  const streamUrl = String(input?.streamUrl ?? "").trim().slice(0, 2000);
  const streamUrl2 = String(input?.streamUrl2 ?? "").trim().slice(0, 2000);
  return { streamUrl, streamUrl2, retentionDays };
}

export function streamBySlot(config: DeskConfig, slot: 1 | 2): string {
  return slot === 2 ? config.streamUrl2 : config.streamUrl;
}

async function readLocalJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function loadConfig(
  browser?: Partial<Pick<DeskConfig, "streamUrl" | "streamUrl2">>,
): Promise<DeskConfig> {
  const stored = driveConfigured()
    ? await readDriveJson<DeskConfig>("config.json")
    : await readLocalJson<DeskConfig>(configPath);
  let config = normalizeConfig(stored);
  if (!config.streamUrl && browser?.streamUrl) {
    config = normalizeConfig({ ...config, streamUrl: browser.streamUrl });
  }
  if (!config.streamUrl2 && browser?.streamUrl2) {
    config = normalizeConfig({ ...config, streamUrl2: browser.streamUrl2 });
  }
  if (!config.streamUrl) config = normalizeConfig({ ...config, streamUrl: env("STREAM_URL") });
  if (!config.streamUrl2) config = normalizeConfig({ ...config, streamUrl2: env("STREAM_URL_2") });
  if (STREAM_1.trim()) config = normalizeConfig({ ...config, streamUrl: STREAM_1 });
  if (STREAM_2.trim()) config = normalizeConfig({ ...config, streamUrl2: STREAM_2 });
  return config;
}

export async function saveConfig(input: DeskConfig): Promise<DeskConfig> {
  const next = normalizeConfig(input);
  if (driveConfigured()) {
    await writeDriveJson("config.json", next);
    return next;
  }
  if (isVercel() || isGitHubActions()) {
    throw new Error(
      "Connect Google Drive to save settings. This host has nowhere else to keep them.",
    );
  }
  await mkdir(dataDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(next, null, 2));
  return next;
}

export async function loadRecordings(): Promise<Recording[]> {
  const raw = driveConfigured()
    ? await readDriveJson<Recording[]>("recordings.json")
    : await readLocalJson<Recording[]>(recordingsPath);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => item && typeof item.id === "string" && !item.sample);
}

export async function saveRecordings(recordings: Recording[]): Promise<void> {
  const clean = recordings.filter((item) => !item.sample);
  if (driveConfigured()) {
    await writeDriveJson("recordings.json", clean);
    return;
  }
  if (isVercel() || (isGitHubActions() && !telegramConfigured())) {
    throw new Error(
      "Connect Google Drive before storing recordings. A normal Gmail folder needs your own login, not a service account.",
    );
  }
  if (isGitHubActions()) return;
  await mkdir(dataDir, { recursive: true });
  await writeFile(recordingsPath, JSON.stringify(clean, null, 2));
}

export async function upsertRecording(recording: Recording): Promise<void> {
  const all = await loadRecordings();
  const next = [recording, ...all.filter((item) => item.id !== recording.id)];
  await saveRecordings(next);
}

export function assertCanStore(): void {
  if (driveConfigured()) return;
  if (isGitHubActions() && telegramConfigured()) return;
  if (isVercel() || isGitHubActions()) {
    throw new Error(
      "Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to the GitHub Actions secrets. The runner does not keep files on its own.",
    );
  }
}

export async function storeCapturedFiles(
  recording: Recording,
  files: { videoPath?: string; audioPath?: string },
): Promise<Recording> {
  const next: Recording = { ...recording, video: undefined, audio: undefined };
  if (driveConfigured()) {
    if (files.videoPath) {
      const name = `${recording.id}.mp4`;
      const id = await uploadLocalFile(files.videoPath, name, "video/mp4");
      await shareAnyone(id);
      next.video = { name, driveId: id, openUrl: driveViewUrl(id) };
    }
    if (files.audioPath) {
      const name = `${recording.id}.mp3`;
      const id = await uploadLocalFile(files.audioPath, name, "audio/mpeg");
      await shareAnyone(id);
      next.audio = {
        name,
        driveId: id,
        url: driveDownloadUrl(id),
        openUrl: driveViewUrl(id),
      };
    }
    return next;
  }

  await mkdir(mediaDir, { recursive: true });
  if (files.videoPath) {
    const name = `${safeRecordingId(recording.id)}.mp4`;
    await copyFile(files.videoPath, path.join(mediaDir, name));
    next.video = {
      name,
      url: `/api/media?id=${encodeURIComponent(recording.id)}&kind=video`,
    };
  }
  if (files.audioPath) {
    const name = `${safeRecordingId(recording.id)}.mp3`;
    await copyFile(files.audioPath, path.join(mediaDir, name));
    next.audio = {
      name,
      url: `/api/media?id=${encodeURIComponent(recording.id)}&kind=audio`,
    };
  }
  return next;
}

export function mediaFilePath(id: string, kind: "video" | "audio"): string {
  const safe = safeRecordingId(id);
  return path.join(mediaDir, `${safe}.${kind === "audio" ? "mp3" : "mp4"}`);
}

export async function deleteRecordingFiles(recording: Recording): Promise<void> {
  if (recording.video?.driveId) {
    await deleteDriveFile(recording.video.driveId).catch(() => undefined);
  }
  if (recording.audio?.driveId) {
    await deleteDriveFile(recording.audio.driveId).catch(() => undefined);
  }
  if (!SAFE_ID.test(recording.id)) return;
  await rm(path.join(mediaDir, `${recording.id}.mp4`), { force: true });
  await rm(path.join(mediaDir, `${recording.id}.mp3`), { force: true });
}

export async function pruneRecordings(retentionDays: number): Promise<void> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const all = await loadRecordings();
  const keep: Recording[] = [];
  for (const recording of all) {
    const started = new Date(recording.startedAt).getTime();
    if (Number.isFinite(started) && started < cutoff) {
      await deleteRecordingFiles(recording);
      continue;
    }
    keep.push(recording);
  }
  if (keep.length !== all.length) await saveRecordings(keep);
}
