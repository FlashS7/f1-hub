import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db, must } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/* ---------- PIN ---------- */

export const PIN_RE = /^\d{4}$/;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(pin, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/* ---------- rate limiting ---------- */

export const PIN_LIMIT = { perNickname: 5, perIp: 20, windowMin: 15 };

export async function pinAttemptsExceeded(leagueId: string, nickname: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - PIN_LIMIT.windowMin * 60_000).toISOString();
  const [byNick, byIp] = await Promise.all([
    db().from("pin_attempts").select("id", { count: "exact", head: true })
      .eq("league_id", leagueId).eq("nickname_lower", nickname.toLowerCase()).gte("created_at", since),
    db().from("pin_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since),
  ]);
  return (byNick.count ?? 0) >= PIN_LIMIT.perNickname || (byIp.count ?? 0) >= PIN_LIMIT.perIp;
}

export async function recordFailedPin(leagueId: string, nickname: string, ip: string) {
  must(await db().from("pin_attempts").insert({ league_id: leagueId, nickname_lower: nickname.toLowerCase(), ip }));
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/* ---------- device tokens ---------- */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const cookieName = (leagueId: string) => `f1h_${leagueId.replace(/-/g, "")}`;

/** Creates a device token for the player and sets it as an httpOnly cookie. Route handlers only. */
export async function issueDeviceToken(playerId: string, leagueId: string) {
  const token = randomBytes(32).toString("base64url");
  must(await db().from("player_devices").insert({ token_hash: sha256(token), player_id: playerId }));
  (await cookies()).set(cookieName(leagueId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 24 * 3600,
  });
}

export async function forgetDevice(leagueId: string) {
  const store = await cookies();
  const token = store.get(cookieName(leagueId))?.value;
  if (token) await db().from("player_devices").delete().eq("token_hash", sha256(token));
  store.delete(cookieName(leagueId));
}

export interface PlayerRow {
  id: string;
  league_id: string;
  nickname: string;
  team_id: string;
  created_at: string;
}

/** The player this device is logged in as for the league, or null. */
export async function currentPlayer(leagueId: string): Promise<PlayerRow | null> {
  const token = (await cookies()).get(cookieName(leagueId))?.value;
  if (!token) return null;
  const { data } = await db()
    .from("player_devices")
    .select("player_id, players!inner(id, league_id, nickname, team_id, created_at)")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  const p = (data?.players ?? null) as unknown as PlayerRow | null;
  if (!p || p.league_id !== leagueId) return null;
  return p;
}

/** League ids this device has a token cookie for (validated lazily by currentPlayer). */
export async function deviceLeagueIds(): Promise<string[]> {
  return (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith("f1h_") && c.name.length === 36)
    .map((c) => {
      const h = c.name.slice(4);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    });
}
