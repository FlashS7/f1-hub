"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, LogOut, RefreshCw, Share2 } from "lucide-react";
import { api } from "./forms";

export function InviteBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const link = `${window.location.origin}/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my F1 HUB league", url: link });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow">Invite code</span>
      <span className="cut-sm bg-surface-2 px-3 py-1.5 font-mono text-lg font-bold tracking-[0.3em]">{code}</span>
      <button onClick={share} className="btn-ghost !px-3 !py-2 text-sm">
        {copied ? <Check size={15} aria-hidden /> : <Share2 size={15} aria-hidden />}
        {copied ? "Link copied" : "Share link"}
      </button>
    </div>
  );
}

export function LeaveLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost !px-3 !py-2 text-sm text-red"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Leave this league? Your picks stay and keep counting in your other leagues.")) return;
        setBusy(true);
        try {
          await api(`/api/leagues/${leagueId}/leave`, "POST");
          router.push("/league");
          router.refresh();
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed");
          setBusy(false);
        }
      }}
    >
      <LogOut size={15} aria-hidden /> Leave league
    </button>
  );
}

/** League owner / admin only. The server re-checks; this just hides it from others. */
export function RecalcButton({ leagueId, season, round }: { leagueId: string; season: number; round: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="btn-ghost !px-3 !py-2 text-sm"
        disabled={state === "busy"}
        onClick={async () => {
          if (!confirm("Re-fetch official results and re-score every round of this weekend?")) return;
          setState("busy");
          try {
            const r = await api<{ result: Record<string, number | null | string> }>(`/api/leagues/${leagueId}/recalculate`, "POST", { season, round });
            setMsg(
              Object.entries(r.result)
                .map(([k, v]) => `${k}: ${v === null ? "no result yet" : typeof v === "number" ? `${v} scored` : v}`)
                .join(" · "),
            );
            setState("done");
            router.refresh();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Failed");
            setState("error");
          }
        }}
      >
        {state === "busy" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
        Recalculate weekend
      </button>
      {msg && (
        <span role="status" className={`text-xs ${state === "error" ? "text-red" : "text-muted"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
