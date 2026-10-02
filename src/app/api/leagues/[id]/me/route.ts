import { currentPlayer, forgetDevice } from "@/lib/server/auth";
import { db, must } from "@/lib/server/db";
import { body, handle } from "@/lib/server/http";
import { UserError, cleanNickname, cleanTeam, getLeague } from "@/lib/server/league";

async function me(id: string) {
  const player = await currentPlayer(id);
  if (!player) throw new UserError("You're not in this league on this device", 401);
  return player;
}

/** Edit nickname and/or favourite team. */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/leagues/[id]/me">) => {
  const { id } = await ctx.params;
  const player = await me(id);
  const b = await body(req);
  const patch: Record<string, string> = {};
  if (b.nickname !== undefined) patch.nickname = cleanNickname(b.nickname);
  if (b.teamId !== undefined) patch.team_id = cleanTeam(b.teamId);
  const res = await db().from("players").update(patch).eq("id", player.id);
  if (res.error) {
    if (/duplicate|unique/i.test(res.error.message)) throw new UserError("That nickname is taken in this league", 409);
    throw new Error(res.error.message);
  }
  return { ok: true };
});

/** Leave the league: deletes the profile and its predictions. The owner can't leave. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/leagues/[id]/me">) => {
  const { id } = await ctx.params;
  const player = await me(id);
  const league = await getLeague(id);
  if (league?.owner_player_id === player.id) throw new UserError("The league owner can't leave the league", 403);
  await forgetDevice(id);
  must(await db().from("players").delete().eq("id", player.id));
  return { ok: true };
});
