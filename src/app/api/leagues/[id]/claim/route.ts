import {
  PIN_LIMIT,
  clientIp,
  issueDeviceToken,
  pinAttemptsExceeded,
  recordFailedPin,
  verifyPin,
} from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { body, handle } from "@/lib/server/http";
import { UserError, cleanPin, getLeague } from "@/lib/server/league";

/** Reclaim a profile on a new device with nickname + PIN. Rate limited per nickname and per IP. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/leagues/[id]/claim">) => {
  const { id } = await ctx.params;
  const league = await getLeague(id);
  if (!league) throw new UserError("League not found", 404);
  const b = await body(req);
  const nickname = String(b.nickname ?? "").trim();
  const pin = cleanPin(b.pin);
  const ip = clientIp(req);

  if (await pinAttemptsExceeded(league.id, nickname, ip)) {
    throw new UserError(`Too many wrong attempts. Try again in ${PIN_LIMIT.windowMin} minutes.`, 429);
  }

  const { data: players } = await db().from("players").select("id, nickname, pin_hash").eq("league_id", league.id);
  const p = players?.find((x) => x.nickname.toLowerCase() === nickname.toLowerCase());
  if (!p || !(await verifyPin(pin, p.pin_hash))) {
    await recordFailedPin(league.id, nickname, ip);
    throw new UserError("Nickname or PIN is wrong", 401);
  }
  await issueDeviceToken(p.id, league.id);
  return { playerId: p.id };
});
