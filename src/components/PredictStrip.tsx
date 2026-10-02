"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import type { PredRound } from "@/lib/rounds";
import { ROUND_LABELS } from "@/lib/scoring.config";
import { CountdownText } from "./Countdown";

/** Hub teaser: this weekend's prediction rounds with lock countdowns. Same for every visitor (page is cached). */
export function PredictStrip({ rounds }: { rounds: PredRound[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section aria-labelledby="pred-h" className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Prediction league · free, no sign-up</p>
          <h2 id="pred-h" className="display mt-1 text-3xl italic">Predict this weekend</h2>
        </div>
        <Link href="/league" className="flex items-center gap-1 text-sm text-muted hover:text-text">
          Leaderboard <ChevronRight size={14} aria-hidden />
        </Link>
      </div>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Pick the top 10 for each session. Every round locks when the session starts and is scored from the official results. Play in the
        global league, or start a private one with friends.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rounds.map((r) => {
          const locked = now !== null && now >= new Date(r.lockAt).getTime();
          return (
            <li key={r.type}>
              <Link
                href={`/predict/${r.season}/${r.round}/${r.type}`}
                className={`cut-sm group flex items-center gap-3 px-4 py-3 transition-colors ${
                  locked ? "bg-surface-2 text-muted hover:bg-surface-3" : "bg-red text-white hover:brightness-110"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="display truncate text-xl italic">{ROUND_LABELS[r.type]}</p>
                  <p className="text-xs opacity-85">
                    {locked ? (
                      <span className="flex items-center gap-1"><Lock size={11} aria-hidden /> Locked · see picks</span>
                    ) : (
                      <>Locks in <CountdownText target={r.lockAt} /></>
                    )}
                  </p>
                </div>
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
