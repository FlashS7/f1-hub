import { describe, expect, it } from "vitest";
import { SCORING, type ScoringConfig } from "./scoring.config";
import { PredictionError, applyRounding, scoreRound, validatePrediction, type SessionResult } from "./scoring";

// 20 drivers d1..d20, d1 won, d20 last.
const D = Array.from({ length: 20 }, (_, i) => `d${i + 1}`);
const fullResult = (fastestLap: string | null = "d5"): SessionResult => ({
  positions: Object.fromEntries(D.map((d, i) => [d, i + 1])),
  fastestLap,
});
const top10 = D.slice(0, 10);

describe("all exact", () => {
  it("race: 100 slot + FL 5 + top3 15 = 120 x1.5 = 180", () => {
    const s = scoreRound("RACE", { picks: top10, fastestLap: "d5" }, fullResult());
    expect(s.slotPoints).toBe(100);
    expect(s.bonuses.map((b) => b.key).sort()).toEqual(["exactTop3", "fastestLap"]);
    expect(s.raw).toBe(120);
    expect(s.total).toBe(180);
  });
  it("qualifying: 100 + pole 5 = 105 x1.0", () => {
    const s = scoreRound("QUALI", { picks: top10 }, fullResult());
    expect(s.bonuses).toEqual([{ key: "pole", points: 5 }]);
    expect(s.total).toBe(105);
  });
  it("sprint: no bonuses, 100 x0.5 = 50", () => {
    const s = scoreRound("SPRINT", { picks: top10 }, fullResult());
    expect(s.bonuses).toEqual([]);
    expect(s.total).toBe(50);
  });
  it("sprint qualifying: no bonuses, 100 x0.25 = 25", () => {
    const s = scoreRound("SQ", { picks: top10 }, fullResult());
    expect(s.bonuses).toEqual([]);
    expect(s.total).toBe(25);
  });
});

describe("all wrong", () => {
  it("everyone picked finished outside the top 10 -> 0, wrong FL -> 0", () => {
    const s = scoreRound("RACE", { picks: D.slice(10, 20), fastestLap: "d1" }, fullResult("d5"));
    expect(s.slots.every((x) => x.points === 0)).toBe(true);
    expect(s.total).toBe(0);
  });
  it("top 10 drivers but every one 3+ places off -> 1 each", () => {
    // every pick sits at least 3 places away from where the driver finished
    const picks = ["d4", "d5", "d6", "d7", "d8", "d9", "d10", "d1", "d2", "d3"];
    const s = scoreRound("QUALI", { picks }, fullResult());
    expect(s.slots.map((x) => x.points)).toEqual(Array(10).fill(1));
    expect(s.total).toBe(10);
  });
});

describe("slot distances", () => {
  it("exact 10, off-by-1 6, off-by-2 3, off-by-3+ in top 10 1", () => {
    // slot1 d1 exact, slot2 d3 (off1), slot3 d5 (off2), slot4 d10 (off6)
    const picks = ["d1", "d3", "d5", "d10", "d11", "d12", "d13", "d14", "d15", "d16"];
    const s = scoreRound("QUALI", { picks }, fullResult());
    expect(s.slots.slice(0, 4).map((x) => x.points)).toEqual([10, 6, 3, 1]);
  });
  it("driver outside the top 10 scores 0 even if 1 place off", () => {
    const picks = [...D.slice(0, 9), "d11"]; // slot 10 -> actual 11
    const s = scoreRound("QUALI", { picks }, fullResult());
    expect(s.slots[9]).toMatchObject({ driverId: "d11", actual: 11, points: 0 });
  });
});

describe("DNF / unclassified", () => {
  it("unclassified driver (DNF/DNS/DSQ, missing from positions) scores 0", () => {
    const res = fullResult();
    delete res.positions["d1"];
    const s = scoreRound("RACE", { picks: top10, fastestLap: "d5" }, res);
    expect(s.slots[0]).toMatchObject({ actual: null, points: 0 });
    // top 3 bonus lost because P1 isn't classified
    expect(s.bonuses.map((b) => b.key)).toEqual(["fastestLap"]);
  });
  it("retired but classified driver scores by official classified position", () => {
    // d9 retired late but classified P9 -> scored as P9
    const s = scoreRound("RACE", { picks: top10, fastestLap: "x" }, fullResult(null));
    expect(s.slots[8]).toMatchObject({ driverId: "d9", actual: 9, points: 10 });
  });
});

describe("bonuses", () => {
  it("pole only counts in qualifying", () => {
    const quali = scoreRound("QUALI", { picks: top10 }, fullResult());
    const sprint = scoreRound("SPRINT", { picks: top10 }, fullResult());
    expect(quali.bonuses.some((b) => b.key === "pole")).toBe(true);
    expect(sprint.bonuses.some((b) => b.key === "pole")).toBe(false);
  });
  it("no pole bonus if P1 wrong", () => {
    const picks = ["d2", "d1", ...D.slice(2, 10)];
    expect(scoreRound("QUALI", { picks }, fullResult()).bonuses).toEqual([]);
  });
  it("exact top 3 needs the correct order, awarded once", () => {
    const swapped = ["d1", "d3", "d2", ...D.slice(3, 10)];
    expect(scoreRound("RACE", { picks: swapped, fastestLap: "x" }, fullResult()).bonuses).toEqual([]);
    const right = scoreRound("RACE", { picks: top10, fastestLap: "x" }, fullResult());
    expect(right.bonuses.filter((b) => b.key === "exactTop3")).toHaveLength(1);
  });
  it("fastest lap bonus only when it matches", () => {
    const hit = scoreRound("RACE", { picks: D.slice(10, 20), fastestLap: "d15" }, fullResult("d15"));
    expect(hit.raw).toBe(5);
    expect(hit.total).toBe(8); // 7.5 rounds half up
    const miss = scoreRound("RACE", { picks: D.slice(10, 20), fastestLap: "d14" }, fullResult("d15"));
    expect(miss.total).toBe(0);
  });
});

describe("multipliers and rounding", () => {
  it("SQ 0.25: raw 10 -> 2.5 -> 3", () => {
    const picks = ["d1", ...D.slice(10, 19)];
    const s = scoreRound("SQ", { picks }, fullResult());
    expect(s.raw).toBe(10);
    expect(s.total).toBe(3);
  });
  it("SQ 0.25: raw 6 -> 1.5 -> 2, raw 1 -> 0.25 -> 0, raw 3 -> 0.75 -> 1", () => {
    const off1 = ["d2", ...D.slice(10, 19)];
    const in10 = ["d10", ...D.slice(10, 19)];
    const off2 = ["d3", ...D.slice(10, 19)];
    expect(scoreRound("SQ", { picks: off1 }, fullResult()).total).toBe(2);
    expect(scoreRound("SQ", { picks: in10 }, fullResult()).total).toBe(0);
    expect(scoreRound("SQ", { picks: off2 }, fullResult()).total).toBe(1);
  });
  it("sprint 0.5: raw 12 -> 6, raw 7 -> 3.5 -> 4", () => {
    const picks = ["d2", "d1", ...D.slice(10, 18)]; // 6 + 6 = 12 -> 6
    expect(scoreRound("SPRINT", { picks }, fullResult()).total).toBe(6);
    const odd = ["d2", "d10", ...D.slice(10, 18)]; // 6 + 1 = 7 -> 3.5 -> 4
    expect(scoreRound("SPRINT", { picks: odd }, fullResult()).total).toBe(4);
  });
  it("rounding rule comes from config", () => {
    const picks = ["d1", ...D.slice(10, 19)]; // raw 10, SQ -> 2.5
    const floorCfg: ScoringConfig = { ...SCORING, rounding: "floor" };
    const noneCfg: ScoringConfig = { ...SCORING, rounding: "none" };
    expect(scoreRound("SQ", { picks }, fullResult(), floorCfg).total).toBe(2);
    expect(scoreRound("SQ", { picks }, fullResult(), noneCfg).total).toBe(2.5);
    expect(applyRounding(2.5, "ceil")).toBe(3);
  });
  it("multiplier values come from config", () => {
    const cfg = { ...SCORING, multipliers: { ...SCORING.multipliers, QUALI: 2 } };
    expect(scoreRound("QUALI", { picks: top10 }, fullResult(), cfg).total).toBe(210);
  });
  it("never negative", () => {
    const cfg = { ...SCORING, outsideTop10: -5 };
    const s = scoreRound("RACE", { picks: D.slice(10, 20), fastestLap: "x" }, fullResult(), cfg);
    expect(s.total).toBe(0);
  });
});

describe("input validation", () => {
  it("rejects a driver predicted twice", () => {
    const picks = ["d1", "d1", ...D.slice(2, 10)];
    expect(() => validatePrediction("QUALI", { picks })).toThrow(PredictionError);
    expect(() => scoreRound("QUALI", { picks }, fullResult())).toThrow(/more than once/);
  });
  it("rejects fewer or more than 10 drivers", () => {
    expect(() => validatePrediction("QUALI", { picks: D.slice(0, 9) })).toThrow(PredictionError);
    expect(() => validatePrediction("QUALI", { picks: D.slice(0, 11) })).toThrow(PredictionError);
  });
  it("race requires a fastest lap pick", () => {
    expect(() => validatePrediction("RACE", { picks: top10 })).toThrow(/fastest lap/);
  });
  it("rejects drivers not on the grid", () => {
    expect(() => validatePrediction("QUALI", { picks: ["zz", ...D.slice(1, 10)] }, D)).toThrow(/Unknown/);
  });
});
