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

/** Wait until 7:10 IST when the runner is at most 20 minutes early. */
export async function waitUntilWindow(
  log: (message: string) => void = console.log,
): Promise<void> {
  const now = istClockSeconds();
  const target = WINDOW_HOUR * 3600 + WINDOW_MINUTE * 60;
  const delta = target - now;
  if (delta <= 0) {
    log("It is already 7:10 IST or later, so recording starts now.");
    return;
  }
  if (delta > 20 * 60) {
    log(
      "The runner is more than 20 minutes early, so it will not wait overnight. Recording starts now.",
    );
    return;
  }
  log(`Waiting ${Math.ceil(delta / 60)} min until 7:10 IST.`);
  await new Promise((resolve) => setTimeout(resolve, delta * 1000));
}
