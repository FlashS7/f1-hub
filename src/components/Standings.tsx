"use client";

import { useState } from "react";
import { team } from "@/lib/teams";
import type { ConstructorStanding, DriverStanding, RaceResult } from "@/lib/types";

const PODIUM = ["var(--yellow)", "#c9ccd1", "#c27a3a"];

function Pos({ n }: { n: number }) {
  return (
    <span
      className="display w-7 shrink-0 text-center text-xl italic tabular"
      style={{ color: n <= 3 ? PODIUM[n - 1] : "var(--muted)" }}
    >
      {n || "–"}
    </span>
  );
}

function Bar({ color }: { color: string }) {
  return <span className="h-6 w-1 shrink-0 -skew-x-12" style={{ background: color }} aria-hidden />;
}

function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`cut-sm px-3 py-1.5 text-[13px] font-bold uppercase tracking-[0.14em] transition-colors ${
            value === v ? "bg-red text-white" : "bg-surface-2 text-muted hover:text-text"
          }`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function StandingsPanel({ drivers, constructors }: { drivers: DriverStanding[]; constructors: ConstructorStanding[] }) {
  const [tab, setTab] = useState<"drivers" | "teams">("drivers");
  const [all, setAll] = useState(false);
  const leaderPts = tab === "drivers" ? drivers[0]?.points ?? 0 : constructors[0]?.points ?? 0;
  const rows = tab === "drivers" ? drivers : constructors;
  const shown = all ? rows : rows.slice(0, 10);

  return (
    <section aria-labelledby="stand-h" className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="stand-h" className="display text-2xl">Championship</h2>
        <Tabs label="Standings type" value={tab} onChange={(v) => { setTab(v); setAll(false); }} options={[["drivers", "Drivers"], ["teams", "Teams"]]} />
      </div>
      <div className="racing-line mt-3" />
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No standings yet this season.</p>
      ) : (
        <ol key={tab + all} className="stagger mt-1">
          {shown.map((r, i) => {
            const isDriver = "driver" in r;
            const t = team(isDriver ? r.driver.teamId : r.teamId);
            const pct = leaderPts ? (r.points / leaderPts) * 100 : 0;
            return (
              <li key={isDriver ? r.driver.id : r.teamId} style={{ "--i": i } as React.CSSProperties} className="relative flex items-center gap-3 border-b border-line/50 py-2">
                <Pos n={r.position} />
                <Bar color={t.color} />
                <div className="min-w-0 flex-1">
                  {isDriver ? (
                    <p className="truncate">
                      <span className="text-muted">{r.driver.firstName} </span>
                      <span className="font-bold uppercase">{r.driver.lastName}</span>
                    </p>
                  ) : (
                    <p className="truncate font-bold">{t.name}</p>
                  )}
                  <div className="mt-1 h-[3px] bg-surface-3">
                    <div className="h-full transition-[width] duration-700" style={{ width: `${pct}%`, background: t.color, opacity: 0.7 }} />
                  </div>
                </div>
                {isDriver && <span className="hidden w-24 truncate text-xs text-muted sm:block">{t.name}</span>}
                <span className="w-12 text-right font-mono text-sm font-bold tabular">{r.points}</span>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > 10 && (
        <button onClick={() => setAll((a) => !a)} className="mt-3 w-full py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted hover:text-text">
          {all ? "Show top 10" : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}

export function LastResult({ result }: { result: RaceResult | null }) {
  return (
    <section aria-labelledby="last-h" className="panel p-4 sm:p-5">
      <p className="eyebrow">Last race · Round {result?.round ?? "–"}</p>
      <h2 id="last-h" className="display mt-1 text-2xl">{result?.name ?? "No results yet"}</h2>
      <div className="racing-line mt-3" />
      {result && (
        <ol className="stagger mt-1">
          {result.rows.slice(0, 10).map((r, i) => {
            const t = team(r.driver.teamId);
            return (
              <li key={r.driver.id} style={{ "--i": i } as React.CSSProperties} className="flex items-center gap-3 border-b border-line/50 py-2">
                <Pos n={r.position ?? 0} />
                <Bar color={t.color} />
                <span className="w-11 font-mono text-sm font-bold">{r.driver.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{t.name}</span>
                {r.fastestLapRank === 1 && (
                  <span className="chip cut-sm bg-purple/20 text-purple" title="Fastest lap">FL</span>
                )}
                <span className="w-24 text-right font-mono text-xs text-muted tabular">{r.time ?? r.status}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
