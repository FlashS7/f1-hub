import { SCORING, type RoundType, type RoundingRule, type ScoringConfig } from "./scoring.config";

/** Official result of one session, reduced to what scoring needs. */
export interface SessionResult {
  /** driverId -> classified finishing position. Unclassified / DNS / DSQ drivers are absent. */
  positions: Record<string, number>;
  /** driverId of the fastest lap holder (race only). */
  fastestLap?: string | null;
}

export interface Prediction {
  /** Ordered list of driverIds, index 0 = P1. */
  picks: string[];
  /** Race round only. */
  fastestLap?: string | null;
}

export interface SlotScore {
  slot: number; // 1-based predicted position
  driverId: string;
  actual: number | null; // classified position, null if not classified
  points: number;
}

export interface RoundScore {
  round: RoundType;
  slots: SlotScore[];
  slotPoints: number;
  bonuses: { key: "pole" | "fastestLap" | "exactTop3"; points: number }[];
  bonusPoints: number;
  raw: number;
  multiplier: number;
  total: number;
}

export class PredictionError extends Error {}

/** Throws PredictionError if the prediction is malformed. Also used by the API before saving. */
export function validatePrediction(
  round: RoundType,
  p: Prediction,
  validDrivers?: Iterable<string>,
  cfg: ScoringConfig = SCORING,
): void {
  if (!Array.isArray(p.picks) || p.picks.length !== cfg.topN) {
    throw new PredictionError(`Pick exactly ${cfg.topN} drivers`);
  }
  if (p.picks.some((d) => typeof d !== "string" || d.length === 0)) {
    throw new PredictionError("Every slot needs a driver");
  }
  const seen = new Set<string>();
  for (const d of p.picks) {
    if (seen.has(d)) throw new PredictionError(`Driver ${d} is picked more than once`);
    seen.add(d);
  }
  const valid = validDrivers ? new Set(validDrivers) : null;
  if (valid) {
    for (const d of p.picks) if (!valid.has(d)) throw new PredictionError(`Unknown driver ${d}`);
  }
  if (round === "RACE") {
    if (!p.fastestLap) throw new PredictionError("Pick the fastest lap driver");
    if (valid && !valid.has(p.fastestLap)) throw new PredictionError(`Unknown driver ${p.fastestLap}`);
  }
}

export function applyRounding(value: number, rule: RoundingRule): number {
  // Guard against float noise like 12.499999999 when 12.5 was meant.
  const v = Math.round(value * 1e9) / 1e9;
  switch (rule) {
    case "nearest":
      return Math.round(v);
    case "floor":
      return Math.floor(v);
    case "ceil":
      return Math.ceil(v);
    case "none":
      return v;
  }
}

export function slotPoints(slot: number, actual: number | null, cfg: ScoringConfig = SCORING): number {
  if (actual === null || actual > cfg.topN) return cfg.outsideTop10;
  const dist = Math.abs(slot - actual);
  if (dist < cfg.slotPointsByDistance.length) return cfg.slotPointsByDistance[dist];
  return cfg.inTop10;
}

/** Pure scoring of one prediction round. Never returns negative points. */
export function scoreRound(
  round: RoundType,
  prediction: Prediction,
  result: SessionResult,
  cfg: ScoringConfig = SCORING,
): RoundScore {
  validatePrediction(round, prediction, undefined, cfg);

  const slots: SlotScore[] = prediction.picks.map((driverId, i) => {
    const actual = result.positions[driverId] ?? null;
    return { slot: i + 1, driverId, actual, points: slotPoints(i + 1, actual, cfg) };
  });
  const slotTotal = slots.reduce((s, x) => s + x.points, 0);

  const b = cfg.bonuses[round] ?? {};
  const bonuses: RoundScore["bonuses"] = [];
  if (b.pole && slots[0].actual === 1) bonuses.push({ key: "pole", points: b.pole });
  if (b.fastestLap && result.fastestLap && prediction.fastestLap === result.fastestLap) {
    bonuses.push({ key: "fastestLap", points: b.fastestLap });
  }
  if (b.exactTop3 && slots.slice(0, 3).every((s) => s.actual === s.slot)) {
    bonuses.push({ key: "exactTop3", points: b.exactTop3 });
  }
  const bonusTotal = bonuses.reduce((s, x) => s + x.points, 0);

  const raw = slotTotal + bonusTotal;
  const multiplier = cfg.multipliers[round];
  const total = Math.max(0, applyRounding(raw * multiplier, cfg.rounding));

  return { round, slots, slotPoints: slotTotal, bonuses, bonusPoints: bonusTotal, raw, multiplier, total };
}

/** Max points a round can give, handy for accuracy stats. */
export function maxRoundPoints(round: RoundType, cfg: ScoringConfig = SCORING): number {
  const b = cfg.bonuses[round] ?? {};
  const raw = cfg.slotPointsByDistance[0] * cfg.topN + (b.pole ?? 0) + (b.fastestLap ?? 0) + (b.exactTop3 ?? 0);
  return applyRounding(raw * cfg.multipliers[round], cfg.rounding);
}
