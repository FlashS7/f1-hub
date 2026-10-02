import { ROUND_ORDER, type RoundType } from "./scoring.config";
import type { Weekend } from "./types";

export interface PredRound {
  season: number;
  round: number;
  type: RoundType;
  /** Session start = prediction lock. */
  lockAt: string;
  /** Estimated session end. */
  endAt: string;
}

export type RoundStatus = "open" | "locked" | "scored";

/** Wait this long after a session's scheduled end before trying to fetch its result. */
export const RESULT_GRACE_MIN = 20;

export function predictionRounds(w: Weekend): PredRound[] {
  return ROUND_ORDER.flatMap((type) => {
    const s = w.sessions.find((x) => x.key === type);
    return s ? [{ season: w.season, round: w.round, type, lockAt: s.start, endAt: s.end }] : [];
  });
}

export function isLocked(lockAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(lockAt).getTime();
}

export function roundStatus(r: Pick<PredRound, "lockAt">, scored: boolean, now: Date = new Date()): RoundStatus {
  if (scored) return "scored";
  return isLocked(r.lockAt, now) ? "locked" : "open";
}

export function readyToScore(r: Pick<PredRound, "endAt">, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(r.endAt).getTime() + RESULT_GRACE_MIN * 60_000;
}

/** Stable ordering key for "which round came later". */
export const roundKey = (round: number, type: RoundType) => round * 10 + ROUND_ORDER.indexOf(type);
