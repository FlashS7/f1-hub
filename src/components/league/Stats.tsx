import type { ReactNode } from "react";
import type { LbRow } from "@/lib/leaderboard";
import type { WeekendHistory } from "@/lib/server/league";

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="eyebrow">{label}</p>
      <p className="display mt-2 text-[40px] italic tabular leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function PlayerStats({ row, history, size }: { row: LbRow | null; history: WeekendHistory[]; size: number }) {
  const bestName = row?.best ? history.find((h) => h.round === row.best!.round)?.name : null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Total points" value={row?.total ?? 0} sub={row ? `P${row.position} of ${size}` : undefined} />
      <Stat label="Weekends played" value={row?.weekendsPlayed ?? 0} sub={`${row?.weekendsWon ?? 0} won`} />
      <Stat label="Best weekend" value={row?.best?.points ?? "–"} sub={bestName ?? undefined} />
      <Stat label="Accuracy" value={`${Math.round((row?.accuracy ?? 0) * 100)}%`} sub="Picks in the exact position" />
    </div>
  );
}
