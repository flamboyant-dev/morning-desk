import { env } from "../lib/env";
import { record } from "../lib/recorder";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function has(name: string): boolean {
  return process.argv.includes(name);
}

const secondsRaw = arg("--seconds") ?? env("RECORD_SECONDS");
const seconds = secondsRaw ? Number(secondsRaw) : undefined;
const scheduled = env("SCHEDULED") === "1" && !has("--now");
const waitForWindow =
  (scheduled || env("WAIT_FOR_WINDOW") === "1") && !has("--now");

record({
  seconds,
  scheduled,
  waitForWindow,
  sourceUrl: arg("--url") || env("STREAM_URL") || undefined,
})
  .then((recording) => {
    console.log(
      JSON.stringify(
        {
          id: recording.id,
          status: recording.status,
          error: recording.error,
          telegramSent: recording.telegramSent,
          startedAt: recording.startedAt,
        },
        null,
        2,
      ),
    );
    if (recording.status === "failed") process.exitCode = 1;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
