"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WINDOW_LABEL } from "@/lib/time";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [devPassword, setDevPassword] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/session")
        .then((response) => response.json())
        .then((body: { devPassword?: boolean }) => {
          setDevPassword(Boolean(body.devPassword));
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error || "Could not sign in.");
        setPending(false);
        return;
      }
      const next = search.get("next");
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Could not sign in.");
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <p className="text-xs tracking-[0.2em] text-primary uppercase">{WINDOW_LABEL}</p>
        <h1 className="mt-3 font-heading text-5xl tracking-tight">Morning desk</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The 7:10 show, kept for you. Fifteen minutes of the stream, every morning, ready to
          play.
        </p>
        <form className="mt-8 flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Admin password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11"
              required
            />
          </div>
          {devPassword ? (
            <p className="text-xs leading-5 text-muted-foreground">
              This local desk opens with the password morning until you set ADMIN_PASSWORD.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-11" disabled={pending}>
            {pending ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </div>
    </main>
  );
}
