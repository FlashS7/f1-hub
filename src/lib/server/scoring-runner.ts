import { getSchedule, getSessionResult } from "../f1";
import { predictionRounds, readyToScore } from "../rounds";
import { scoreRound, type SessionResult } from "../scoring";
import type { RoundType } from "../scoring.config";
import { db, must } from "./db";

/** Don't hit the APIs for the same missing result more than once per this many ms (per server instance). */
const RETRY_MS = 5 * 60_000;
const lastTry = new Map<string, number>();

async function loadOrFetchResult(season: number, round: number, type: RoundType, refetch: boolean) {
  if (!refetch) {
    const { data } = await db()
      .from("session_results")
      .select("positions, fastest_lap")
      .eq("season", season).eq("round", round).eq("round_type", type)
      .maybeSingle();
    if (data) return { positions: data.positions, fastestLap: data.fastest_lap } as SessionResult;
  }
  const res = await getSessionResult(season, round, type);
  if (!res) return null;
  must(
    await db().from("session_results").upsert({
      season, round, round_type: type, positions: res.positions, fastest_lap: res.fastestLap ?? null,
      fetched_at: new Date().toISOString(),
    }),
  );
  return res;
}

/** Scores every prediction (all leagues) for one round. Returns number scored, or null if no result yet. */
export async function scoreRoundForAll(season: number, round: number, type: RoundType, refetch = false) {
  const result = await loadOrFetchResult(season, round, type, refetch);
  if (!result) return null;
  const preds = must(
    await db()
      .from("predictions")
      .select("id, player_id, league_id, picks, fastest_lap")
      .eq("season", season).eq("round", round).eq("round_type", type),
  );
  if (!preds.length) return 0;
  const rows = preds.map((p) => {
    const s = scoreRound(type, { picks: p.picks, fastestLap: p.fastest_lap }, result);
    return {
      prediction_id: p.id, player_id: p.player_id, league_id: p.league_id,
      season, round, round_type: type, total: s.total, breakdown: s, scored_at: new Date().toISOString(),
    };
  });
  must(await db().from("round_scores").upsert(rows));
  return rows.length;
}

/**
 * Lazily score anything that has finished but isn't scored yet. Cheap when there's nothing to do.
 * Called on league page loads and by the daily cron.
 */
export async function ensureScored(season: number) {
  const [preds, scores] = await Promise.all([
    db().from("predictions").select("id, round, round_type").eq("season", season),
    db().from("round_scores").select("prediction_id").eq("season", season),
  ]);
  if (preds.error || scores.error) return;
  const scored = new Set(scores.data.map((s) => s.prediction_id));
  const pending = new Map<string, { round: number; type: RoundType }>();
  for (const p of preds.data) {
    if (!scored.has(p.id)) pending.set(`${p.round}-${p.round_type}`, { round: p.round, type: p.round_type });
  }
  if (!pending.size) return;

  const schedule = await getSchedule(season).catch(() => []);
  const now = new Date();
  for (const [key, { round, type }] of pending) {
    const w = schedule.find((x) => x.round === round);
    const r = w && predictionRounds(w).find((x) => x.type === type);
    if (!r || !readyToScore(r, now)) continue;
    const k = `${season}-${key}`;
    if (Date.now() - (lastTry.get(k) ?? 0) < RETRY_MS) continue;
    lastTry.set(k, Date.now());
    try {
      await scoreRoundForAll(season, round, type);
    } catch (e) {
      console.error("scoring failed", k, e);
    }
  }
}

/** Owner action: re-fetch results for every round of a weekend and re-score. */
export async function rescoreWeekend(season: number, round: number) {
  const schedule = await getSchedule(season);
  const w = schedule.find((x) => x.round === round);
  if (!w) throw new Error("Unknown round");
  const out: Record<string, number | null | string> = {};
  for (const r of predictionRounds(w)) {
    if (!readyToScore(r)) {
      out[r.type] = "not finished";
      continue;
    }
    out[r.type] = await scoreRoundForAll(season, round, r.type, true);
  }
  return out;
}
