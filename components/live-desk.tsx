"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DeskPlayer } from "@/components/desk-player";

type ServerId = 1 | 2;

type Phase =
  | { state: "loading" }
  | { state: "empty" }
  | { state: "error"; message: string }
  | { state: "ready" };

type ServerList = Record<ServerId, boolean>;

export function LiveDesk() {
  const [servers, setServers] = useState<ServerList | null>(null);
  const [server, setServer] = useState<ServerId>(1);
  const [phase, setPhase] = useState<Phase>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState("");
  const switched = useRef(false);
  const serversRef = useRef<ServerList | null>(null);
  serversRef.current = servers;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/live/servers", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { servers?: { id: ServerId; ready: boolean }[] }) => {
        if (cancelled) return;
        const ready: ServerList = { 1: false, 2: false };
        for (const item of body.servers ?? []) {
          if (item.id === 1 || item.id === 2) ready[item.id] = Boolean(item.ready);
        }
        setServers(ready);
        setServer(ready[1] ? 1 : 2);
      })
      .catch(() => {
        if (!cancelled) {
          setServers({ 1: false, 2: false });
          setPhase({
            state: "error",
            message: "The stream list did not load. Check the connection and try again.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!servers) return;
    if (!servers[1] && !servers[2]) {
      setPhase({ state: "empty" });
      return;
    }
    if (!servers[server]) return;

    let cancelled = false;

    async function start() {
      setPhase({ state: "loading" });
      try {
        const response = await fetch(`/api/live/playlist?server=${server}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
        if (cancelled) return;
        if (!response.ok) {
          const message = (await response.text()) || "The live stream did not open.";
          switchAway(server, message);
          return;
        }
        setPhase({ state: "ready" });
      } catch {
        if (!cancelled) switchAway(server, "The live stream did not respond.");
      }
    }

    function switchAway(current: ServerId, message: string) {
      const ready = serversRef.current;
      const other: ServerId = current === 1 ? 2 : 1;
      if (ready?.[other] && !switched.current) {
        switched.current = true;
        setNote(`Stream ${current} is not working. Switched to Stream ${other}.`);
        setServer(other);
        return;
      }
      setPhase({ state: "error", message });
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [servers, server, attempt]);

  function choose(next: ServerId) {
    switched.current = false;
    setNote("");
    setServer(next);
    setAttempt((value) => value + 1);
  }

  function onPlaybackError() {
    const other: ServerId = server === 1 ? 2 : 1;
    if (serversRef.current?.[other] && !switched.current) {
      switched.current = true;
      setNote(`Stream ${server} is not working. Switched to Stream ${other}.`);
      setServer(other);
      return;
    }
    setPhase({
      state: "error",
      message: "Both streams failed. Reload, or check the addresses in Settings.",
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-4 md:px-8 md:pt-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">Live</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">The stream</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Stream 1 plays first. If it does not start, the player switches to Stream 2.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => choose(server)}
          disabled={phase.state === "loading"}
        >
          Reload
        </Button>
      </header>

      {phase.state === "empty" ? (
        <Alert>
          <AlertTitle>No stream address yet</AlertTitle>
          <AlertDescription>
            Add Stream 1 and Stream 2 in Settings. Live uses those addresses.
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
        <DeskPlayer
          key={`${server}-${attempt}`}
          src={`/api/live/playlist?server=${server}`}
          kind="hls"
          onError={onPlaybackError}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-11"
            variant={server === 1 ? "default" : "outline"}
            disabled={!servers?.[1] || phase.state === "loading"}
            onClick={() => choose(1)}
          >
            Stream 1
          </Button>
          <Button
            className="h-11"
            variant={server === 2 ? "default" : "outline"}
            disabled={!servers?.[2] || phase.state === "loading"}
            onClick={() => choose(2)}
          >
            Stream 2
          </Button>
        </div>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        <p className="text-xs leading-5 text-muted-foreground">
          Add both addresses in Settings. Space plays, the arrows seek, M mutes, F is
          fullscreen, and I floats the picture.
        </p>
      </div>
    </div>
  );
}
