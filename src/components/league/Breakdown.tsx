import { Crown } from "lucide-react";
import type { RoundScore } from "@/lib/scoring";
import { SCORING } from "@/lib/scoring.config";
import { team } from "@/lib/teams";
import type { Driver } from "@/lib/types";

const BONUS_LABEL = { pole: "Pole", fastestLap: "Fastest lap", exactTop3: "Exact top 3" } as const;

function ptsColor(p: number) {
  const [exact, off1, off2] = SCORING.slotPointsByDistance;
  if (p === exact) return "var(--purple)";
  if (p === off1) return "var(--green)";
  if (p === off2) return "var(--yellow)";
  if (p > 0) return "var(--muted)";
  return "var(--faint)";
}

export function DriverTag({ driver, id }: { driver?: Driver; id: string }) {
  const t = team(driver?.teamId);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="h-5 w-1 shrink-0 -skew-x-12" style={{ background: t.color }} aria-hidden />
      <span className="font-mono text-sm font-bold">{driver?.code ?? id.slice(0, 3).toUpperCase()}</span>
      <span className="hidden truncate text-xs text-muted sm:inline">{driver?.lastName}</span>
    </span>
  );
}

export interface PlayerCard {
  id: string;
  nickname: string;
  teamId: string;
  picks: string[];
  fastestLap: string | null;
  score: RoundScore | null;
}

export function PlayerPicks({
  card,
  drivers,
  rank,
  me,
  flResult,
}: {
  card: PlayerCard;
  drivers: Map<string, Driver>;
  rank: number | null;
  me: boolean;
  flResult: string | null;
}) {
  const t = team(card.teamId);
  const s = card.score;
  return (
    <article className="panel overflow-hidden" aria-label={`${card.nickname}'s picks`}>
      <header className="flex items-center gap-3 bg-surface-2 px-4 py-3">
        {rank !== null && <span className="display cut-r flex h-8 w-9 items-center justify-center bg-surface-3 text-xl italic">{rank}</span>}
        <span className="h-7 w-1.5 -skew-x-12" style={{ background: t.color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="display truncate text-xl leading-none">
            {card.nickname} {me && <span className="text-sm text-muted">(you)</span>}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted">{t.name}</p>
        </div>
        {s && (
          <div className="text-right">
            <p className="font-mono text-2xl font-bold leading-none tabular">{s.total}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-faint">pts</p>
          </div>
        )}
      </header>
      <div className="h-[3px]" style={{ background: t.color }} />
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Predicted</th>
            <th>Driver</th>
            <th>Actual</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {card.picks.map((id, i) => {
            const slot = s?.slots[i];
            return (
              <tr key={id} className="border-b border-line/50">
                <td className="w-12 py-1.5 pl-4 font-mono text-xs text-faint">P{i + 1}</td>
                <td className="py-1.5">
                  <DriverTag driver={drivers.get(id)} id={id} />
                </td>
                <td className="w-16 py-1.5 text-right font-mono text-xs text-muted">
                  {slot ? (slot.actual === null ? "DNF" : `P${slot.actual}`) : ""}
                </td>
                <td className="w-14 py-1.5 pr-4 text-right font-mono font-bold tabular" style={{ color: slot ? ptsColor(slot.points) : undefined }}>
                  {slot ? slot.points : ""}
                </td>
              </tr>
            );
          })}
          {card.fastestLap && (
            <tr className="border-b border-line/50">
              <td className="py-1.5 pl-4 font-mono text-xs text-purple">FL</td>
              <td className="py-1.5">
                <DriverTag driver={drivers.get(card.fastestLap)} id={card.fastestLap} />
              </td>
              <td className="py-1.5 text-right font-mono text-xs text-muted">
                {flResult ? drivers.get(flResult)?.code ?? flResult : ""}
              </td>
              <td />
            </tr>
          )}
        </tbody>
      </table>
      {s && (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-xs text-muted">
          <span>
            Slots <b className="font-mono text-text">{s.slotPoints}</b>
          </span>
          {s.bonuses.map((b) => (
            <span key={b.key} className="chip cut-sm bg-purple/20 text-purple">
              <Crown size={11} aria-hidden /> {BONUS_LABEL[b.key]} +{b.points}
            </span>
          ))}
          <span className="ml-auto font-mono">
            {s.raw} × {s.multiplier} = <b className="text-text">{s.total}</b>
          </span>
        </footer>
      )}
    </article>
  );
}

export function PointsLegend() {
  const [exact, off1, off2] = SCORING.slotPointsByDistance;
  const items: [string, number][] = [
    ["Exact", exact],
    ["±1", off1],
    ["±2", off2],
    ["In top 10", SCORING.inTop10],
    ["Out / DNF", SCORING.outsideTop10],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Points key">
      {items.map(([l, p]) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="size-2" style={{ background: ptsColor(p) }} aria-hidden /> {l} <b className="font-mono text-text">{p}</b>
        </li>
      ))}
    </ul>
  );
}
