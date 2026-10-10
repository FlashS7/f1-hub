"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock, Loader2, RotateCcw } from "lucide-react";
import type { Session } from "@/lib/types";
import { api } from "./league/forms";
import { LocalTime } from "./Timezone";

/** "YYYY-MM-DDTHH:mm" in the browser's local time, for <input type="datetime-local">. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Row({ season, round, s }: { season: number; round: number; s: Session }) {
  const router = useRouter();
  const [value, setValue] = useState(() => toLocalInput(s.start));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async (start: string | null) => {
    setBusy(true);
    setErr("");
    try {
      await api("/api/admin/sessions", "PATCH", { season, round, key: s.key, start });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  const shift = (min: number) => save(new Date(new Date(s.start).getTime() + min * 60_000).toISOString());

  return (
    <li className="flex flex-col gap-2 border-b border-line/60 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {s.label}
          {s.scheduledStart && <span className="chip cut-sm ml-2 bg-yellow/15 text-yellow">Delayed</span>}
        </p>
        <p className="text-xs text-muted">
          <LocalTime iso={s.start} opts={{ weekday: "short", hour: "2-digit", minute: "2-digit" }} />
          {s.scheduledStart && (
            <>
              {" "}· was <LocalTime iso={s.scheduledStart} opts={{ hour: "2-digit", minute: "2-digit" }} />
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {[5, 15, 30].map((m) => (
          <button key={m} className="btn-ghost !px-2.5 !py-1.5 text-xs" disabled={busy} onClick={() => shift(m)}>
            +{m} min
          </button>
        ))}
        <label className="sr-only" htmlFor={`start-${s.key}`}>New start of {s.label}</label>
        <input
          id={`start-${s.key}`}
          type="datetime-local"
          className="field !w-auto !px-2 !py-1.5 text-xs"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn-ghost !px-2.5 !py-1.5 text-xs" disabled={busy || !value} onClick={() => save(new Date(value).toISOString())}>
          {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Clock size={12} aria-hidden />} Set
        </button>
        {s.scheduledStart && (
          <button className="btn-ghost !px-2.5 !py-1.5 text-xs" disabled={busy} onClick={() => save(null)} title="Back to the official schedule">
            <RotateCcw size={12} aria-hidden /> Reset
          </button>
        )}
      </div>
      {err && <p role="alert" className="text-xs text-red">{err}</p>}
    </li>
  );
}

const notOver = (s: Session) => new Date(s.end).getTime() > Date.now();

/** Admin: shift sessions of the current weekend when they're delayed. Moves countdown, lock, reminder and scoring. */
export function SessionDelays({ season, round, sessions }: { season: number; round: number; sessions: Session[] }) {
  const upcoming = sessions.filter(notOver);
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="delay-h">
      <h2 id="delay-h" className="display text-2xl">Session delays</h2>
      <p className="mt-1 text-xs text-muted">
        If a session starts late, move it here. The countdown, LIVE badge, pick lock, 10-minute reminder and result fetching all follow
        the new time.
      </p>
      <div className="racing-line my-3" />
      {upcoming.length ? (
        <ul>
          {upcoming.map((s) => (
            <Row key={`${s.key}-${s.start}`} season={season} round={round} s={s} />
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-muted">No sessions left this weekend.</p>
      )}
    </section>
  );
}
