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

/** OpenF1's free tier allows ~3 requests/s: space calls out and retry a 429 a few times. */
let openF1Queue: Promise<unknown> = Promise.resolve();
function openF1(path: string, revalidate: number | false = false): Promise<any> {
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await getJson(`${OPENF1}/${path}`, revalidate);
      } catch (e) {
        if (attempt < 3 && e instanceof Error && e.message.startsWith("429 ")) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
  };
  const p = openF1Queue.then(run, run);
  openF1Queue = p.then(
    () => new Promise((r) => setTimeout(r, 400)),
    () => new Promise((r) => setTimeout(r, 400)),
  );
  return p;
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

export async function getDriverStandings(season: number | string = "current"): Promise<DriverStanding[]> {
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

export async function getConstructorStandings(season: number | string = "current"): Promise<ConstructorStanding[]> {
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

const OPENF1_SESSION: Record<RoundType, string> = {
  SQ: "Sprint Qualifying", SPRINT: "Sprint", QUALI: "Qualifying", RACE: "Race",
};

/**
 * Official result for a prediction round. Null when it isn't published yet.
 * Jolpica first (it carries penalties and the fastest lap); it can lag hours behind, so OpenF1 fills in.
 * Sprint Qualifying only exists in OpenF1. Always bypasses the cache so late changes come through.
 */
export async function getSessionResult(season: number, round: number, type: RoundType): Promise<SessionResult | null> {
  if (type !== "SQ") {
    const fromJolpica = await getJolpicaResult(season, round, type).catch((e) => {
      console.warn("Jolpica result failed", e);
      return null;
    });
    if (fromJolpica) return fromJolpica;
  }
  return getOpenF1Result(season, round, type);
}

async function getJolpicaResult(season: number, round: number, type: Exclude<RoundType, "SQ">): Promise<SessionResult | null> {
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
export async function getOpenF1Result(season: number, round: number, type: RoundType): Promise<SessionResult | null> {
  try {
    return await fetchOpenF1Result(season, round, type);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("401 ")) {
      console.warn("OpenF1 locked during a live session; result retried later");
      return null;
    }
    throw e;
  }
}

/** One OpenF1 session's classification, with driver numbers mapped to Jolpica driverIds. Null if not found/empty. */
async function openF1Session(season: number, round: number, type: RoundType, revalidate: number | false = false) {
  const weekend = await getWeekend(season, round);
  const session = weekend?.sessions.find((s) => s.key === type);
  if (!session) return null;

  // Match by start time: OpenF1 names meetings differently (e.g. "Bahrain" for the race held in Malaysia).
  const sessions: any[] = await openF1(`sessions?year=${season}&session_name=${encodeURIComponent(OPENF1_SESSION[type])}`, revalidate).catch(notFoundAsEmpty);
  const target = new Date(session.start).getTime();
  const match = sessions.find((s) => Math.abs(new Date(s.date_start).getTime() - target) < 36 * 3600_000);
  if (!match) return null;
  const key = match.session_key;

  const [results, drivers, seasonDrivers] = await Promise.all([
    openF1(`session_result?session_key=${key}`, revalidate).catch(notFoundAsEmpty) as Promise<any[]>,
    openF1(`drivers?session_key=${key}`, revalidate).catch(notFoundAsEmpty) as Promise<any[]>,
    jolpica(`${season}/drivers.json?limit=100`, CACHE.schedule),
  ]);
  if (!results.length) return null;

  const numToCode = new Map(drivers.map((d) => [Number(d.driver_number), d.name_acronym as string]));
  const codeToId = new Map(
    (seasonDrivers.MRData.DriverTable.Drivers as any[]).map((d) => [d.code as string, d.driverId as string]),
  );
  const idOf = (num: unknown) => codeToId.get(numToCode.get(Number(num)) ?? "");
  return { key, results, idOf, weekend: weekend! };
}

async function openF1FastestLap(key: number, idOf: (n: unknown) => string | undefined, revalidate: number | false = false): Promise<string | null> {
  const laps: any[] = await openF1(`laps?session_key=${key}`, revalidate).catch(notFoundAsEmpty);
  let best: any = null;
  for (const l of laps) if (l.lap_duration && (!best || l.lap_duration < best.lap_duration)) best = l;
  return best ? idOf(best.driver_number) ?? null : null;
}

async function fetchOpenF1Result(season: number, round: number, type: RoundType): Promise<SessionResult | null> {
  const s = await openF1Session(season, round, type);
  if (!s) return null;
  const { key, results, idOf } = s;

  const positions: Record<string, number> = {};
  for (const r of results) {
    // Disqualified never scores. In qualifying a non-starter still gets a grid slot; in a race they don't.
    if (r.position == null || r.dsq) continue;
    if (r.dns && (type === "RACE" || type === "SPRINT")) continue;
    const id = idOf(r.driver_number);
    if (id) positions[id] = Number(r.position);
  }
  if (!Object.keys(positions).length) return null;

  const fastestLap = type === "RACE" ? await openF1FastestLap(key, idOf) : null;
  return { positions, fastestLap };
}

/* ---------- hub: latest race + standings, filling Jolpica's lag with OpenF1 ---------- */

/** Weekends whose race finished at least `graceMin` ago, in calendar order. */
function finishedWeekends(schedule: Weekend[], now = Date.now(), graceMin = 20) {
  return schedule.filter((w) => {
    const race = w.sessions.find((s) => s.key === "RACE");
    return race && new Date(race.end).getTime() + graceMin * 60_000 < now;
  });
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Last race result for the hub. Jolpica can be hours behind; if the latest finished race is missing there,
 * build it from OpenF1 and mark it provisional.
 */
export async function getLatestRaceResult(): Promise<RaceResult | null> {
  const official = await getLastRaceResult("current").catch(() => null);
  const schedule = await getSchedule("current").catch(() => [] as Weekend[]);
  const latest = finishedWeekends(schedule).at(-1);
  if (!latest || (official && official.round >= latest.round)) return official;
  try {
    const s = await openF1Session(latest.season, latest.round, "RACE", CACHE.results);
    if (!s) return official;
    const grid = new Map((await getGrid()).map((d) => [d.id, d]));
    const fl = await openF1FastestLap(s.key, s.idOf, CACHE.results);
    const rows: ResultRow[] = [...s.results]
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
      .flatMap((r) => {
        const id = s.idOf(r.driver_number);
        const driver = id ? grid.get(id) : undefined;
        if (!driver) return [];
        const out = r.dsq ? "DSQ" : r.dns ? "DNS" : r.dnf && r.position == null ? "DNF" : null;
        const gap = r.gap_to_leader;
        return [{
          position: out ? null : r.position,
          positionText: out ?? String(r.position),
          driver,
          status: out ?? (r.dnf ? "Retired" : "Finished"),
          points: Number(r.points ?? 0),
          time: out ? undefined : r.position === 1 && r.duration ? fmtDuration(r.duration) : typeof gap === "number" ? `+${gap.toFixed(3)}s` : gap ?? undefined,
          fastestLapRank: id === fl ? 1 : undefined,
        }];
      });
    return { season: latest.season, round: latest.round, name: latest.name, rows, provisional: true };
  } catch (e) {
    console.warn("provisional result failed", e);
    return official;
  }
}

export interface Standings {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  /** Rounds whose points come from OpenF1 because Jolpica hasn't published them yet. */
  provisionalRounds: number[];
}

/**
 * Championship standings: Jolpica's official table after the last race it has results for,
 * plus race and sprint points from OpenF1 for any later finished weekends (marked provisional).
 */
export async function getStandings(): Promise<Standings> {
  const official = await getLastRaceResult("current").catch(() => null);
  const schedule = await getSchedule("current").catch(() => [] as Weekend[]);
  const season = schedule[0]?.season ?? new Date().getUTCFullYear();
  const base = official ? `${season}/${official.round}` : "current";
  const [drivers, constructors] = await Promise.all([getDriverStandings(base), getConstructorStandings(base)]);

  const later = finishedWeekends(schedule).filter((w) => w.round > (official?.round ?? 0));
  if (!later.length) return { drivers, constructors, provisionalRounds: [] };

  try {
    const grid = new Map((await getGrid()).map((d) => [d.id, d]));
    const dMap = new Map(drivers.map((d) => [d.driver.id, { ...d }]));
    const cMap = new Map(constructors.map((c) => [c.teamId, { ...c }]));
    const done: number[] = [];
    for (const w of later) {
      for (const type of (w.isSprint ? ["SPRINT", "RACE"] : ["RACE"]) as RoundType[]) {
        const s = await openF1Session(w.season, w.round, type, CACHE.results);
        if (!s) continue;
        for (const r of s.results) {
          const pts = Number(r.points ?? 0);
          const id = s.idOf(r.driver_number);
          if (!id || (!pts && r.position !== 1)) continue;
          const driver = dMap.get(id)?.driver ?? grid.get(id);
          if (!driver) continue;
          const d = dMap.get(id) ?? { position: 0, points: 0, wins: 0, driver };
          d.points += pts;
          if (type === "RACE" && r.position === 1) d.wins += 1;
          dMap.set(id, d);
          const c = cMap.get(driver.teamId);
          if (c) {
            c.points += pts;
            if (type === "RACE" && r.position === 1) c.wins += 1;
          }
        }
        if (!done.includes(w.round)) done.push(w.round);
      }
    }
    const rank = <T extends { points: number; wins: number; position: number }>(list: T[]) =>
      list
        .sort((a, b) => b.points - a.points || b.wins - a.wins || a.position - b.position)
        .map((x, i) => ({ ...x, position: i + 1 }));
    return { drivers: rank([...dMap.values()]), constructors: rank([...cMap.values()]), provisionalRounds: done };
  } catch (e) {
    console.warn("provisional standings failed", e);
    return { drivers, constructors, provisionalRounds: [] };
  }
}

/** OpenF1 answers 404 "No results found" for empty queries. */
function notFoundAsEmpty(e: unknown): any[] {
  if (e instanceof Error && e.message.startsWith("404 ")) return [];
  throw e;
}
