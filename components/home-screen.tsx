"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Play } from "lucide-react";
import { formatDuration, formatIst } from "@/lib/time";
import type { Recording, RecordingsPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; recordings: Recording[]; usingSamples: boolean };

type Slide =
  | { kind: "live" }
  | { kind: "recording"; recording: Recording };

export function HomeScreen() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/recordings", { cache: "no-store" });
          const body = (await response.json()) as RecordingsPayload & { error?: string };
          if (!response.ok) {
            setLoad({ state: "error", message: body.error || "Could not open Morning." });
            return;
          }
          setLoad({
            state: "ready",
            recordings: body.recordings,
            usingSamples: body.usingSamples,
          });
        } catch {
          setLoad({
            state: "error",
            message: "Morning did not respond. Check the connection and try again.",
          });
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const recordings = load.state === "ready" ? load.recordings : [];
  const slides: Slide[] = [{ kind: "live" }, ...recordings.map((recording) => ({ kind: "recording" as const, recording }))];
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="bg-black text-white">
      {load.state === "loading" ? <HeroSkeleton /> : null}
      {load.state === "error" ? (
        <p className="px-4 py-16 text-sm text-zinc-400">{load.message}</p>
      ) : null}
      {load.state === "ready" && slide ? (
        <Hero
          slide={slide}
          count={slides.length}
          index={index}
          onSelect={setIndex}
        />
      ) : null}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between px-4">
          <h2 className="text-lg font-semibold">This morning</h2>
          <Link href="/library" className="text-sm text-zinc-400">
            Library
          </Link>
        </div>
        {load.state === "loading" ? <RailSkeleton /> : null}
        {load.state === "ready" ? (
          <div className="rail flex gap-3 overflow-x-auto px-4 pb-2">
            {recordings.map((recording) => (
              <PosterCard key={recording.id} recording={recording} />
            ))}
            {recordings.length === 0 ? (
              <p className="px-1 text-sm text-zinc-400">No clips yet. The next one is at 7:10 IST.</p>
            ) : null}
          </div>
        ) : null}
        {load.state === "ready" && load.usingSamples ? (
          <p className="px-4 pt-2 text-xs text-zinc-500">
            The card above is a sample until the first real morning take.
          </p>
        ) : null}
      </section>

      <section className="mt-8 pb-4">
        <h2 className="mb-3 px-4 text-lg font-semibold">Watch live</h2>
        <div className="px-4">
          <Link
            href="/live"
            className="flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-4 ring-1 ring-white/10"
          >
            <span>
              <span className="block text-base font-medium">Morning live</span>
              <span className="mt-1 block text-sm text-zinc-400">7:10 to 7:25 IST</span>
            </span>
            <span className="grid size-11 place-items-center rounded-xl bg-white/15">
              <Play className="size-5 fill-white" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Hero({
  slide,
  count,
  index,
  onSelect,
}: {
  slide: Slide;
  count: number;
  index: number;
  onSelect: (index: number) => void;
}) {
  const live = slide.kind === "live";
  const recording = slide.kind === "recording" ? slide.recording : null;
  const href = live ? "/live" : `/library?id=${recording?.id ?? ""}`;
  const title = live ? "Morning live" : formatIst(recording?.startedAt ?? "");
  const detail = live
    ? "The stream, playing now in the app."
    : recording?.sample
      ? "A short sample so you can try the player."
      : "Today’s 7:10 take, ready to play.";
  const meta = live ? "Live · 15 min" : `${formatDuration(recording?.durationSec ?? 0)} · Morning`;

  return (
    <section className="relative min-h-[48svh] overflow-hidden bg-zinc-950 md:min-h-[70svh]">
      {recording?.video?.url ? (
        <video
          key={recording.video.url}
          src={recording.video.url}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(232,176,74,0.35),transparent_42%),linear-gradient(180deg,#1a140c_0%,#050505_70%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/20" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-4 pb-8 md:px-10 md:pb-12">
        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-wide text-zinc-300 uppercase">
            {live ? "Live" : "Morning"}
          </p>
          <h1 className="mt-2 font-heading text-4xl leading-none tracking-tight md:text-6xl">
            {title}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-200">{detail}</p>
          <p className="mt-2 text-xs text-zinc-400">{meta}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3">
          {count > 1 ? (
            <button
              type="button"
              aria-label="Next"
              onClick={() => onSelect((index + 1) % count)}
              className="grid size-12 place-items-center rounded-xl bg-white/15 text-white backdrop-blur"
            >
              <ChevronRight className="size-6" />
            </button>
          ) : null}
          <Link
            href={href}
            aria-label={live ? "Play live" : "Play recording"}
            className="grid size-12 place-items-center rounded-xl bg-white/20 text-white backdrop-blur"
          >
            <Play className="size-6 fill-white" />
          </Link>
        </div>
      </div>
      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, dot) => (
            <button
              key={dot}
              type="button"
              aria-label={`Show slide ${dot + 1}`}
              onClick={() => onSelect(dot)}
              className={cn(
                "h-1.5 rounded-full",
                dot === index ? "w-5 bg-white" : "w-1.5 bg-white/40",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PosterCard({ recording }: { recording: Recording }) {
  return (
    <Link
      href={`/library?id=${recording.id}`}
      className="w-32 shrink-0 snap-start sm:w-40"
    >
      <span className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10">
        {recording.video?.url ? (
          <video
            src={recording.video.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 bg-[linear-gradient(160deg,#3a2a12,#111)]" />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <Play className="size-4 fill-white" />
        </span>
      </span>
      <span className="mt-2 block truncate text-sm font-medium">
        {recording.sample ? "Sample" : "Morning"}
      </span>
      <span className="block truncate text-xs text-zinc-400">
        {formatDuration(recording.durationSec)}
      </span>
    </Link>
  );
}

function HeroSkeleton() {
  return <div className="min-h-[48svh] animate-pulse bg-zinc-900 md:min-h-[70svh]" aria-busy="true" />;
}

function RailSkeleton() {
  return (
    <div className="flex gap-3 px-4" aria-busy="true">
      <div className="aspect-[2/3] w-32 animate-pulse rounded-xl bg-zinc-900" />
      <div className="aspect-[2/3] w-32 animate-pulse rounded-xl bg-zinc-900" />
      <div className="aspect-[2/3] w-32 animate-pulse rounded-xl bg-zinc-900" />
    </div>
  );
}
