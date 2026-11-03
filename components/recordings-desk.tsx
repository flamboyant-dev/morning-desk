"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaPlayer } from "@/components/media-player";
import { formatDuration, formatIst } from "@/lib/time";
import type { Recording, RecordingsPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: RecordingsPayload };

export function RecordingsDesk() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/recordings", { cache: "no-store" });
      const body = (await response.json()) as RecordingsPayload & { error?: string };
      if (!response.ok) {
        setLoad({ state: "error", message: body.error || "Could not load recordings." });
        return;
      }
      setLoad({ state: "ready", data: body });
      setSelectedId((current) => {
        if (current && body.recordings.some((item) => item.id === current)) return current;
        return body.recordings[0]?.id ?? null;
      });
    } catch {
      setLoad({
        state: "error",
        message: "The archive did not respond. Check the connection and try again.",
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const recordingNow = load.state === "ready" && load.data.recordingNow;

  useEffect(() => {
    if (!recordingNow) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [recordingNow, refresh]);

  const selected =
    load.state === "ready"
      ? load.data.recordings.find((item) => item.id === selectedId) ??
        load.data.recordings[0]
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">Archive</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">This morning&apos;s reel</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            A new clip lands every day at 7:10 IST. Video stays in Drive. Audio goes to Telegram.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={load.state === "loading"}>
          Refresh
        </Button>
      </header>

      {load.state === "loading" ? <LoadingState /> : null}
      {load.state === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>The archive did not open</AlertTitle>
          <AlertDescription>{load.message}</AlertDescription>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      {load.state === "ready" && load.data.recordingNow ? (
        <Alert>
          <AlertTitle>Recording now</AlertTitle>
          <AlertDescription>
            This page refreshes on its own when the file is ready. You can leave it open.
          </AlertDescription>
        </Alert>
      ) : null}

      {load.state === "ready" && load.data.usingSamples ? (
        <Alert>
          <AlertTitle>Nothing recorded yet</AlertTitle>
          <AlertDescription>
            This six-second clip is a stand-in so you can try the player. Tomorrow&apos;s 7:10
            take replaces it. Set the stream under Settings, then use Record now if you want a
            test before morning.
          </AlertDescription>
        </Alert>
      ) : null}

      {load.state === "ready" && load.data.recordings.length === 0 ? (
        <EmptyState />
      ) : null}

      {load.state === "ready" && selected ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="flex flex-col gap-2" aria-label="Recordings">
            {load.data.recordings.map((item) => (
              <li key={item.id}>
                <RecordingRow
                  recording={item}
                  selected={item.id === selected.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              </li>
            ))}
          </ul>
          <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 md:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-2xl">{formatIst(selected.startedAt)} IST</h2>
              <Badge variant="outline">{formatDuration(selected.durationSec)}</Badge>
              <StatusBadge recording={selected} />
            </div>
            {selected.telegramError && !selected.telegramSent ? (
              <p className="mb-4 text-sm text-muted-foreground">{selected.telegramError}</p>
            ) : null}
            <MediaPlayer recording={selected} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function RecordingRow({
  recording,
  selected,
  onSelect,
}: {
  recording: Recording;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-xl px-3 py-3 text-left ring-1 ring-foreground/10 transition-colors",
        selected ? "bg-primary/15 ring-primary/50" : "bg-card hover:bg-muted",
      )}
    >
      <span className="block text-sm font-medium">{formatIst(recording.startedAt)}</span>
      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDuration(recording.durationSec)}</span>
        <StatusBadge recording={recording} />
      </span>
    </button>
  );
}

function StatusBadge({ recording }: { recording: Recording }) {
  if (recording.sample) return <Badge variant="secondary">Sample</Badge>;
  if (recording.status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (recording.telegramSent) return <Badge variant="outline">Sent to Telegram</Badge>;
  return <Badge variant="secondary">Not sent</Badge>;
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="aspect-video animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-card px-5 py-10 text-center ring-1 ring-foreground/10">
      <h2 className="font-heading text-2xl">The shelf is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        The next capture is at 7:10 IST. Add the stream URL in Settings if it is not there yet.
      </p>
    </div>
  );
}
