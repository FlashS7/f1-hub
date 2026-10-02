import type { RoundType } from "./scoring.config";

export type SessionKey = "FP1" | "FP2" | "FP3" | RoundType;

export interface Session {
  key: SessionKey;
  label: string;
  /** ISO UTC start */
  start: string;
  /** ISO UTC estimated end */
  end: string;
}

export interface Weekend {
  season: number;
  round: number;
  name: string;
  circuitId: string;
  circuitName: string;
  locality: string;
  country: string;
  isSprint: boolean;
  sessions: Session[];
}

export interface Driver {
  id: string; // Jolpica driverId
  code: string; // 3-letter
  number: string;
  firstName: string;
  lastName: string;
  teamId: string;
}

export interface DriverStanding {
  position: number;
  points: number;
  wins: number;
  driver: Driver;
}

export interface ConstructorStanding {
  position: number;
  points: number;
  wins: number;
  teamId: string;
  name: string;
}

export interface ResultRow {
  position: number | null; // null = not classified
  positionText: string;
  driver: Driver;
  status: string;
  points: number;
  time?: string;
  fastestLapRank?: number;
}

export interface RaceResult {
  season: number;
  round: number;
  name: string;
  rows: ResultRow[];
}
