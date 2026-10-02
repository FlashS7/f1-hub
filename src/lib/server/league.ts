import { randomInt } from "node:crypto";
import { getFeaturedWeekend, getGrid, getSchedule } from "../f1";
import { buildLeaderboard, type LbScore } from "../leaderboard";
import { isLocked, predictionRounds, roundStatus, type PredRound, type RoundStatus } from "../rounds";
import { PredictionError, validatePrediction, type RoundScore } from "../scoring";
import { ROUND_ORDER, type RoundType } from "../scoring.config";
import { TEAMS } from "../teams";
import type { Weekend } from "../types";
import { PIN_RE, hashPin, type PlayerRow } from "./auth";
import { db, must } from "./db";
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
const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

const isUniqueViolation = (msg: string) => /duplicate key|unique/i.test(msg);

/* ---------- leagues & players ---------- */

export interface LeagueRow {
  id: string;
  name: string;
  invite_code: string;
  owner_player_id: string | null;
  created_at: string;
}

export async function getLeague(id: string): Promise<LeagueRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("leagues").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function getLeagueByCode(code: string): Promise<LeagueRow | null> {
  const { data } = await db().from("leagues").select("*").eq("invite_code", code.toUpperCase()).maybeSingle();
  return data;
}

export async function getPlayers(leagueId: string): Promise<PlayerRow[]> {
  return must(
    await db().from("players").select("id, league_id, nickname, team_id, created_at").eq("league_id", leagueId).order("created_at"),
  );
}

export async function createLeague(name: string, nickname: string, pin: string, teamId: string) {
  const leagueName = String(name ?? "").trim();
  if (leagueName.length < 1 || leagueName.length > 40) throw new UserError("League name must be 1–40 characters");
  let league: LeagueRow | null = null;
  for (let i = 0; i < 5 && !league; i++) {
    const res = await db().from("leagues").insert({ name: leagueName, invite_code: newCode() }).select().single();
    if (res.error && !isUniqueViolation(res.error.message)) throw new Error(res.error.message);
    league = res.data;
  }
  if (!league) throw new Error("Could not create an invite code");
  const player = await addPlayer(league.id, nickname, pin, teamId);
  must(await db().from("leagues").update({ owner_player_id: player.id }).eq("id", league.id));
  return { league: { ...league, owner_player_id: player.id }, player };
}

export async function addPlayer(leagueId: string, nickname: string, pin: string, teamId: string) {
  const res = await db()
    .from("players")
    .insert({ league_id: leagueId, nickname, pin_hash: await hashPin(pin), team_id: teamId })
    .select("id, league_id, nickname, team_id, created_at")
    .single();
  if (res.error) {
    if (isUniqueViolation(res.error.message)) throw new UserError("That nickname is taken in this league", 409);
    throw new Error(res.error.message);
  }
  return res.data as PlayerRow;
}

/* ---------- predictions ---------- */

export interface PredictionRow {
  id: string;
  player_id: string;
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

export async function savePrediction(
  player: PlayerRow,
  season: number,
  round: number,
  type: RoundType,
  picks: unknown,
  fastestLap: unknown,
) {
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
    await db().from("predictions").upsert(
      {
        player_id: player.id, league_id: player.league_id, season, round, round_type: type,
        picks: p.picks, fastest_lap: p.fastestLap, updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id,season,round,round_type" },
    ),
  );
}

/* ---------- views ---------- */

export interface RoundView {
  round: PredRound;
  status: RoundStatus;
  /** playerId -> has submitted */
  submitted: Record<string, boolean>;
}

export interface WeekendHistory {
  round: number;
  name: string;
  /** playerId -> weekend points */
  points: Record<string, number>;
  /** round types with scores */
  types: RoundType[];
}

export async function leagueView(leagueId: string) {
  const { weekend, season } = await getFeaturedWeekend().catch(() => ({ weekend: null as Weekend | null, season: new Date().getUTCFullYear() }));
  await ensureScored(season).catch((e) => console.error(e));

  const [players, scoresRes, predsRes, schedule] = await Promise.all([
    getPlayers(leagueId),
    db().from("round_scores").select("player_id, round, round_type, total, breakdown").eq("league_id", leagueId).eq("season", season),
    db().from("predictions").select("player_id, round, round_type").eq("league_id", leagueId).eq("season", season),
    getSchedule(season).catch(() => [] as Weekend[]),
  ]);
  const scores = must(scoresRes);
  const preds = must(predsRes);

  const lbScores: LbScore[] = scores.map((s) => {
    const b = s.breakdown as RoundScore;
    return {
      playerId: s.player_id, round: s.round, roundType: s.round_type, total: Number(s.total),
      exact: b.slots.filter((x) => x.actual === x.slot).length, slots: b.slots.length,
    };
  });
  const leaderboard = buildLeaderboard(
    players.map((p) => ({ id: p.id, nickname: p.nickname, teamId: p.team_id })),
    lbScores,
  );

  const scoredKeys = new Set(scores.map((s) => `${s.round}-${s.round_type}`));
  const rounds: RoundView[] = weekend
    ? predictionRounds(weekend).map((r) => ({
        round: r,
        status: roundStatus(r, scoredKeys.has(`${r.round}-${r.type}`)),
        submitted: Object.fromEntries(
          players.map((p) => [p.id, preds.some((x) => x.player_id === p.id && x.round === r.round && x.round_type === r.type)]),
        ),
      }))
    : [];

  const byRound = new Map<number, WeekendHistory>();
  for (const s of scores) {
    const h: WeekendHistory = byRound.get(s.round) ?? {
      round: s.round, name: schedule.find((w) => w.round === s.round)?.name ?? `Round ${s.round}`, points: {}, types: [],
    };
    h.points[s.player_id] = (h.points[s.player_id] ?? 0) + Number(s.total);
    if (!h.types.includes(s.round_type)) h.types.push(s.round_type);
    byRound.set(s.round, h);
  }
  const history = [...byRound.values()].sort((a, b) => b.round - a.round);
  for (const h of history) h.types.sort((a, b) => ROUND_ORDER.indexOf(a) - ROUND_ORDER.indexOf(b));

  return { season, weekend, players, leaderboard, rounds, history };
}

export async function roundView(leagueId: string, viewerId: string | null, season: number, round: number, type: RoundType) {
  const { weekend, round: r } = await findRound(season, round, type);
  const locked = isLocked(r.lockAt);
  if (locked) await ensureScored(season).catch((e) => console.error(e));

  const [players, predsRes, scoresRes, resultRes, grid] = await Promise.all([
    getPlayers(leagueId),
    db().from("predictions").select("id, player_id, round_type, picks, fastest_lap, updated_at")
      .eq("league_id", leagueId).eq("season", season).eq("round", round).eq("round_type", type),
    db().from("round_scores").select("player_id, total, breakdown")
      .eq("league_id", leagueId).eq("season", season).eq("round", round).eq("round_type", type),
    db().from("session_results").select("positions, fastest_lap")
      .eq("season", season).eq("round", round).eq("round_type", type).maybeSingle(),
    getGrid(),
  ]);
  const preds = must(predsRes) as PredictionRow[];
  // Hidden until lock: others' picks are never sent to the browser before the session starts.
  const visible = locked ? preds : preds.filter((p) => p.player_id === viewerId);
  const scores = Object.fromEntries(must(scoresRes).map((s) => [s.player_id, s.breakdown as RoundScore]));

  return {
    weekend,
    round: r,
    status: roundStatus(r, Object.keys(scores).length > 0),
    players,
    submitted: Object.fromEntries(players.map((p) => [p.id, preds.some((x) => x.player_id === p.id)])),
    predictions: visible,
    scores,
    result: resultRes.data as { positions: Record<string, number>; fastest_lap: string | null } | null,
    grid,
  };
}

export async function playerStats(leagueId: string, playerId: string) {
  const { leaderboard, season, history } = await leagueView(leagueId);
  return { row: leaderboard.find((r) => r.player.id === playerId) ?? null, season, history, leaderboardSize: leaderboard.length };
}
