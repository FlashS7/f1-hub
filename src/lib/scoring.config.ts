/**
 * ALL scoring rules live here. Change numbers in this file only;
 * the scoring logic in scoring.ts reads everything from this object.
 */

export type RoundType = "SQ" | "SPRINT" | "QUALI" | "RACE";

export type RoundingRule = "nearest" | "floor" | "ceil" | "none";

export interface ScoringConfig {
  slotPointsByDistance: number[];
  inTop10: number;
  outsideTop10: number;
  topN: number;
  bonuses: Record<RoundType, { pole?: number; fastestLap?: number; exactTop3?: number }>;
  multipliers: Record<RoundType, number>;
  rounding: RoundingRule;
}

export const SCORING: ScoringConfig = {
  /**
   * Slot points indexed by distance between predicted slot and actual position.
   * [exact, off by 1, off by 2]. Anything further away falls to `inTop10`.
   */
  slotPointsByDistance: [10, 6, 3],

  /** Driver is 3+ places off but still finished inside the actual top 10. */
  inTop10: 1,

  /** Driver finished outside the top 10, wasn't classified, DNS or DSQ. */
  outsideTop10: 0,

  /** Size of the predicted list and the "top N" window used above. */
  topN: 10,

  bonuses: {
    QUALI: { pole: 5 },
    RACE: { fastestLap: 5, exactTop3: 15 },
    SPRINT: {},
    SQ: {},
  },

  /** Applied to the round total (slot points + bonuses). */
  multipliers: {
    RACE: 1.5,
    QUALI: 1.0,
    SPRINT: 0.5,
    SQ: 0.25,
  },

  /**
   * How the multiplied round total is turned into a whole number.
   * "nearest" rounds half up (12.5 -> 13), "floor"/"ceil" as named,
   * "none" keeps decimals.
   */
  rounding: "nearest",
};

export const ROUND_LABELS: Record<RoundType, string> = {
  SQ: "Sprint Qualifying",
  SPRINT: "Sprint",
  QUALI: "Qualifying",
  RACE: "Race",
};

export const ROUND_ORDER: RoundType[] = ["SQ", "SPRINT", "QUALI", "RACE"];
