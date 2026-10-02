"use client";

import { useState } from "react";
import { ClaimForm, JoinForm } from "./forms";

export function JoinTabs({ leagueId }: { leagueId: string }) {
  const [tab, setTab] = useState<"new" | "back">("new");
  return (
    <section className="panel p-5">
      <div role="tablist" aria-label="Join or log in" className="mb-5 grid grid-cols-2 gap-1">
        {(
          [
            ["new", "New player"],
            ["back", "I already play"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`cut-sm py-2.5 text-[15px] font-bold uppercase tracking-[0.12em] transition-colors ${
              tab === v ? "bg-red text-white" : "bg-surface-2 text-muted hover:text-text"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "new" ? <JoinForm leagueId={leagueId} /> : <ClaimForm leagueId={leagueId} />}
    </section>
  );
}
