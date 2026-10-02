import { CIRCUITS } from "@/data/circuits";

/** Circuit outline from open GeoJSON data, drawn on with a stroke animation. */
export function TrackMap({ circuitId, name, className = "" }: { circuitId: string; name: string; className?: string }) {
  const c = CIRCUITS[circuitId];
  if (!c) {
    return (
      <div className={`flex items-center justify-center text-xs uppercase tracking-widest text-faint ${className}`}>
        Layout unavailable
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${c.w} ${c.h}`} className={className} role="img" aria-label={`${name} track layout`}>
      <path d={c.d} fill="none" stroke="var(--surface-3)" strokeWidth={34} strokeLinejoin="round" strokeLinecap="round" />
      <path
        d={c.d}
        pathLength={1}
        className="track-draw"
        fill="none"
        stroke="var(--text)"
        strokeWidth={12}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={c.d}
        pathLength={1}
        className="track-draw"
        style={{ animationDelay: "0.25s" }}
        fill="none"
        stroke="var(--red)"
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
