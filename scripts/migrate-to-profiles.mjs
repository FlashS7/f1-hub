// One-off v1 -> v2 data copy (per-league players -> app-wide profiles). Safe to re-run.
// Run: node --env-file=.env.local scripts/migrate-to-profiles.mjs "<admin nickname>"
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const adminNick = process.argv[2];
if (!adminNick) throw new Error("Pass the admin nickname");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

const players = must(await db.from("players").select("*"), "players");
const devices = must(await db.from("player_devices").select("*"), "player_devices");
const preds = must(await db.from("predictions").select("*"), "predictions");
const leagues = must(await db.from("leagues").select("*"), "leagues");

// Profiles keep the v1 player id, so every reference maps 1:1. Nicknames are now app-wide unique.
const seen = new Set();
const profiles = players.map((p) => {
  let nick = p.nickname;
  for (let i = 2; seen.has(nick.toLowerCase()); i++) nick = `${p.nickname.slice(0, 17)}-${i}`;
  seen.add(nick.toLowerCase());
  return {
    id: p.id, nickname: nick, pin_hash: p.pin_hash, team_id: p.team_id, created_at: p.created_at,
    is_admin: p.nickname === adminNick,
  };
});
if (!profiles.some((p) => p.is_admin)) throw new Error(`No player named ${adminNick}`);
must(await db.from("profiles").upsert(profiles), "upsert profiles");

must(
  await db.from("profile_devices").upsert(
    devices.map((d) => ({ token_hash: d.token_hash, profile_id: d.player_id, created_at: d.created_at, last_seen: d.last_seen })),
  ),
  "upsert devices",
);

for (const l of leagues.filter((l) => !l.is_global)) {
  must(await db.from("leagues").update({ owner_profile_id: l.owner_player_id }).eq("id", l.id), "league owner");
}
must(
  await db.from("league_members").upsert(
    players.map((p) => ({ league_id: p.league_id, profile_id: p.id, joined_at: p.created_at })),
    { ignoreDuplicates: true },
  ),
  "members",
);

// One pick per profile per round. If someone predicted the same round in two v1 leagues, the latest wins.
const latest = new Map();
for (const p of preds) {
  const k = `${p.player_id}-${p.season}-${p.round}-${p.round_type}`;
  if (!latest.has(k) || latest.get(k).updated_at < p.updated_at) latest.set(k, p);
}
if (latest.size) {
  must(
    await db.from("picks").upsert(
      [...latest.values()].map((p) => ({
        id: p.id, profile_id: p.player_id, season: p.season, round: p.round, round_type: p.round_type,
        picks: p.picks, fastest_lap: p.fastest_lap, updated_at: p.updated_at,
      })),
      { onConflict: "profile_id,season,round,round_type" },
    ),
    "picks",
  );
}

const admin = profiles.find((p) => p.is_admin);
const global = must(await db.from("leagues").select("id").eq("is_global", true).maybeSingle(), "global");
if (!global) {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 6 }, () => A[randomInt(A.length)]).join("");
  must(
    await db.from("leagues").insert({ name: "F1 HUB Global", invite_code: code, is_global: true, owner_profile_id: admin.id }),
    "create global",
  );
}

const count = async (t) => (await db.from(t).select("*", { count: "exact", head: true })).count;
console.log({
  profiles: await count("profiles"), devices: await count("profile_devices"), members: await count("league_members"),
  picks: await count("picks"), admin: admin.nickname, globalCreated: !global,
});
