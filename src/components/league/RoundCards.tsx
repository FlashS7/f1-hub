"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Check, ChevronRight, Lock, Clock } from "lucide-react";
import type { RoundStatus } from "@/lib/rounds";
import { ROUND_LABELS, SCORING, type RoundType } from "@/lib/scoring.config";
import { CountdownText } from "../Countdown";
import { triggerLightsOut } from "../LightsOut";
import { LocalTime } from "../Timezone";

export interface RoundCardData {
  season: number;
  round: number;
  type: RoundType;
  lockAt: string;
  status: RoundStatus;
  players: { id: string; nickname: string; teamColor: string; submitted: boolean }[];
}

const STATUS: Record<RoundStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-green/15 text-green" },
  locked: { label: "Locked", cls: "bg-yellow/15 text-yellow" },
  scored: { label: "Scored", cls: "bg-purple/20 text-purple" },
};

export function RoundCards({ leagueId, meId, rounds }: { leagueId: string; meId: string; rounds: RoundCardData[] }) {
  const router = useRouter();
  const onLock = useCallback(() => {
    triggerLightsOut();
    setTimeout(() => router.refresh(), 400);
  }, [router]);

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rounds.map((r) => {
        const mine = r.players.find((p) => p.id === meId)?.submitted;
        const s = STATUS[r.status];
        return (
          <li key={r.type}>
            <Link
              href={`/league/${leagueId}/round/${r.season}/${r.round}/${r.type}`}
              className="panel group flex h-full flex-col gap-3 p-4 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`chip cut-sm ${s.cls}`}>
                  {r.status === "locked" && <Lock size={11} aria-hidden />}
                  {s.label}
                </span>
                <span className="font-mono text-[11px] text-faint">×{SCORING.multipliers[r.type]}</span>
              </div>
              <div>
                <h3 className="display text-[26px] italic">{ROUND_LABELS[r.type]}</h3>
                {r.status === "open" ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                    <Clock size={13} aria-hidden /> Locks in <span className="text-text"><CountdownText target={r.lockAt} onZero={onLock} /></span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted">
                    Locked <LocalTime iso={r.lockAt} opts={{ weekday: "short", hour: "2-digit", minute: "2-digit" }} />
                  </p>
                )}
              </div>
              <ul className="flex flex-wrap gap-1.5" aria-label="Players">
                {r.players.map((p) => (
                  <li
                    key={p.id}
                    className={`chip cut-sm border ${p.submitted ? "border-transparent bg-surface-3 text-text" : "border-line text-faint"}`}
                    title={p.submitted ? "Locked in" : "Waiting"}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: p.submitted ? p.teamColor : "transparent", outline: `1px solid ${p.teamColor}` }} />
                    {p.nickname}
                    <span className="sr-only">{p.submitted ? "locked in" : "waiting"}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between border-t border-line/70 pt-3 text-sm">
                {r.status === "open" ? (
                  mine ? (
                    <span className="flex items-center gap-1.5 text-green"><Check size={15} strokeWidth={3} aria-hidden /> Locked in · edit</span>
                  ) : (
                    <span className="font-semibold text-accent">Make your pick</span>
                  )
                ) : (
                  <span className="text-muted">{r.status === "scored" ? "See points" : "See everyone's picks"}</span>
                )}
                <ChevronRight size={16} className="text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
