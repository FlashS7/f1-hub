import type { RoundType } from "./scoring.config";
import { roundKey } from "./rounds";

export interface LbPlayer {
  id: string;
  nickname: string;
  teamId: string;
}

export interface LbScore {
  playerId: string;
  round: number;
  roundType: RoundType;
  total: number;
  exact: number; // exact slot hits in this round
  slots: number; // slots predicted in this round
}

export interface LbRow {
  player: LbPlayer;
  position: number;
  total: number;
  gap: number;
  weekendsPlayed: number;
  weekendsWon: number;
  average: number;
  best: { round: number; points: number } | null;
  accuracy: number; // 0..1 share of exact slots
  movement: number; // + = moved up since the last scored round
}

function rank(players: LbPlayer[], scores: LbScore[]) {
  const totals = new Map(players.map((p) => [p.id, 0]));
  const weekend = new Map<string, Map<number, number>>(); // player -> round -> points
  for (const s of scores) {
    if (!totals.has(s.playerId)) continue;
    totals.set(s.playerId, totals.get(s.playerId)! + s.total);
    const w = weekend.get(s.playerId) ?? new Map<number, number>();
    w.set(s.round, (w.get(s.round) ?? 0) + s.total);
    weekend.set(s.playerId, w);
  }

  // Weekend winners: highest weekend points among players who played it; ties all win; 0 wins nothing.
  const wins = new Map(players.map((p) => [p.id, 0]));
  const rounds = new Set(scores.map((s) => s.round));
  for (const r of rounds) {
    let max = 0;
    for (const [, w] of weekend) max = Math.max(max, w.get(r) ?? 0);
    if (max <= 0) continue;
    for (const [pid, w] of weekend) if ((w.get(r) ?? 0) === max && wins.has(pid)) wins.set(pid, wins.get(pid)! + 1);
  }

  const sorted = [...players].sort(
    (a, b) =>
      totals.get(b.id)! - totals.get(a.id)! ||
      wins.get(b.id)! - wins.get(a.id)! ||
      a.nickname.localeCompare(b.nickname),
  );
  // Competition ranking: equal total + equal wins share a position.
  const position = new Map<string, number>();
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    const same = prev && totals.get(prev.id) === totals.get(p.id) && wins.get(prev.id) === wins.get(p.id);
    position.set(p.id, same ? position.get(prev.id)! : i + 1);
  });
  return { sorted, totals, weekend, wins, position };
}

export function buildLeaderboard(players: LbPlayer[], scores: LbScore[]): LbRow[] {
  const now = rank(players, scores);

  // Movement vs. standings before the most recent scored round.
  const lastKey = scores.length ? Math.max(...scores.map((s) => roundKey(s.round, s.roundType))) : null;
  const before =
    lastKey === null ? null : rank(players, scores.filter((s) => roundKey(s.round, s.roundType) !== lastKey));
  const hadScoresBefore = before && scores.some((s) => roundKey(s.round, s.roundType) !== lastKey);

  const leader = now.sorted.length ? now.totals.get(now.sorted[0].id)! : 0;

  return now.sorted.map((p) => {
    const w = now.weekend.get(p.id) ?? new Map<number, number>();
    const mine = scores.filter((s) => s.playerId === p.id);
    const slots = mine.reduce((a, s) => a + s.slots, 0);
    const exact = mine.reduce((a, s) => a + s.exact, 0);
    let best: LbRow["best"] = null;
    for (const [round, points] of w) if (!best || points > best.points) best = { round, points };
    const total = now.totals.get(p.id)!;
    return {
      player: p,
      position: now.position.get(p.id)!,
      total,
      gap: leader - total,
      weekendsPlayed: w.size,
      weekendsWon: now.wins.get(p.id)!,
      average: w.size ? total / w.size : 0,
      best,
      accuracy: slots ? exact / slots : 0,
      movement: hadScoresBefore ? before!.position.get(p.id)! - now.position.get(p.id)! : 0,
    };
  });
}
