import type { Recording } from "@/lib/types";

function drivePreview(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function MediaPlayer({ recording }: { recording: Recording }) {
  const video = recording.video;
  const audio = recording.audio;

  if (recording.status === "failed") {
    return (
      <p className="text-sm leading-6 text-destructive">
        {recording.error || "This take did not finish."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {video?.driveId ? (
        <iframe
          title={`Video ${video.name}`}
          src={drivePreview(video.driveId)}
          className="aspect-video w-full rounded-xl bg-black"
          allow="autoplay; fullscreen"
        />
      ) : video?.url ? (
        <video
          key={video.url}
          src={video.url}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-xl bg-black"
        >
          Your browser cannot play this video.
        </video>
      ) : (
        <p className="text-sm text-muted-foreground">No video was stored for this take.</p>
      )}

      {audio?.url && !audio.driveId ? (
        <div>
          <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
            Audio
          </p>
          <audio key={audio.url} src={audio.url} controls preload="metadata" className="w-full">
            Your browser cannot play this audio.
          </audio>
        </div>
      ) : null}

      {audio?.driveId && !video?.driveId ? (
        <iframe
          title={`Audio ${audio.name}`}
          src={drivePreview(audio.driveId)}
          className="h-48 w-full rounded-xl bg-black"
          allow="autoplay"
        />
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        {video?.openUrl ? (
          <a className="underline underline-offset-4" href={video.openUrl} target="_blank" rel="noreferrer">
            Open video in Drive
          </a>
        ) : null}
        {audio?.openUrl ? (
          <a className="underline underline-offset-4" href={audio.openUrl} target="_blank" rel="noreferrer">
            Open audio in Drive
          </a>
        ) : null}
      </div>
    </div>
  );
}
