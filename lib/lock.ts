import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isVercel } from "@/lib/env";

const lockPath = path.join(process.cwd(), "data", "recording.lock");
const STALE_MS = 25 * 60 * 1000;

export type ActiveRecording = {
  id: string;
  startedAt: string;
};

export async function readActiveRecording(): Promise<ActiveRecording | null> {
  try {
    const raw = await readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as ActiveRecording;
    if (!parsed?.startedAt) return null;
    if (Date.now() - new Date(parsed.startedAt).getTime() > STALE_MS) {
      await clearActiveRecording();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeActiveRecording(id: string): Promise<void> {
  if (isVercel()) return;
  await mkdir(path.dirname(lockPath), { recursive: true });
  const payload: ActiveRecording = { id, startedAt: new Date().toISOString() };
  await writeFile(lockPath, JSON.stringify(payload));
}

export async function clearActiveRecording(): Promise<void> {
  await rm(lockPath, { force: true });
}
