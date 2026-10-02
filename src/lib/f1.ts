// Server-side F1 data access: Jolpica (Ergast-compatible) + OpenF1 for Sprint Qualifying results.
import type { RoundType } from "./scoring.config";
import type { SessionResult } from "./scoring";
import type {
  ConstructorStanding,
  Driver,
  DriverStanding,
  RaceResult,
  ResultRow,
  Session,
  SessionKey,
  Weekend,
} from "./types";

const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const OPENF1 = "https://api.openf1.org/v1";

/** Revalidate windows (seconds). */
export const CACHE = { schedule: 600, standings: 300, results: 300 };

const DURATION_MIN: Record<SessionKey, number> = {
  FP1: 60, FP2: 60, FP3: 60, SQ: 45, SPRINT: 60, QUALI: 60, RACE: 120,
};
const LABEL: Record<SessionKey, string> = {
  FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3",
  SQ: "Sprint Qualifying", SPRINT: "Sprint", QUALI: "Qualifying", RACE: "Race",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string, revalidate: number | false): Promise<any> {
  const res = await fetch(url, {
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
    signal: AbortSignal.timeout(8000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const jolpica = (path: string, revalidate: number | false) => getJson(`${JOLPICA}/${path}`, revalidate);

/* ---------- mappers ---------- */

function mapDriver(d: any, teamId: string): Driver {
  return {
    id: d.driverId,
    code: d.code ?? d.familyName.slice(0, 3).toUpperCase(),
    number: d.permanentNumber ?? "",
    firstName: d.givenName,
    lastName: d.familyName,
    teamId,
  };
}

function iso(date: string, time?: string) {
  return new Date(`${date}T${time ?? "00:00:00Z"}`).toISOString();
}

function mapWeekend(r: any): Weekend {
  const raw: [SessionKey, any][] = [
    ["FP1", r.FirstPractice],
    ["FP2", r.SecondPractice],
    ["FP3", r.ThirdPractice],
    ["SQ", r.SprintQualifying],
    ["SPRINT", r.Sprint],
    ["QUALI", r.Qualifying],
    ["RACE", { date: r.date, time: r.time }],
  ];
  const sessions: Session[] = raw
    .filter(([, s]) => s?.date)
    .map(([key, s]) => {
      const start = iso(s.date, s.time);
      const end = new Date(new Date(start).getTime() + DURATION_MIN[key] * 60_000).toISOString();
      return { key, label: LABEL[key], start, end };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  return {
    season: Number(r.season),
    round: Number(r.round),
    name: r.raceName,
    circuitId: r.Circuit.circuitId,
    circuitName: r.Circuit.circuitName,
    locality: r.Circuit.Location.locality,
    country: r.Circuit.Location.country,
    isSprint: Boolean(r.Sprint),
    sessions,
  };
}

/* ---------- schedule ---------- */

export async function getSchedule(season: number | "current" = "current"): Promise<Weekend[]> {
  const j = await jolpica(`${season}.json?limit=100`, CACHE.schedule);
  return (j.MRData.RaceTable.Races as any[]).map(mapWeekend);
}

export async function getWeekend(season: number, round: number): Promise<Weekend | null> {
  const all = await getSchedule(season);
  return all.find((w) => w.round === round) ?? null;
}

/**
 * The weekend to feature on the hub: the first one whose last session hasn't ended.
 * Looks into next season's calendar at the end of the year. Null = off-season with no calendar.
 */
export async function getFeaturedWeekend(now = new Date()): Promise<{ weekend: Weekend | null; season: number }> {
  const current = await getSchedule("current");
  const season = current[0]?.season ?? now.getUTCFullYear();
  const upcoming = current.find((w) => new Date(w.sessions.at(-1)!.end) > now);
  if (upcoming) return { weekend: upcoming, season };
  try {
    const next = await getSchedule(season + 1);
    const w = next.find((x) => new Date(x.sessions.at(-1)!.end) > now) ?? null;
    return { weekend: w, season: w ? season + 1 : season };
  } catch {
    return { weekend: null, season };
  }
}

/* ---------- standings & results ---------- */

export async function getDriverStandings(season: number | "current" = "current"): Promise<DriverStanding[]> {
  const j = await jolpica(`${season}/driverstandings.json?limit=100`, CACHE.standings);
  const list = j.MRData.StandingsTable.StandingsLists[0];
  if (!list) return [];
  return (list.DriverStandings as any[]).map((s) => ({
    position: Number(s.position ?? s.positionText) || 0,
    points: Number(s.points),
    wins: Number(s.wins),
    driver: mapDriver(s.Driver, s.Constructors.at(-1)?.constructorId ?? ""),
  }));
}

export async function getConstructorStandings(season: number | "current" = "current"): Promise<ConstructorStanding[]> {
  const j = await jolpica(`${season}/constructorstandings.json?limit=100`, CACHE.standings);
  const list = j.MRData.StandingsTable.StandingsLists[0];
  if (!list) return [];
  return (list.ConstructorStandings as any[]).map((s) => ({
    position: Number(s.position ?? s.positionText) || 0,
    points: Number(s.points),
    wins: Number(s.wins),
    teamId: s.Constructor.constructorId,
    name: s.Constructor.name,
  }));
}

function mapRows(rows: any[]): ResultRow[] {
  return rows.map((x) => ({
    position: /^\d+$/.test(x.positionText) ? Number(x.positionText) : null,
    positionText: x.positionText,
    driver: mapDriver(x.Driver, x.Constructor.constructorId),
    status: x.status,
    points: Number(x.points ?? 0),
    time: x.Time?.time,
    fastestLapRank: x.FastestLap?.rank ? Number(x.FastestLap.rank) : undefined,
  }));
}

export async function getLastRaceResult(season: number | "current" = "current"): Promise<RaceResult | null> {
  const j = await jolpica(`${season}/last/results.json?limit=100`, CACHE.results);
  const r = j.MRData.RaceTable.Races[0];
  if (!r) return null;
  return { season: Number(r.season), round: Number(r.round), name: r.raceName, rows: mapRows(r.Results) };
}

/** Drivers on the current grid with their current team, from the latest race (falls back to last season). */
export async function getGrid(): Promise<Driver[]> {
  let last = await getLastRaceResult("current").catch(() => null);
  if (!last) {
    const sched = await getSchedule("current").catch(() => []);
    const season = sched[0]?.season ?? new Date().getUTCFullYear();
    last = await getLastRaceResult(season - 1).catch(() => null);
  }
  if (!last) return [];
  const order = Object.keys((await import("./teams")).TEAMS);
  return last.rows
    .map((r) => r.driver)
    .sort((a, b) => {
      const t = order.indexOf(a.teamId) - order.indexOf(b.teamId);
      return t !== 0 ? t : a.lastName.localeCompare(b.lastName);
    });
}

/* ---------- session results for scoring ---------- */

/**
 * Official result for a prediction round. Null when it isn't published yet.
 * Always bypasses the cache so penalties/DSQ changes come through.
 */
export async function getSessionResult(season: number, round: number, type: RoundType): Promise<SessionResult | null> {
  if (type === "SQ") return getSprintQualifyingResult(season, round);

  const path = { RACE: "results", SPRINT: "sprint", QUALI: "qualifying" }[type];
  const j = await jolpica(`${season}/${round}/${path}.json?limit=100`, false);
  const r = j.MRData.RaceTable.Races[0];
  if (!r) return null;
  const rows: any[] = r.Results ?? r.SprintResults ?? r.QualifyingResults ?? [];
  if (rows.length === 0) return null;

  const positions: Record<string, number> = {};
  for (const x of rows) {
    // Qualifying has no positionText; everyone in the list gets their position.
    const text = x.positionText ?? x.position;
    if (/^\d+$/.test(String(text))) positions[x.Driver.driverId] = Number(text);
  }
  const fl = type === "RACE" ? rows.find((x) => x.FastestLap?.rank === "1")?.Driver.driverId ?? null : null;
  return { positions, fastestLap: fl };
}

/**
 * OpenF1 answers 401 to everyone without a paid key while ANY live session is running
 * (even for past data). Treat that as "not available yet"; scoring retries later.
 */
async function getSprintQualifyingResult(season: number, round: number): Promise<SessionResult | null> {
  try {
    return await fetchSprintQualifyingResult(season, round);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("401 ")) {
      console.warn("OpenF1 locked during a live session; SQ result retried later");
      return null;
    }
    throw e;
  }
}

async function fetchSprintQualifyingResult(season: number, round: number): Promise<SessionResult | null> {
  const weekend = await getWeekend(season, round);
  const sq = weekend?.sessions.find((s) => s.key === "SQ");
  if (!sq) return null;

  const sessions: any[] = await getJson(`${OPENF1}/sessions?year=${season}&session_name=Sprint%20Qualifying`, false);
  const target = new Date(sq.start).getTime();
  const match = sessions.find((s) => Math.abs(new Date(s.date_start).getTime() - target) < 36 * 3600_000);
  if (!match) return null;

  const [results, drivers, seasonDrivers] = await Promise.all([
    getJson(`${OPENF1}/session_result?session_key=${match.session_key}`, false) as Promise<any[]>,
    getJson(`${OPENF1}/drivers?session_key=${match.session_key}`, false) as Promise<any[]>,
    jolpica(`${season}/drivers.json?limit=100`, CACHE.schedule),
  ]);
  if (!results.length) return null;

  const numToCode = new Map(drivers.map((d) => [Number(d.driver_number), d.name_acronym as string]));
  const codeToId = new Map(
    (seasonDrivers.MRData.DriverTable.Drivers as any[]).map((d) => [d.code as string, d.driverId as string]),
  );
  const positions: Record<string, number> = {};
  for (const r of results) {
    if (r.position == null || r.dsq || r.dns) continue;
    const id = codeToId.get(numToCode.get(Number(r.driver_number)) ?? "");
    if (id) positions[id] = Number(r.position);
  }
  return Object.keys(positions).length ? { positions, fastestLap: null } : null;
}
