"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

const KEY = "f1hub.tz";
export const PRAGUE = "Europe/Prague";

interface TzCtx {
  /** Resolved IANA zone, null until mounted (avoids SSR/client mismatch). */
  tz: string | null;
  /** "auto" or a zone the user picked. */
  choice: string;
  setChoice: (c: string) => void;
}

const Ctx = createContext<TzCtx>({ tz: null, choice: "auto", setChoice: () => {} });

// Stored choice as an external store: null during SSR/hydration, then the saved value.
const listeners = new Set<() => void>();
let memory = "auto"; // used when localStorage is unavailable
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readChoice() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(subscribe, readChoice, () => null);

  const setChoice = useCallback((c: string) => {
    memory = c;
    try {
      localStorage.setItem(KEY, c);
    } catch {}
    listeners.forEach((l) => l());
  }, []);

  const choice = stored ?? "auto";
  const tz = stored === null ? null : choice === "auto" ? Intl.DateTimeFormat().resolvedOptions().timeZone : choice;
  return <Ctx.Provider value={{ tz, choice, setChoice }}>{children}</Ctx.Provider>;
}

export const useTz = () => useContext(Ctx);

export function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(new Date(iso));
}

/** Renders a date/time in the viewer's chosen zone. */
export function LocalTime({ iso, opts, className }: { iso: string; opts: Intl.DateTimeFormatOptions; className?: string }) {
  const { tz } = useTz();
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {tz ? fmt(iso, tz, opts) : " "}
    </time>
  );
}

const ZONES = [
  ["auto", "Device time"],
  [PRAGUE, "Prague"],
  ["Europe/London", "London"],
  ["UTC", "UTC"],
  ["America/New_York", "New York"],
  ["America/Los_Angeles", "Los Angeles"],
  ["Asia/Tokyo", "Tokyo"],
  ["Australia/Sydney", "Sydney"],
] as const;

export function TzSelect() {
  const { choice, setChoice, tz } = useTz();
  const short = tz ? fmt(new Date().toISOString(), tz, { timeZoneName: "short" }).split(" ").pop() : "";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setChoice(choice === PRAGUE ? "auto" : PRAGUE)}
        className={`chip cut-sm border transition-colors ${choice === PRAGUE ? "border-accent bg-accent/15 text-text" : "border-line text-muted hover:text-text"}`}
        aria-pressed={choice === PRAGUE}
      >
        Prague
      </button>
      <label className="sr-only" htmlFor="tz-select">Time zone</label>
      <select
        id="tz-select"
        value={ZONES.some(([z]) => z === choice) ? choice : "auto"}
        onChange={(e) => setChoice(e.target.value)}
        className="cut-sm border border-line bg-surface-2 py-1 pl-2 pr-6 text-xs text-muted outline-none focus:border-accent"
      >
        {ZONES.map(([z, label]) => (
          <option key={z} value={z}>
            {label}
          </option>
        ))}
      </select>
      <span className="font-mono text-[11px] text-faint" suppressHydrationWarning>{short}</span>
    </div>
  );
}
