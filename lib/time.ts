export const IST = "Asia/Kolkata";
export const WINDOW_LABEL = "7:10–7:25 IST";
export const WINDOW_HOUR = 7;
export const WINDOW_MINUTE = 10;
export const DAILY_SECONDS = 15 * 60;

export function formatIst(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 sec";
  if (seconds < 90) return `${Math.round(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function istClockSeconds(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  let hour = read("hour");
  if (hour === 24) hour = 0;
  return hour * 3600 + read("minute") * 60 + read("second");
}

export function recordingStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  let hour = read("hour");
  if (hour === "24") hour = "00";
  return `${read("year")}${read("month")}${read("day")}-${hour}${read("minute")}${read("second")}`;
}

const MAX_EARLY_SECONDS = 110 * 60;
const MAX_LATE_SECONDS = 8 * 60;

/**
 * Wait until 7:10 IST.
 * Returns "ready" when recording should start, or "missed" when this run
 * is too early or already past the window.
 */
export async function waitUntilWindow(
  log: (message: string) => void = console.log,
): Promise<"ready" | "missed"> {
  const now = istClockSeconds();
  const target = WINDOW_HOUR * 3600 + WINDOW_MINUTE * 60;
  const delta = target - now;
  if (delta > MAX_EARLY_SECONDS) {
    log("This run is too early for 7:10 IST, so it will not record.");
    return "missed";
  }
  if (delta < -MAX_LATE_SECONDS) {
    log("7:10 IST has already passed, so this run will not record the wrong hour.");
    return "missed";
  }
  if (delta > 0) {
    log(`Waiting ${Math.ceil(delta / 60)} min until 7:10 IST.`);
    await new Promise((resolve) => setTimeout(resolve, delta * 1000));
  } else {
    log("It is 7:10 IST. Recording starts now.");
  }
  return "ready";
}
