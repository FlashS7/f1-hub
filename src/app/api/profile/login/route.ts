import { PIN_LIMIT, clientIp, issueDeviceToken, loginAttemptsExceeded, recordFailedLogin, verifyPin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { body, handle } from "@/lib/server/http";
import { UserError, cleanPin } from "@/lib/server/league";

/** Log in on a new device with nickname + PIN. Rate limited per nickname and per IP. */
export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const nickname = String(b.nickname ?? "").trim();
  const pin = cleanPin(b.pin);
  const ip = clientIp(req);

  if (await loginAttemptsExceeded(nickname, ip)) {
    throw new UserError(`Too many wrong attempts. Try again in ${PIN_LIMIT.windowMin} minutes.`, 429);
  }
  // Exact case-insensitive match (ilike would treat _ and % as wildcards).
  const { data } = await db().from("profiles").select("id, nickname, pin_hash").ilike("nickname", nickname.replace(/[\\%_]/g, "\\$&"));
  const p = data?.find((x) => x.nickname.toLowerCase() === nickname.toLowerCase());
  if (!p || !(await verifyPin(pin, p.pin_hash))) {
    await recordFailedLogin(nickname, ip);
    throw new UserError("Nickname or PIN is wrong", 401);
  }
  await issueDeviceToken(p.id);
  return { profileId: p.id };
});
