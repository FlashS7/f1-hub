import { forgetDevice, issueDeviceToken } from "@/lib/server/auth";
import { db, must } from "@/lib/server/db";
import { body, handle, requireProfile } from "@/lib/server/http";
import { UserError, cleanNickname, cleanPin, cleanTeam, createProfile, isUniqueViolation } from "@/lib/server/league";

/** Create a profile (nickname + PIN + team) and log this device in. */
export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const profile = await createProfile(cleanNickname(b.nickname), cleanPin(b.pin), cleanTeam(b.teamId));
  await issueDeviceToken(profile.id);
  return { profileId: profile.id };
});

/** Edit nickname and/or favourite team. */
export const PATCH = handle(async (req: Request) => {
  const me = await requireProfile();
  const b = await body(req);
  const patch: Record<string, string> = {};
  if (b.nickname !== undefined) patch.nickname = cleanNickname(b.nickname);
  if (b.teamId !== undefined) patch.team_id = cleanTeam(b.teamId);
  const res = await db().from("profiles").update(patch).eq("id", me.id);
  if (res.error) {
    if (isUniqueViolation(res.error.message)) throw new UserError("That nickname is taken. Try another one.", 409);
    throw new Error(res.error.message);
  }
  return { ok: true };
});

/** Delete the profile with all picks and memberships. Leagues you own stay, without an owner. */
export const DELETE = handle(async () => {
  const me = await requireProfile();
  if (me.is_admin) throw new UserError("The admin profile can't be deleted", 403);
  await forgetDevice();
  must(await db().from("profiles").delete().eq("id", me.id));
  return { ok: true };
});
