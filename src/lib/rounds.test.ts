import { describe, expect, it } from "vitest";
import { isLocked, predictionRounds, readyToScore, roundStatus } from "./rounds";
import { buildLeaderboard, type LbScore } from "./leaderboard";
import type { Weekend } from "./types";

const s = (key: string, start: string, mins: number) => ({
  key, label: key, start, end: new Date(new Date(start).getTime() + mins * 60_000).toISOString(),
});

const sprintWeekend: Weekend = {
  season: 2026, round: 17, name: "Singapore", circuitId: "marina_bay", circuitName: "", locality: "", country: "",
  isSprint: true,
  sessions: [
    s("FP1", "2026-10-09T09:30:00.000Z", 60),
    s("SQ", "2026-10-09T13:30:00.000Z", 45),
    s("SPRINT", "2026-10-10T09:00:00.000Z", 60),
    s("QUALI", "2026-10-10T13:00:00.000Z", 60),
    s("RACE", "2026-10-11T12:00:00.000Z", 120),
  ] as Weekend["sessions"],
};

describe("prediction rounds and locks", () => {
  it("sprint weekend has 4 separate rounds, each locking at its own session start", () => {
    const r = predictionRounds(sprintWeekend);
    expect(r.map((x) => [x.type, x.lockAt])).toEqual([
      ["SQ", "2026-10-09T13:30:00.000Z"],
      ["SPRINT", "2026-10-10T09:00:00.000Z"],
      ["QUALI", "2026-10-10T13:00:00.000Z"],
      ["RACE", "2026-10-11T12:00:00.000Z"],
    ]);
  });
  it("normal weekend has only QUALI and RACE", () => {
    const w = { ...sprintWeekend, isSprint: false, sessions: sprintWeekend.sessions.filter((x) => !["SQ", "SPRINT"].includes(x.key)) };
    expect(predictionRounds(w).map((x) => x.type)).toEqual(["QUALI", "RACE"]);
  });
  it("locks exactly at session start, not a millisecond later", () => {
    const lock = "2026-10-10T13:00:00.000Z";
    expect(isLocked(lock, new Date("2026-10-10T12:59:59.999Z"))).toBe(false);
    expect(isLocked(lock, new Date("2026-10-10T13:00:00.000Z"))).toBe(true);
  });
  it("rounds lock independently: SQ locked while race is still open", () => {
    const now = new Date("2026-10-09T14:00:00Z");
    const st = predictionRounds(sprintWeekend).map((r) => [r.type, roundStatus(r, false, now)]);
    expect(st).toEqual([["SQ", "locked"], ["SPRINT", "open"], ["QUALI", "open"], ["RACE", "open"]]);
  });
  it("scored overrides locked; scoring waits for session end + grace", () => {
    const [sq] = predictionRounds(sprintWeekend);
    expect(roundStatus(sq, true, new Date("2026-10-09T20:00:00Z"))).toBe("scored");
    expect(readyToScore(sq, new Date("2026-10-09T14:20:00Z"))).toBe(false);
    expect(readyToScore(sq, new Date("2026-10-09T14:40:00Z"))).toBe(true);
  });
});

describe("leaderboard", () => {
  const players = [
    { id: "a", nickname: "Alice", teamId: "ferrari" },
    { id: "b", nickname: "Bob", teamId: "mclaren" },
    { id: "c", nickname: "Cyril", teamId: "mercedes" },
  ];
  const sc = (playerId: string, round: number, roundType: LbScore["roundType"], total: number): LbScore => ({
    playerId, round, roundType, total, exact: 1, slots: 10,
  });

  it("totals, gap, weekends won, average, movement", () => {
    const scores = [
      sc("a", 15, "QUALI", 40), sc("b", 15, "QUALI", 20),
      sc("a", 15, "RACE", 30), sc("b", 15, "RACE", 30),
      sc("b", 16, "QUALI", 50), sc("c", 16, "QUALI", 10),
    ];
    const lb = buildLeaderboard(players, scores);
    expect(lb.map((r) => [r.player.nickname, r.position, r.total, r.gap])).toEqual([
      ["Bob", 1, 100, 0],
      ["Alice", 2, 70, 30],
      ["Cyril", 3, 10, 90],
    ]);
    const bob = lb[0];
    expect(bob.weekendsPlayed).toBe(2);
    expect(bob.weekendsWon).toBe(1); // round 16
    expect(lb[1].weekendsWon).toBe(1); // Alice won round 15 (70 vs 50)
    expect(bob.average).toBe(50);
    expect(bob.best).toEqual({ round: 15, points: 50 }); // 50 in both weekends, tie keeps the earlier one
    expect(lb[1].best).toEqual({ round: 15, points: 70 });
    // before round 16 quali: Alice 70, Bob 50, Cyril 0 -> Bob moved up 1, Alice down 1
    expect(bob.movement).toBe(1);
    expect(lb[1].movement).toBe(-1);
    expect(bob.accuracy).toBeCloseTo(0.1);
  });

  it("ties share a position, no scores means no movement", () => {
    const lb = buildLeaderboard(players, []);
    expect(lb.map((r) => r.position)).toEqual([1, 1, 1]);
    expect(lb.every((r) => r.movement === 0 && r.gap === 0)).toBe(true);
  });
});
