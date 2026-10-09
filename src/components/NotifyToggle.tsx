"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const SCOPE_KEY = "f1hub.pushScope";
type Scope = "all" | "main";
type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

/** Opt-in "starts in 10 minutes" reminders. Never prompts on its own; only after the user taps. */
export function NotifyToggle() {
  const [state, setState] = useState<State>("loading");
  const [scope, setScope] = useState<Scope>("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem(SCOPE_KEY);
        if (saved === "main" || saved === "all") setScope(saved);
      } catch {}
      const ua = navigator.userAgent;
      const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      const supported = KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await registration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : reg ? "off" : "unsupported");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async (s: Scope) => {
    setBusy(true);
    setError("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), scope: s }),
      });
      if (!res.ok) throw new Error("Couldn't save. Try again.");
      try {
        localStorage.setItem(SCOPE_KEY, s);
      } catch {}
      setScope(s);
      setState("on");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await (await registration())?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  const label = scope === "main" ? "qualifying, sprints & race" : "every session";
  const base = "flex items-center gap-2 text-xs text-muted";

  if (state === "ios-install") {
    return (
      <p className={base}>
        <Bell size={14} aria-hidden /> On iPhone, add F1 HUB to your Home Screen to get session reminders.
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className={base}>
        <BellOff size={14} aria-hidden /> Reminders are blocked in your browser settings.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${base} w-fit rounded-sm py-1 hover:text-text`}
      >
        {state === "on" ? <BellRing size={14} className="text-accent" aria-hidden /> : <Bell size={14} aria-hidden />}
        {state === "on" ? <>Reminders on · 10 min before {label}</> : "Remind me 10 min before sessions"}
      </button>
      {open && (
        <div className="cut-sm flex w-fit max-w-full flex-col gap-2 bg-surface-2 p-3 text-sm">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="sr-only">Which sessions</legend>
            {(
              [
                ["all", "Every session, practice included"],
                ["main", "Only qualifying, sprints & race"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="push-scope" checked={scope === v} onChange={() => setScope(v)} className="accent-[var(--accent)]" />
                {l}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary !px-3 !py-1.5 text-sm" disabled={busy} onClick={() => enable(scope)}>
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
              {state === "on" ? "Save" : "Turn on"}
            </button>
            {state === "on" && (
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" disabled={busy} onClick={disable}>
                Turn off
              </button>
            )}
          </div>
          {error && <p role="alert" className="text-xs text-red">{error}</p>}
        </div>
      )}
    </div>
  );
}
