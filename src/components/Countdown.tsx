"use client";

import { useEffect, useRef, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** One digit that rolls in from above whenever it changes. */
function Digit({ value }: { value: string }) {
  return (
    <span className="relative inline-block w-[0.62em] overflow-hidden text-center">
      <span key={value} className="digit-roll inline-block">
        {value}
      </span>
    </span>
  );
}

function Unit({ value, label, pad = 2, size }: { value: number; label: string; pad?: number; size: "lg" | "sm" }) {
  const str = String(value).padStart(pad, "0");
  return (
    <div className="flex flex-col items-center">
      <div
        className={`cut-sm flex bg-surface-2 font-mono font-bold leading-none tabular text-text ${
          size === "lg" ? "px-1.5 py-2 text-[34px] min-[400px]:text-[40px] sm:px-3 sm:py-3 sm:text-[64px]" : "px-1.5 py-1 text-xl"
        }`}
      >
        {str.split("").map((c, i) => (
          <Digit key={i} value={c} />
        ))}
      </div>
      <span className={`mt-1.5 font-semibold uppercase tracking-[0.2em] text-faint ${size === "lg" ? "text-[10px] sm:text-[11px]" : "text-[9px]"}`}>
        {label}
      </span>
    </div>
  );
}

/** Live d/h/m/s countdown. Calls onZero once when it reaches the target. */
export function Countdown({ target, size = "lg", onZero }: { target: string; size?: "lg" | "sm"; onZero?: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const left = now === null ? null : new Date(target).getTime() - now;
  useEffect(() => {
    if (left !== null && left <= 0 && !fired.current) {
      fired.current = true;
      onZero?.();
    }
  }, [left, onZero]);

  const p = parts(left ?? 0);
  const sep = <span className={`self-start font-mono text-faint ${size === "lg" ? "pt-2.5 text-2xl sm:pt-5 sm:text-5xl" : "pt-1 text-lg"}`}>:</span>;
  return (
    <div
      className={`flex items-start ${size === "lg" ? "gap-1 sm:gap-2.5" : "gap-1"} ${left === null ? "opacity-0" : "opacity-100 transition-opacity"}`}
      role="timer"
      aria-label={left === null ? "Loading countdown" : `${p.d} days ${p.h} hours ${p.m} minutes ${p.s} seconds`}
    >
      <Unit value={p.d} label="Days" size={size} pad={2} />
      {sep}
      <Unit value={p.h} label="Hrs" size={size} />
      {sep}
      <Unit value={p.m} label="Min" size={size} />
      {sep}
      <Unit value={p.s} label="Sec" size={size} />
    </div>
  );
}

/** Compact "2d 04:12:09" text for round cards. */
export function CountdownText({ target, onZero }: { target: string; onZero?: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const left = now === null ? null : new Date(target).getTime() - now;
  useEffect(() => {
    if (left !== null && left <= 0 && !fired.current) {
      fired.current = true;
      onZero?.();
    }
  }, [left, onZero]);
  if (left === null) return <span className="font-mono tabular">--:--:--</span>;
  const p = parts(left);
  const hms = [p.h, p.m, p.s].map((n) => String(n).padStart(2, "0")).join(":");
  return <span className="font-mono tabular">{p.d > 0 ? `${p.d}d ${hms}` : hms}</span>;
}
