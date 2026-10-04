import { randomInt } from "node:crypto";
import { getFeaturedWeekend, getGrid, getSchedule } from "../f1";
import { buildLeaderboard, type LbRow, type LbScore } from "../leaderboard";
import { isLocked, predictionRounds, roundStatus, type PredRound, type RoundStatus } from "../rounds";
import { PredictionError, validatePrediction, type RoundScore } from "../scoring";
import { ROUND_ORDER, type RoundType } from "../scoring.config";
import { TEAMS } from "../teams";
import type { Weekend } from "../types";
import { PIN_RE, PROFILE_COLS, hashPin, type Profile } from "./auth";
import { db, fetchAll, must } from "./db";
import { ensureScored } from "./scoring-runner";

export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/* ---------- validation ---------- */

export function cleanNickname(raw: unknown): string {
  const n = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 20) throw new UserError("Nickname must be 2–20 characters");
  if (!/^[\p{L}\p{N} ._-]+$/u.test(n)) throw new UserError("Nickname can use letters, numbers, space, . _ -");
  return n;
}

export function cleanPin(raw: unknown): string {
  const p = String(raw ?? "");
  if (!PIN_RE.test(p)) throw new UserError("PIN must be exactly 4 digits");
  return p;
}

export function cleanTeam(raw: unknown): string {
  const t = String(raw ?? "");
  if (!TEAMS[t]) throw new UserError("Pick a team from the current grid");
  return t;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
export const isUniqueViolation = (msg: string) => /duplicate key|unique/i.test(msg);

/* ---------- profiles ---------- */

export async function createProfile(nickname: string, pin: string, teamId: string): Promise<Profile> {
  const res = await db()
    .from("profiles")
    .insert({ nickname, pin_hash: await hashPin(pin), team_id: teamId })
    .select(PROFILE_COLS)
    .single();
  if (res.error) {
    if (isUniqueViolation(res.error.message)) throw new UserError("That nickname is taken. Try another one.", 409);
    throw new Error(res.error.message);
  }
  return res.data as Profile;
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("profiles").select(PROFILE_COLS).eq("id", id).maybeSingle();
  return data as Profile | null;
}

/* ---------- leagues ---------- */

export interface LeagueRow {
  id: string;
  name: string;
  invite_code: string;
  is_global: boolean;
  owner_profile_id: string | null;
  created_at: string;
}
const LEAGUE_COLS = "id, name, invite_code, is_global, owner_profile_id, created_at";

export async function getLeague(id: string): Promise<LeagueRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("leagues").select(LEAGUE_COLS).eq("id", id).maybeSingle();
  return data;
}

export async function getLeagueByCode(code: string): Promise<LeagueRow | null> {
  const { data } = await db().from("leagues").select(LEAGUE_COLS).eq("invite_code", code.toUpperCase()).eq("is_global", false).maybeSingle();
  return data;
}

export async function getGlobalLeague(): Promise<LeagueRow | null> {
  const { data } = await db().from("leagues").select(LEAGUE_COLS).eq("is_global", true).maybeSingle();
  return data;
}

export async function createLeague(name: unknown, owner: Profile): Promise<LeagueRow> {
  const leagueName = String(name ?? "").trim();
  if (leagueName.length < 1 || leagueName.length > 40) throw new UserError("League name must be 1–40 characters");
  for (let i = 0; i < 5; i++) {
    const res = await db()
      .from("leagues")
      .insert({ name: leagueName, invite_code: newCode(), owner_profile_id: owner.id })
      .select(LEAGUE_COLS)
      .single();
    if (res.error) {
      if (isUniqueViolation(res.error.message)) continue;
      throw new Error(res.error.message);
    }
    must(await db().from("league_members").insert({ league_id: res.data.id, profile_id: owner.id }));
    return res.data;
  }
  throw new Error("Could not create an invite code");
}

/** Everyone in the league. The global league contains every profile. */
export async function leagueMembers(league: LeagueRow): Promise<Profile[]> {
  if (league.is_global) {
    return fetchAll<Profile>((a, b) => db().from("profiles").select(PROFILE_COLS).order("created_at").range(a, b));
  }
  // A to-one join: Supabase returns an object here even though its inferred type says array.
  const rows = await fetchAll<{ profiles: unknown }>((a, b) =>
    db().from("league_members").select(`profiles!inner(${PROFILE_COLS})`).eq("league_id", league.id).order("joined_at").range(a, b),
  );
  return rows.map((r) => r.profiles as Profile);
}

export async function isMember(league: LeagueRow, profileId: string | null | undefined): Promise<boolean> {
  if (!profileId) return false;
  if (league.is_global) return true;
  const { count } = await db()
    .from("league_members")
    .select("profile_id", { count: "exact", head: true })
    .eq("league_id", league.id)
    .eq("profile_id", profileId);
  return (count ?? 0) > 0;
}

export async function myPrivateLeagues(profileId: string): Promise<(LeagueRow & { members: number })[]> {
  const { data } = await db()
    .from("league_members")
    .select(`leagues!inner(${LEAGUE_COLS}, league_members(count))`)
    .eq("profile_id", profileId);
  return (data ?? []).map((r) => {
    const l = r.leagues as unknown as LeagueRow & { league_members: { count: number }[] };
    return { ...l, members: l.league_members?.[0]?.count ?? 0 };
  });
}

export async function joinLeague(league: LeagueRow, profile: Profile) {
  if (league.is_global) return;
  must(await db().from("league_members").upsert({ league_id: league.id, profile_id: profile.id }, { ignoreDuplicates: true }));
}

export async function leaveLeague(league: LeagueRow, profile: Profile) {
  if (league.is_global) throw new UserError("Everyone plays in the global league", 403);
  if (league.owner_profile_id === profile.id) throw new UserError("The league owner can't leave the league", 403);
  must(await db().from("league_members").delete().eq("league_id", league.id).eq("profile_id", profile.id));
}

/** League owner, or the app admin (who also runs the global league). */
export const canManage = (league: LeagueRow, p: Profile | null) =>
  !!p && (p.is_admin || league.owner_profile_id === p.id);

/* ---------- picks ---------- */

export interface PickRow {
  id: string;
  profile_id: string;
  round_type: RoundType;
  picks: string[];
  fastest_lap: string | null;
  updated_at: string;
}

export async function findRound(season: number, round: number, type: RoundType) {
  const schedule = await getSchedule(season);
  const w = schedule.find((x) => x.round === round);
  const r = w && predictionRounds(w).find((x) => x.type === type);
  if (!w || !r) throw new UserError("No such prediction round", 404);
  return { weekend: w, round: r };
}

export async function savePick(profile: Profile, season: number, round: number, type: RoundType, picks: unknown, fastestLap: unknown) {
  const { round: r } = await findRound(season, round, type);
  // Server-side lock: the clock here is the only one that counts.
  if (isLocked(r.lockAt)) throw new UserError("This round is locked", 423);

  const grid = await getGrid();
  const p = {
    picks: Array.isArray(picks) ? picks.map(String) : [],
    fastestLap: type === "RACE" ? (fastestLap ? String(fastestLap) : null) : null,
  };
  try {
    validatePrediction(type, p, grid.map((d) => d.id));
  } catch (e) {
    if (e instanceof PredictionError) throw new UserError(e.message);
    throw e;
  }
  must(
    await db().from("picks").upsert(
      {
        profile_id: profile.id, season, round, round_type: type,
        picks: p.picks, fastest_lap: p.fastestLap, updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,season,round,round_type" },
    ),
  );
}

export async function myPick(profileId: string, season: number, round: number, type: RoundType): Promise<PickRow | null> {
  const { data } = await db()
    .from("picks")
    .select("id, profile_id, round_type, picks, fastest_lap, updated_at")
    .eq("profile_id", profileId).eq("season", season).eq("round", round).eq("round_type", type)
    .maybeSingle();
  return data as PickRow | null;
}

/** Picks per round for the given profiles (or everyone). Returns "round-type" -> set of profile ids. */
async function submittedFor(season: number, round: number, ids: string[] | null) {
  const rows = await fetchAll<{ profile_id: string; round_type: RoundType }>((a, b) => {
    let q = db().from("picks").select("profile_id, round_type").eq("season", season).eq("round", round);
    if (ids) q = q.in("profile_id", ids);
    return q.range(a, b);
  });
  const map = new Map<RoundType, Set<string>>();
  for (const r of rows) {
    const s = map.get(r.round_type) ?? new Set();
    s.add(r.profile_id);
    map.set(r.round_type, s);
  }
  return map;
}

/* ---------- views ---------- */

export interface RoundView {
  round: PredRound;
  status: RoundStatus;
  /** profile ids that picked */
  submitted: string[];
  submittedCount: number;
}

export interface WeekendHistory {
  round: number;
  name: string;
  /** profileId -> weekend points (global league: top 5 + viewer) */
  points: Record<string, number>;
  types: RoundType[];
  players: number;
}

const HISTORY_TOP_GLOBAL = 5;
/** How long the just-finished weekend stays on the league page. */
const LAST_WEEKEND_DAYS = 3;

export async function leagueView(league: LeagueRow, viewerId: string | null) {
  const { weekend, season } = await getFeaturedWeekend().catch(() => ({ weekend: null as Weekend | null, season: new Date().getUTCFullYear() }));
  await ensureScored(season).catch((e) => console.error(e));

  const members = await leagueMembers(league);
  const ids = league.is_global ? null : members.map((m) => m.id);
  const schedule = await getSchedule(season).catch(() => [] as Weekend[]);
  // Keep the weekend that just finished on screen for a few days, so its points are one tap away.
  const now = Date.now();
  const lastWeekend =
    [...schedule]
      .reverse()
      .find((w) => w.round !== weekend?.round && new Date(w.sessions.at(-1)!.end).getTime() < now) ?? null;
  const recent = lastWeekend && now - new Date(lastWeekend.sessions.at(-1)!.end).getTime() < LAST_WEEKEND_DAYS * 86400_000 ? lastWeekend : null;
  const empty = Promise.resolve(new Map<RoundType, Set<string>>());
  const [scores, submitted, submittedLast] = await Promise.all([
    fetchAll<{ profile_id: string; round: number; round_type: RoundType; total: number; exact: number; slots: number }>((a, b) => {
      let q = db().from("pick_scores").select("profile_id, round, round_type, total, exact, slots").eq("season", season);
      if (ids) q = q.in("profile_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return q.range(a, b);
    }),
    weekend ? submittedFor(weekend.season, weekend.round, ids) : empty,
    recent ? submittedFor(recent.season, recent.round, ids) : empty,
  ]);

  const lbScores: LbScore[] = scores.map((s) => ({
    playerId: s.profile_id, round: s.round, roundType: s.round_type, total: Number(s.total), exact: s.exact, slots: s.slots,
  }));
  const leaderboard = buildLeaderboard(
    members.map((p) => ({ id: p.id, nickname: p.nickname, teamId: p.team_id })),
    lbScores,
  );

  const scoredKeys = new Set(scores.map((s) => `${s.round}-${s.round_type}`));
  const toViews = (w: Weekend | null, sub: Map<RoundType, Set<string>>): RoundView[] =>
    w
      ? predictionRounds(w).map((r) => {
          const set = sub.get(r.type) ?? new Set<string>();
          return {
            round: r,
            status: roundStatus(r, scoredKeys.has(`${r.round}-${r.type}`)),
            submitted: league.is_global ? (viewerId && set.has(viewerId) ? [viewerId] : []) : [...set],
            submittedCount: set.size,
          };
        })
      : [];
  const rounds = toViews(weekend, submitted);
  const lastRounds = toViews(recent, submittedLast);

  const byRound = new Map<number, WeekendHistory>();
  for (const s of scores) {
    const h: WeekendHistory = byRound.get(s.round) ?? {
      round: s.round, name: schedule.find((w) => w.round === s.round)?.name ?? `Round ${s.round}`, points: {}, types: [], players: 0,
    };
    h.points[s.profile_id] = (h.points[s.profile_id] ?? 0) + Number(s.total);
    if (!h.types.includes(s.round_type)) h.types.push(s.round_type);
    byRound.set(s.round, h);
  }
  const history = [...byRound.values()].sort((a, b) => b.round - a.round);
  for (const h of history) {
    h.types.sort((a, b) => ROUND_ORDER.indexOf(a) - ROUND_ORDER.indexOf(b));
    h.players = Object.keys(h.points).length;
    if (league.is_global) {
      const keep = Object.entries(h.points).sort((a, b) => b[1] - a[1]).slice(0, HISTORY_TOP_GLOBAL);
      if (viewerId && h.points[viewerId] !== undefined) keep.push([viewerId, h.points[viewerId]]);
      h.points = Object.fromEntries(keep);
    }
  }

  return { season, weekend, members, leaderboard, rounds, history, lastWeekend: recent, lastRounds };
}

/** How many revealed picks to show in the global league (plus the viewer's). */
const REVEAL_TOP_GLOBAL = 20;

export async function roundView(league: LeagueRow, viewerId: string | null, season: number, round: number, type: RoundType) {
  const { weekend, round: r } = await findRound(season, round, type);
  const locked = isLocked(r.lockAt);
  if (locked) await ensureScored(season).catch((e) => console.error(e));

  const members = await leagueMembers(league);
  const ids = league.is_global ? null : members.map((m) => m.id);
  const byId = new Map(members.map((m) => [m.id, m]));

  const [picks, scoresRows, resultRes, grid] = await Promise.all([
    fetchAll<PickRow>((a, b) => {
      let q = db().from("picks").select("id, profile_id, round_type, picks, fastest_lap, updated_at")
        .eq("season", season).eq("round", round).eq("round_type", type);
      if (ids) q = q.in("profile_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return q.range(a, b);
    }),
    fetchAll<{ profile_id: string; total: number; breakdown: RoundScore }>((a, b) => {
      let q = db().from("pick_scores").select("profile_id, total, breakdown")
        .eq("season", season).eq("round", round).eq("round_type", type).order("total", { ascending: false });
      if (ids) q = q.in("profile_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return q.range(a, b);
    }),
    db().from("session_results").select("positions, fastest_lap")
      .eq("season", season).eq("round", round).eq("round_type", type).maybeSingle(),
    getGrid(),
  ]);
  const scores = Object.fromEntries(scoresRows.map((s) => [s.profile_id, s.breakdown]));

  // Hidden until lock: others' picks are never sent to the browser before the session starts.
  let visible = locked ? picks : picks.filter((p) => p.profile_id === viewerId);
  if (league.is_global && visible.length > REVEAL_TOP_GLOBAL) {
    const rank = (p: PickRow) => Number(scores[p.profile_id]?.total ?? 0);
    const top = [...visible].sort((a, b) => rank(b) - rank(a)).slice(0, REVEAL_TOP_GLOBAL);
    const mine = visible.find((p) => p.profile_id === viewerId);
    visible = mine && !top.includes(mine) ? [...top, mine] : top;
  }

  return {
    weekend,
    round: r,
    status: roundStatus(r, scoresRows.length > 0),
    members: byId,
    submitted: league.is_global ? null : new Set(picks.map((p) => p.profile_id)),
    submittedCount: picks.length,
    hiddenCount: Math.max(0, (locked ? picks.length : 0) - visible.length),
    picks: visible,
    scores,
    result: resultRes.data as { positions: Record<string, number>; fastest_lap: string | null } | null,
    grid,
  };
}

export async function profileStats(league: LeagueRow, profileId: string): Promise<{ row: LbRow | null; history: WeekendHistory[]; size: number }> {
  const v = await leagueView(league, profileId);
  return { row: v.leaderboard.find((r) => r.player.id === profileId) ?? null, history: v.history, size: v.members.length };
}
