"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase =
  | { state: "loading" }
  | { state: "empty" }
  | { state: "error"; message: string }
  | { state: "ready" };

export function LiveDesk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const media = video;
    let cancelled = false;
    let detach = () => {};

    async function start() {
      setPhase({ state: "loading" });
      try {
        const response = await fetch("/api/live/playlist", { cache: "no-store" });
        if (response.status === 404) {
          if (!cancelled) setPhase({ state: "empty" });
          return;
        }
        if (!response.ok) {
          const message = (await response.text()) || "The live stream did not open.";
          if (!cancelled) setPhase({ state: "error", message });
          return;
        }
        if (cancelled) return;
        const native = media.canPlayType("application/vnd.apple.mpegurl");
        if (native) {
          media.src = "/api/live/playlist";
          setPhase({ state: "ready" });
          return;
        }
        const { default: Hls } = await import("hls.js");
        if (!Hls.isSupported()) {
          setPhase({
            state: "error",
            message: "This browser cannot play the live stream.",
          });
          return;
        }
        const hls = new Hls({ enableWorker: false, lowLatencyMode: true });
        detach = () => hls.destroy();
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || cancelled) return;
          setPhase({
            state: "error",
            message: "Playback stopped. The stream may be offline, or it blocked this site.",
          });
        });
        hls.loadSource("/api/live/playlist");
        hls.attachMedia(media);
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
      detach();
      video.removeAttribute("src");
      video.load();
    };
  }, [attempt]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">Live</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">The stream</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            This plays the same address the morning job records. The desk stays locked
            behind your password.
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

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-black ring-1 ring-foreground/10",
          phase.state === "empty" || phase.state === "error" ? "hidden" : "",
        )}
      >
        <video
          ref={videoRef}
          controls
          playsInline
          className={cn(
            "aspect-video w-full bg-black",
            phase.state === "loading" ? "invisible" : "",
          )}
        >
          Your browser cannot play this stream.
        </video>
        {phase.state === "loading" ? (
          <div
            className="absolute inset-0 animate-pulse bg-muted"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="sr-only">Opening the stream</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
