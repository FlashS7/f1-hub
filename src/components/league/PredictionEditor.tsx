"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Loader2, Timer, X } from "lucide-react";
import { inkOn } from "@/lib/accent";
import { team } from "@/lib/teams";
import type { Driver } from "@/lib/types";
import type { RoundType } from "@/lib/scoring.config";
import { CountdownText } from "../Countdown";
import { triggerLightsOut } from "../LightsOut";
import { api } from "./forms";

const N = 10;

function SortableRow({
  id,
  index,
  driver,
  selected,
  onSelect,
  onRemove,
}: {
  id: string;
  index: number;
  driver: Driver;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const t = team(driver.teamId);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center gap-2 border-b border-line/60 bg-surface py-1.5 pr-1.5 ${isDragging ? "z-10 scale-[1.02] shadow-2xl" : ""} ${
        selected ? "outline outline-2 -outline-offset-2 outline-accent" : ""
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag ${driver.lastName}, currently P${index + 1}`}
        className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-faint hover:text-text active:cursor-grabbing"
      >
        <GripVertical size={18} aria-hidden />
      </button>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-pressed={selected} aria-label={`P${index + 1} ${driver.firstName} ${driver.lastName}. Tap to change`}>
        <span className="display w-8 text-right text-xl italic tabular text-muted">P{index + 1}</span>
        <span className="h-7 w-1.5 shrink-0 -skew-x-12" style={{ background: t.color }} aria-hidden />
        <span className="w-7 font-mono text-xs text-faint">{driver.number}</span>
        <span className="min-w-0">
          <span className="block truncate font-bold uppercase leading-tight">{driver.lastName}</span>
          <span className="block truncate text-[11px] text-muted">{t.name}</span>
        </span>
      </button>
      <button onClick={onRemove} aria-label={`Remove ${driver.lastName}`} className="flex size-9 items-center justify-center text-faint hover:text-red">
        <X size={16} aria-hidden />
      </button>
    </li>
  );
}

export function PredictionEditor({
  season,
  round,
  type,
  lockAt,
  grid,
  initial,
}: {
  season: number;
  round: number;
  type: RoundType;
  lockAt: string;
  grid: Driver[];
  initial: { picks: string[]; fastestLap: string | null } | null;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(grid.map((d) => [d.id, d])), [grid]);
  const [picks, setPicks] = useState<string[]>(() => (initial?.picks ?? []).filter((id) => byId.has(id)));
  const [fl, setFl] = useState<string | null>(initial?.fastestLap ?? null);
  const [mode, setMode] = useState<"order" | "fl">("order");
  const [selected, setSelected] = useState<number | null>(null);
  const [saved, setSaved] = useState(JSON.stringify({ p: initial?.picks ?? [], f: initial?.fastestLap ?? null }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  const isRace = type === "RACE";
  const complete = picks.length === N && (!isRace || !!fl);
  const dirty = JSON.stringify({ p: picks, f: isRace ? fl : null }) !== saved;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPicks((p) => arrayMove(p, p.indexOf(String(active.id)), p.indexOf(String(over.id))));
    setSelected(null);
  };

  const tapDriver = (id: string) => {
    if (locked) return;
    if (mode === "fl") {
      setFl((cur) => (cur === id ? null : id));
      return;
    }
    setPicks((p) => {
      const at = p.indexOf(id);
      if (selected !== null && selected < p.length) {
        const next = [...p];
        if (at >= 0) [next[at], next[selected]] = [next[selected], next[at]]; // swap
        else next[selected] = id; // replace
        return next;
      }
      if (at >= 0) return p.filter((x) => x !== id);
      if (p.length >= N) return p;
      return [...p, id];
    });
    setSelected(null);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/picks", "PUT", { season, round, type, picks, fastestLap: isRace ? fl : null });
      setSaved(JSON.stringify({ p: picks, f: isRace ? fl : null }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const onLock = useCallback(() => {
    setLocked(true);
    triggerLightsOut();
    setTimeout(() => router.refresh(), 600);
  }, [router]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Ordered list */}
      <section aria-labelledby="order-h" className="panel order-2 p-3 sm:p-4 lg:order-1">
        <div className="flex items-center justify-between px-1">
          <h2 id="order-h" className="display text-2xl">Your top 10</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Timer size={13} aria-hidden /> Locks in <CountdownText target={lockAt} onZero={onLock} />
          </span>
        </div>
        <p className="px-1 pb-2 pt-1 text-xs text-faint">
          Drag the grip to reorder. Or tap a row, then a driver, to put them there.
        </p>
        <div className="h-[3px] bg-accent" />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={picks} strategy={verticalListSortingStrategy}>
            <ol>
              {picks.map((id, i) => (
                <SortableRow
                  key={id}
                  id={id}
                  index={i}
                  driver={byId.get(id)!}
                  selected={selected === i}
                  onSelect={() => setSelected((s) => (s === i ? null : i))}
                  onRemove={() => {
                    setPicks((p) => p.filter((x) => x !== id));
                    setSelected(null);
                  }}
                />
              ))}
              {Array.from({ length: N - picks.length }, (_, k) => {
                const i = picks.length + k;
                return (
                  <li key={`empty-${i}`} className="flex h-[53px] items-center gap-2.5 border-b border-dashed border-line/70 pl-10">
                    <span className="display w-8 text-right text-xl italic text-faint">P{i + 1}</span>
                    <span className="text-sm text-faint">{k === 0 ? "Tap a driver" : ""}</span>
                  </li>
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>

        {isRace && (
          <button
            onClick={() => setMode((m) => (m === "fl" ? "order" : "fl"))}
            className={`cut-sm mt-3 flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
              mode === "fl" ? "bg-purple/25 outline outline-1 outline-purple" : "bg-surface-2 hover:bg-surface-3"
            }`}
            aria-pressed={mode === "fl"}
          >
            <Timer size={18} className="text-purple" aria-hidden />
            <span className="flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-purple">Fastest lap</span>
              <span className="block font-bold">
                {fl ? `${byId.get(fl)?.firstName ?? ""} ${byId.get(fl)?.lastName ?? fl}` : "Not picked"}
              </span>
            </span>
            <span className="text-xs text-muted">{mode === "fl" ? "Tap a driver" : "Change"}</span>
          </button>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {error && <p role="alert" className="border-l-2 border-red bg-red/10 px-3 py-2 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={!complete || !dirty || busy || locked} onClick={save}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : !dirty && complete ? <Check size={16} aria-hidden /> : null}
            {locked ? "Locked" : !complete ? `${picks.length}/${N}${isRace && !fl ? " · pick fastest lap" : ""}` : dirty ? "Lock in prediction" : "Saved"}
          </button>
          {!dirty && complete && <p className="text-center text-xs text-muted">You can still change it until the session starts.</p>}
        </div>
      </section>

      {/* Driver grid */}
      <section aria-labelledby="grid-h" className="order-1 lg:order-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="grid-h" className="eyebrow">
            {mode === "fl" ? <span className="text-purple">Pick fastest lap</span> : selected !== null ? `Choose driver for P${selected + 1}` : "Drivers"}
          </h2>
          {isRace && (
            <div role="tablist" aria-label="What you're picking" className="flex gap-1">
              {(["order", "fl"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`cut-sm px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.12em] ${
                    mode === m ? (m === "fl" ? "bg-purple text-white" : "bg-accent text-[var(--accent-ink)]") : "bg-surface-2 text-muted"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {m === "order" ? "Top 10" : "Fastest lap"}
                </button>
              ))}
            </div>
          )}
        </div>
        <ul className="grid grid-cols-4 gap-1 sm:gap-1.5">
          {grid.map((d) => {
            const t = team(d.teamId);
            const pos = picks.indexOf(d.id);
            const on = mode === "fl" ? fl === d.id : pos >= 0;
            const color = mode === "fl" ? "#c46cf7" : t.color;
            return (
              <li key={d.id}>
                <button
                  onClick={() => tapDriver(d.id)}
                  disabled={locked}
                  aria-pressed={on}
                  aria-label={`${d.firstName} ${d.lastName}, ${t.name}${pos >= 0 ? `, picked P${pos + 1}` : ""}`}
                  className={`cut-sm group relative flex h-[58px] w-full flex-col justify-between overflow-hidden p-1.5 text-left transition-[transform,background-color] duration-150 active:scale-95 sm:h-[76px] sm:p-2 ${
                    on ? "" : "bg-surface-2 hover:bg-surface-3"
                  }`}
                  style={on ? { background: color, color: inkOn(color) } : undefined}
                >
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: on ? "transparent" : t.color }} aria-hidden />
                  <span
                    className="display pointer-events-none absolute -right-1 -top-1.5 text-[34px] italic opacity-[0.13] sm:-top-2 sm:text-[46px]"
                    aria-hidden
                  >
                    {d.number}
                  </span>
                  <span className="pl-1.5 font-mono text-[13px] font-bold">{d.code}</span>
                  <span className="pl-1.5">
                    <span className="block truncate text-[10px] font-bold uppercase leading-tight sm:text-[12px]">{d.lastName}</span>
                    <span className={`hidden truncate text-[10px] sm:block ${on ? "opacity-75" : "text-muted"}`}>{t.name}</span>
                  </span>
                  {pos >= 0 && mode === "order" && (
                    <span key={pos} className="pop display absolute right-1 top-1 bg-bg/85 px-1 text-[13px] italic text-text sm:right-1.5 sm:top-1.5 sm:px-1.5 sm:text-[15px]">
                      P{pos + 1}
                    </span>
                  )}
                  {mode === "fl" && on && <Check size={16} strokeWidth={3} className="absolute right-1.5 top-1.5" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Phone: progress + save always in reach while scrolling the grid. */}
      {dirty && !locked && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="flex-1">
              <div className="flex gap-0.5" aria-hidden>
                {Array.from({ length: N }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 -skew-x-12 ${i < picks.length ? "bg-accent" : "bg-surface-3"}`} />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                {picks.length}/{N} picked{isRace ? ` · FL ${fl ? byId.get(fl)?.code : "–"}` : ""}
              </p>
            </div>
            <button className="btn-primary !px-4 !py-2.5" disabled={!complete || busy} onClick={save}>
              {busy && <Loader2 size={15} className="animate-spin" aria-hidden />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
