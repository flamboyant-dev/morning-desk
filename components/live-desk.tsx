"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DeskPlayer } from "@/components/desk-player";

type Phase =
  | { state: "loading" }
  | { state: "empty" }
  | { state: "error"; message: string }
  | { state: "ready" };

export function LiveDesk() {
  const [phase, setPhase] = useState<Phase>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setPhase({ state: "loading" });
      try {
        const response = await fetch("/api/live/playlist", { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 404) {
          setPhase({ state: "empty" });
          return;
        }
        if (!response.ok) {
          const message = (await response.text()) || "The live stream did not open.";
          setPhase({ state: "error", message });
          return;
        }
        setPhase({ state: "ready" });
      } catch {
        if (!cancelled) {
          setPhase({
            state: "error",
            message: "The live stream did not respond. Check the connection and try again.",
          });
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">Live</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">The stream</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Quality, speed, captions, and picture-in-picture sit in the player. It keeps a
            buffer so the picture stays smooth.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
          disabled={phase.state === "loading"}
        >
          Reload
        </Button>
      </header>

      {phase.state === "empty" ? (
        <Alert>
          <AlertTitle>No stream address yet</AlertTitle>
          <AlertDescription>
            Add the page or the .m3u8 link in Settings. Live uses that address.
          </AlertDescription>
          <div className="mt-3">
            <Button nativeButton={false} render={<Link href="/settings" />} size="sm">
              Open settings
            </Button>
          </div>
        </Alert>
      ) : null}

      {phase.state === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>The stream did not start</AlertTitle>
          <AlertDescription>{phase.message}</AlertDescription>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      {phase.state === "loading" ? (
        <div
          className="aspect-video w-full animate-pulse rounded-2xl bg-muted"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="sr-only">Opening the stream</p>
        </div>
      ) : null}

      {phase.state === "ready" ? (
        <div className="flex flex-col gap-3">
          <DeskPlayer key={attempt} src="/api/live/playlist" kind="hls" />
          <p className="text-xs leading-5 text-muted-foreground">
            Space plays, the arrows seek, M mutes, F is fullscreen, and I floats the picture.
            Open the settings gear for quality and speed.
          </p>
        </div>
      ) : null}
    </div>
  );
}
