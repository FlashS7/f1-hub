import Link from "next/link";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import type { LbRow } from "@/lib/leaderboard";
import { team } from "@/lib/teams";

function Movement({ n }: { n: number }) {
  if (n > 0)
    return (
      <span className="move-up flex w-7 items-center text-green" title={`Up ${n}`}>
        <ChevronUp size={16} strokeWidth={3} aria-hidden />
        <span className="font-mono text-[11px] font-bold">{n}</span>
        <span className="sr-only">up {n}</span>
      </span>
    );
  if (n < 0)
    return (
      <span className="move-down flex w-7 items-center text-red" title={`Down ${-n}`}>
        <ChevronDown size={16} strokeWidth={3} aria-hidden />
        <span className="font-mono text-[11px] font-bold">{-n}</span>
        <span className="sr-only">down {-n}</span>
      </span>
    );
  return (
    <span className="flex w-7 items-center text-faint" title="No change">
      <Minus size={14} aria-hidden />
      <span className="sr-only">no change</span>
    </span>
  );
}

/** Season leaderboard as a broadcast timing tower. */
export function Leaderboard({ rows, leagueId, meId }: { rows: LbRow[]; leagueId: string; meId: string }) {
  return (
    <section aria-labelledby="lb-h" className="panel overflow-hidden">
      <div className="flex items-end justify-between bg-surface-2 px-4 py-3">
        <h2 id="lb-h" className="display text-2xl italic">Leaderboard</h2>
        <span className="eyebrow">Season</span>
      </div>
      <div className="h-[3px] bg-accent" />
      <div className="hidden grid-cols-[2.5rem_1.75rem_1fr_4.5rem_4.5rem_3rem_3.5rem] gap-2 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint sm:grid">
        <span>Pos</span>
        <span />
        <span>Player</span>
        <span className="text-right">Pts</span>
        <span className="text-right">Gap</span>
        <span className="text-right">Won</span>
        <span className="text-right">Avg</span>
      </div>
      <ol className="stagger">
        {rows.map((r, i) => {
          const t = team(r.player.teamId);
          const me = r.player.id === meId;
          return (
            <li key={r.player.id} style={{ "--i": i } as React.CSSProperties}>
              <Link
                href={`/league/${leagueId}/player/${r.player.id}`}
                className={`grid grid-cols-[2.5rem_1.75rem_1fr_4.5rem] items-center gap-2 border-b border-line/60 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:grid-cols-[2.5rem_1.75rem_1fr_4.5rem_4.5rem_3rem_3.5rem] ${
                  me ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : ""
                }`}
              >
                <span
                  className={`display cut-r flex h-8 items-center justify-center text-xl italic tabular ${
                    r.position === 1 && r.total > 0 ? "bg-text text-bg" : "bg-surface-3"
                  }`}
                >
                  {r.position}
                </span>
                <Movement n={r.movement} />
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="h-7 w-1.5 shrink-0 -skew-x-12" style={{ background: t.color }} aria-hidden />
                  <span className="min-w-0">
                    <span className="display block truncate text-[20px] leading-none">{r.player.nickname}</span>
                    <span className="mt-0.5 block truncate text-[11px] uppercase tracking-[0.14em] text-muted">
                      {t.name}
                      <span className="sm:hidden"> · {r.weekendsWon}W · {r.gap === 0 ? "Leader" : `+${r.gap}`}</span>
                    </span>
                  </span>
                </span>
                <span className="text-right font-mono text-lg font-bold tabular">{r.total}</span>
                <span className="hidden text-right font-mono text-sm text-muted tabular sm:block">
                  {i === 0 ? <span className="text-[11px] font-semibold uppercase tracking-widest text-faint">Leader</span> : `+${r.gap}`}
                </span>
                <span className="hidden text-right font-mono text-sm tabular sm:block">{r.weekendsWon}</span>
                <span className="hidden text-right font-mono text-sm text-muted tabular sm:block">{r.average.toFixed(1)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
