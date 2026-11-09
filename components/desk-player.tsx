"use client";

import { useCallback, useRef, useState } from "react";
import "@videojs/react/audio/skin.css";
import "@videojs/react/video/skin.css";
import { Audio, AudioPlayer, AudioSkin } from "@videojs/react/audio";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { Video, VideoPlayer, VideoSkin } from "@videojs/react/video";
import { Button } from "@/components/ui/button";

const videoSkin = {
  width: "100%",
  aspectRatio: "16 / 9",
} as const;

const smoothHls = {
  lowLatencyMode: false,
  capLevelToPlayerSize: true,
  startFragPrefetch: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 90,
  backBufferLength: 60,
} as const;

export function DeskPlayer({
  src,
  kind,
  onError,
}: {
  src: string;
  kind: "hls" | "file";
  onError?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [soundOff, setSoundOff] = useState(false);
  const attach = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    if (!video) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      video.playsInline = true;
      const pending = video.play();
      if (!pending) return;
      pending.catch(() => {
        video.muted = true;
        setSoundOff(true);
        void video.play().catch(() => undefined);
      });
    };
    if (video.readyState >= 2) start();
    else video.addEventListener("canplay", start, { once: true });
  }, []);

  return (
    <div className="relative">
      <VideoPlayer>
        <VideoSkin className="desk-player" style={videoSkin}>
          {kind === "hls" ? (
            <HlsJsVideo
              ref={attach}
              autoPlay
              playsInline
              preload="auto"
              onError={onError}
              source={{
                src,
                type: "application/vnd.apple.mpegurl",
                preferPlayback: "mse",
                capRenditionToPlayerSize: true,
                engine: { hlsJs: smoothHls },
              }}
            />
          ) : (
            <Video ref={attach} src={src} autoPlay playsInline preload="auto" />
          )}
        </VideoSkin>
      </VideoPlayer>
      {soundOff ? (
        <Button
          type="button"
          className="absolute bottom-16 left-3 z-10 h-10"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.muted = false;
            setSoundOff(false);
            void video.play().catch(() => undefined);
          }}
        >
          Turn sound on
        </Button>
      ) : null}
    </div>
  );
}

export function DeskAudio({ src, title }: { src: string; title: string }) {
  return (
    <AudioPlayer title={title}>
      <AudioSkin className="desk-player desk-audio">
        <Audio src={src} preload="metadata" />
      </AudioSkin>
    </AudioPlayer>
  );
}
