"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SEEN = "f1hub.lightsout";
export const LIGHTS_EVENT = "f1hub:lightsout";

/** Fire the start sequence from anywhere (e.g. when a round locks). */
export function triggerLightsOut() {
  window.dispatchEvent(new Event(LIGHTS_EVENT));
}

/**
 * Five red lights come on one by one, hold, then all go out.
 * Plays once per browser session on first load and whenever triggerLightsOut() is called.
 */
export function LightsOut() {
  const [lit, setLit] = useState(-1); // -1 hidden, 0..5 lights on, 6 = out
  const timers = useRef<number[]>([]);
  // Decided once per mount; a ref survives StrictMode's effect re-run so the replay isn't lost.
  const first = useRef<boolean | null>(null);

  const run = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timers.current.forEach(clearTimeout);
    setLit(0);
    const t = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    for (let i = 1; i <= 5; i++) t(() => setLit(i), 120 + i * 420);
    const hold = 120 + 5 * 420 + 300 + Math.random() * 700;
    t(() => setLit(6), hold);
    t(() => {
      setLit(-1);
      first.current = false;
    }, hold + 650);
  }, []);

  useEffect(() => {
    if (first.current === null) {
      try {
        first.current = !sessionStorage.getItem(SEEN);
        sessionStorage.setItem(SEEN, "1");
      } catch {
        first.current = false;
      }
    }
    if (first.current) run();
    window.addEventListener(LIGHTS_EVENT, run);
    const list = timers.current;
    return () => {
      window.removeEventListener(LIGHTS_EVENT, run);
      list.forEach(clearTimeout);
    };
  }, [run]);

  if (lit < 0) return null;
  const out = lit === 6;
  return (
    <div
      role="presentation"
      onClick={() => setLit(-1)}
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-8 bg-bg/92 backdrop-blur-sm transition-opacity duration-500 ${out ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex gap-2.5 sm:gap-4" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = !out && lit >= n;
          return (
            <div key={n} className="flex flex-col gap-2 rounded-md border border-line-strong bg-[#050506] p-2 shadow-2xl sm:p-2.5">
              {[0, 1].map((row) => (
                <span
                  key={row}
                  className="block size-9 rounded-full transition-all duration-75 sm:size-12"
                  style={{
                    background: on ? "radial-gradient(circle at 40% 35%, #ff6b5e, #e10600 55%, #7a0300)" : "#1b1b20",
                    boxShadow: on ? "0 0 22px 4px rgb(225 6 0 / .65), inset 0 0 6px rgb(0 0 0 / .4)" : "inset 0 2px 6px rgb(0 0 0 / .8)",
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <p className="display text-2xl italic tracking-wide text-muted">{out ? "Lights out and away we go" : " "}</p>
    </div>
  );
}
