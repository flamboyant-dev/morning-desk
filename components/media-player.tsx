import { DeskAudio, DeskPlayer } from "@/components/desk-player";
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
        <DeskPlayer key={video.url} src={video.url} kind="file" />
      ) : (
        <p className="text-sm text-muted-foreground">No video was stored for this take.</p>
      )}

      {audio?.url && !audio.driveId ? (
        <div>
          <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
            Audio
          </p>
          <DeskAudio key={audio.url} src={audio.url} title={audio.name} />
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
