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

export async function loginAttemptsExceeded(nickname: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - PIN_LIMIT.windowMin * 60_000).toISOString();
  const [byNick, byIp] = await Promise.all([
    db().from("login_attempts").select("id", { count: "exact", head: true })
      .eq("nickname_lower", nickname.toLowerCase()).gte("created_at", since),
    db().from("login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since),
  ]);
  return (byNick.count ?? 0) >= PIN_LIMIT.perNickname || (byIp.count ?? 0) >= PIN_LIMIT.perIp;
}

export async function recordFailedLogin(nickname: string, ip: string) {
  must(await db().from("login_attempts").insert({ nickname_lower: nickname.toLowerCase(), ip }));
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/* ---------- device tokens ---------- */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const COOKIE = "f1h_p";
/** v1 used one cookie per league (f1h_<leagueId>); their tokens were carried over, so they still log you in. */
const isAuthCookie = (name: string) => name === COOKIE || /^f1h_[0-9a-f]{32}$/.test(name);

/** Creates a device token for the profile and sets it as an httpOnly cookie. Route handlers only. */
export async function issueDeviceToken(profileId: string) {
  const token = randomBytes(32).toString("base64url");
  must(await db().from("profile_devices").insert({ token_hash: sha256(token), profile_id: profileId }));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 24 * 3600,
  });
}

export async function forgetDevice() {
  const store = await cookies();
  const tokens = store.getAll().filter((c) => isAuthCookie(c.name));
  if (tokens.length) {
    await db().from("profile_devices").delete().in("token_hash", tokens.map((c) => sha256(c.value)));
  }
  for (const c of tokens) store.delete(c.name);
}

export interface Profile {
  id: string;
  nickname: string;
  team_id: string;
  is_admin: boolean;
  created_at: string;
}

export const PROFILE_COLS = "id, nickname, team_id, is_admin, created_at";

/** The profile this device is logged in as, or null. */
export async function currentProfile(): Promise<Profile | null> {
  const store = await cookies();
  const tokens = store.getAll().filter((c) => isAuthCookie(c.name)).map((c) => sha256(c.value));
  if (!tokens.length) return null;
  const { data } = await db()
    .from("profile_devices")
    .select(`profile_id, profiles!inner(${PROFILE_COLS})`)
    .in("token_hash", tokens)
    .limit(1);
  return ((data?.[0]?.profiles ?? null) as unknown as Profile | null) ?? null;
}
