"use client";

import { useEffect, useState } from "react";
import type { Weekend } from "@/lib/types";
import { Countdown } from "./Countdown";
import { NotifyToggle } from "./NotifyToggle";
import { LocalTime, TzSelect } from "./Timezone";

const SECTOR: Record<string, string> = {
  FP1: "var(--faint)", FP2: "var(--faint)", FP3: "var(--faint)",
  SQ: "var(--purple)", SPRINT: "var(--purple)", QUALI: "var(--yellow)", RACE: "var(--red)",
};

function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function NextSession({ weekend }: { weekend: Weekend }) {
  const now = useNow();
  const t = now ?? 0;
  const live = weekend.sessions.find((s) => new Date(s.start).getTime() <= t && t < new Date(s.end).getTime());
  const next = weekend.sessions.find((s) => new Date(s.start).getTime() > t);

  return (
    <div className="flex flex-col gap-4">
      {live && now !== null && (
        <div className="flex items-center gap-3">
          <span className="chip cut-sm bg-red text-white">
            <span className="live-dot size-1.5 rounded-full bg-white" /> Live
          </span>
          <span className="display text-2xl">{live.label}</span>
          <span className="text-sm text-muted">in progress</span>
        </div>
      )}
      {next ? (
        <>
          <div>
            <p className="eyebrow">{live ? "Up next" : "Next session"}</p>
            <h2 className="display mt-1 text-4xl sm:text-5xl" style={{ color: "var(--text)" }}>
              <span className="mr-3 inline-block h-[0.7em] w-1.5 -skew-x-12 align-baseline" style={{ background: SECTOR[next.key] }} />
              {next.label}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              <LocalTime iso={next.start} opts={{ weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }} />
            </p>
          </div>
          <Countdown target={next.start} />
          <NotifyToggle />
        </>
      ) : (
        !live && now !== null && <p className="display text-3xl text-muted">Weekend complete</p>
      )}
    </div>
  );
}

export function Schedule({ weekend }: { weekend: Weekend }) {
  const now = useNow(15_000);
  const t = now ?? 0;
  return (
    <section aria-labelledby="sched-h" className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sched-h" className="display text-2xl">Weekend schedule</h2>
        <TzSelect />
      </div>
      <div className="racing-line mt-3" />
      <ol className="stagger mt-2 divide-y divide-line/70">
        {weekend.sessions.map((s, i) => {
          const start = new Date(s.start).getTime();
          const end = new Date(s.end).getTime();
          const live = now !== null && start <= t && t < end;
          const done = now !== null && t >= end;
          return (
            <li
              key={s.key}
              style={{ "--i": i } as React.CSSProperties}
              className={`relative flex items-center gap-3 py-3 pl-3 ${done ? "opacity-45" : ""} ${live ? "bg-red/10" : ""}`}
            >
              <span className="absolute inset-y-2 left-0 w-[3px]" style={{ background: SECTOR[s.key] }} />
              <div className="w-[88px] shrink-0 text-xs uppercase tracking-widest text-muted">
                <LocalTime iso={s.start} opts={{ weekday: "short", day: "numeric", month: "short" }} />
              </div>
              <div className="flex-1 font-semibold">{s.label}</div>
              {live && (
                <span className="chip cut-sm bg-red text-white">
                  <span className="live-dot size-1.5 rounded-full bg-white" /> Live
                </span>
              )}
              <LocalTime iso={s.start} opts={{ hour: "2-digit", minute: "2-digit" }} className="w-14 text-right font-mono text-sm tabular" />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
