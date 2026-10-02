"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

const DISMISS = "f1hub.installHint";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** iOS Safari: manual Add to Home Screen steps. Android Chrome: native install prompt. */
export function InstallHint() {
  const [mode, setMode] = useState<"ios" | "android" | null>(null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS) === "1";
    } catch {}
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (dismissed || standalone) return;

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      const t = setTimeout(() => setMode("ios"), 4000);
      return () => clearTimeout(t);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    setMode(null);
    try {
      localStorage.setItem(DISMISS, "1");
    } catch {}
  };

  if (!mode) return null;
  return (
    <div
      role="dialog"
      aria-label="Install F1 HUB"
      className="panel fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-start gap-3 border-l-2 border-red p-4 shadow-2xl sm:inset-x-auto sm:right-4"
    >
      <Download size={20} className="mt-0.5 shrink-0 text-red" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="display text-lg">Install F1 HUB</p>
        {mode === "ios" ? (
          <p className="mt-1 text-muted">
            Tap <Share size={14} className="inline align-[-2px] text-text" aria-label="Share" /> Share, then{" "}
            <SquarePlus size={14} className="inline align-[-2px] text-text" aria-hidden /> <b className="text-text">Add to Home Screen</b>.
          </p>
        ) : (
          <>
            <p className="mt-1 text-muted">Add it to your home screen for full-screen, instant access.</p>
            <button
              className="btn-primary mt-3 !py-2"
              onClick={async () => {
                if (!prompt) return;
                await prompt.prompt();
                await prompt.userChoice;
                close();
              }}
            >
              Install
            </button>
          </>
        )}
      </div>
      <button onClick={close} aria-label="Dismiss" className="p-1 text-faint hover:text-text">
        <X size={18} />
      </button>
    </div>
  );
}
