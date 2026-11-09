"use client";

import "@videojs/react/audio/skin.css";
import "@videojs/react/video/skin.css";
import { Audio, AudioPlayer, AudioSkin } from "@videojs/react/audio";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { Video, VideoPlayer, VideoSkin } from "@videojs/react/video";

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
  return (
    <VideoPlayer>
      <VideoSkin className="desk-player" style={videoSkin}>
        {kind === "hls" ? (
          <HlsJsVideo
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
          <Video src={src} playsInline preload="metadata" />
        )}
      </VideoSkin>
    </VideoPlayer>
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
