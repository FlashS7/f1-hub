import { describe, expect, it } from "vitest";
import { applyOverrides } from "./f1";
import { isLocked, predictionRounds } from "./rounds";
import type { Weekend } from "./types";

const w: Weekend = {
  season: 2026, round: 17, name: "Singapore Grand Prix", circuitId: "marina_bay", circuitName: "", locality: "", country: "", isSprint: true,
  sessions: [
    { key: "SPRINT", label: "Sprint", start: "2026-10-10T09:00:00.000Z", end: "2026-10-10T10:00:00.000Z" },
    { key: "QUALI", label: "Qualifying", start: "2026-10-10T13:00:00.000Z", end: "2026-10-10T14:00:00.000Z" },
  ],
};

describe("session delays", () => {
  const delayed = applyOverrides([w], [{ season: 2026, round: 17, session_key: "QUALI", start: "2026-10-10T13:30:00Z" }])[0];
  const q = delayed.sessions.find((s) => s.key === "QUALI")!;

  it("moves start and end, remembers the original start", () => {
    expect(q.start).toBe("2026-10-10T13:30:00.000Z");
    expect(q.end).toBe("2026-10-10T14:30:00.000Z");
    expect(q.scheduledStart).toBe("2026-10-10T13:00:00.000Z");
  });
  it("picks lock at the new start, not the old one", () => {
    const r = predictionRounds(delayed).find((x) => x.type === "QUALI")!;
    expect(isLocked(r.lockAt, new Date("2026-10-10T13:15:00Z"))).toBe(false);
    expect(isLocked(r.lockAt, new Date("2026-10-10T13:30:00Z"))).toBe(true);
  });
  it("leaves other sessions and weekends alone", () => {
    expect(delayed.sessions.find((s) => s.key === "SPRINT")!.scheduledStart).toBeUndefined();
    expect(applyOverrides([w], [{ season: 2026, round: 18, session_key: "QUALI", start: "2026-10-24T22:00:00Z" }])[0]).toBe(w);
  });
});
