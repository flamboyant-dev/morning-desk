"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function installedAlready(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || ios;
}

export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (installedAlready()) {
      setHidden(true);
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    }
    function onInstalled() {
      setHidden(true);
      setHelp(false);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  async function install() {
    if (!prompt) {
      setHelp(true);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    setPrompt(null);
  }

  return (
    <>
      <button
        type="button"
        className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black"
        onClick={() => void install()}
      >
        Install
      </button>
      {help ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => setHelp(false)}
        >
          <div
            role="dialog"
            aria-labelledby="install-title"
            className="w-full max-w-sm rounded-2xl bg-zinc-950 p-5 text-white ring-1 ring-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="install-title" className="font-heading text-2xl">
              Install Morning
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-300">
              <li>Open the browser menu.</li>
              <li>Choose Install app, or Add to Home Screen.</li>
              <li>Confirm. Morning then opens like an app.</li>
            </ol>
            <Button className="mt-5 h-11 w-full rounded-full" onClick={() => setHelp(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
