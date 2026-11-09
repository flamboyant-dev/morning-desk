"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WINDOW_LABEL } from "@/lib/time";
import type { ConnectionStatus, DeskConfig } from "@/lib/types";

type Payload = { config: DeskConfig; status: ConnectionStatus; driveRedirect?: string };

export function SettingsDesk() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [streamUrl2, setStreamUrl2] = useState("");
  const [retentionDays, setRetentionDays] = useState("60");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");
  const [triggerError, setTriggerError] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [driveNote, setDriveNote] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/settings", { cache: "no-store" });
          const body = (await response.json()) as Payload & { error?: string };
          if (!response.ok) {
            setLoadError(body.error || "Could not load settings.");
            return;
          }
          setPayload(body);
          setStreamUrl(body.config.streamUrl);
          setStreamUrl2(body.config.streamUrl2 ?? "");
          setRetentionDays(String(body.config.retentionDays));
        } catch {
          setLoadError("Settings did not load. Check the connection and refresh.");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("drive") === "connected") {
      setDriveNote("Google Drive is connected.");
    } else if (params.get("driveError")) {
      setDriveNote(params.get("driveError") || "Google Drive did not connect.");
    }
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    setSaveError("");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          streamUrl,
          streamUrl2,
          retentionDays: Number(retentionDays),
        }),
      });
      const body = (await response.json()) as Payload & { error?: string; message?: string };
      if (!response.ok) {
        setSaveError(body.error || "Could not save settings.");
        return;
      }
      setPayload(body);
      setStreamUrl(body.config.streamUrl);
      setStreamUrl2(body.config.streamUrl2 ?? "");
      setRetentionDays(String(body.config.retentionDays));
      setSaveMessage(body.message || "Saved.");
    } catch {
      setSaveError("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function recordNow() {
    setTriggering(true);
    setTriggerMessage("");
    setTriggerError("");
    try {
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seconds: 30 }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setTriggerError(body.error || "Could not start a recording.");
        return;
      }
      setTriggerMessage(body.message || "Recording started.");
    } catch {
      setTriggerError("Could not start a recording.");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 md:px-8 md:pt-6">
      <header>
        <p className="text-xs tracking-[0.18em] text-primary uppercase">Schedule</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight">The morning job</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Fifteen minutes, every day, from 7:10 to 7:25 IST. Only record a stream you are
          allowed to keep.
        </p>
      </header>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Settings did not load</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !loadError ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Stream</CardTitle>
              <CardDescription>
                Paste an .m3u8 link, or the page that plays it. Live starts on Stream 1 and
                switches to Stream 2 if that one does not play. Addresses in lib/streams.ts
                are what every visitor plays, and these boxes are used only when that file is empty.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={save}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="stream-url">Stream 1</Label>
                  <Input
                    id="stream-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/live/index.m3u8"
                    value={streamUrl}
                    onChange={(event) => setStreamUrl(event.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="stream-url-2">Stream 2</Label>
                  <Input
                    id="stream-url-2"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/backup/index.m3u8"
                    value={streamUrl2}
                    onChange={(event) => setStreamUrl2(event.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="retention">Keep clips for (days)</Label>
                  <Input
                    id="retention"
                    type="number"
                    min={7}
                    max={365}
                    value={retentionDays}
                    onChange={(event) => setRetentionDays(event.target.value)}
                    className="h-11 max-w-32"
                    required
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Older clips are deleted from Drive so the free 15 GB lasts. 60 days of 720p
                    stays inside that.
                  </p>
                </div>
                <div className="rounded-lg bg-muted px-3 py-3 text-sm">
                  <p className="font-medium">Every morning, {WINDOW_LABEL}</p>
                  <p className="mt-1 text-muted-foreground">
                    The runner starts a few minutes early and waits. GitHub&apos;s free clock can
                    slip by a few minutes, and the desk shows the real start time.
                  </p>
                </div>
                {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
                {saveMessage ? <p className="text-sm text-primary">{saveMessage}</p> : null}
                <Button type="submit" className="h-11 w-full sm:w-auto" disabled={saving}>
                  {saving ? "Saving…" : "Save settings"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connections</CardTitle>
              <CardDescription>
                The morning job needs Drive and Telegram. Record now on the hosted site needs
                GitHub.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Connection
                name="Google Drive"
                on={Boolean(payload?.status.drive)}
                detail={driveDetail(payload?.status)}
              />
              {driveNote ? <p className="text-sm">{driveNote}</p> : null}
              {payload?.driveRedirect ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  In the Google client, add this redirect address, then press the button:{" "}
                  <span className="break-all text-foreground">{payload.driveRedirect}</span>
                </p>
              ) : null}
              <Button
                nativeButton={false}
                render={<a href="/api/drive/start" />}
                className="h-11 w-full sm:w-auto"
              >
                {payload?.status.drive ? "Connect Google Drive again" : "Connect Google Drive"}
              </Button>
              <Connection
                name="Telegram"
                on={Boolean(payload?.status.telegram)}
                detail={
                  payload?.status.telegram
                    ? "Audio and a Drive link will be sent."
                    : "Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID."
                }
              />
              <Connection
                name="GitHub record trigger"
                on={Boolean(payload?.status.github)}
                detail={
                  payload?.status.github
                    ? "Record now starts the GitHub Action."
                    : payload?.status.localRecord
                      ? "Not connected. Record now runs on this machine instead."
                      : "Add GITHUB_DISPATCH_TOKEN and GITHUB_REPOSITORY."
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Record now</CardTitle>
              <CardDescription>
                A 30-second test of the same job. On the hosted site this starts GitHub Actions.
                On a computer without that token, it records here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {triggerError ? <p className="text-sm text-destructive">{triggerError}</p> : null}
              {triggerMessage ? <p className="text-sm leading-6">{triggerMessage}</p> : null}
              <Button
                type="button"
                className="h-11 w-full sm:w-auto"
                disabled={triggering}
                onClick={() => void recordNow()}
              >
                {triggering ? "Starting…" : "Record 30 seconds"}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function driveDetail(status: ConnectionStatus | undefined): string {
  if (!status?.drive) {
    return "Not connected. Clips stay in the local data folder until Drive is set up.";
  }
  if (status.driveMode === "oauth") return "Connected with your Google account.";
  return "Connected with a service account. That only has room on a Workspace shared drive.";
}

function Connection({ name, on, detail }: { name: string; on: boolean; detail: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{name}</p>
        <span className={on ? "text-xs text-primary" : "text-xs text-muted-foreground"}>
          {on ? "Connected" : "Not connected"}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
