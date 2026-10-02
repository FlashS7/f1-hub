import { issueDeviceToken } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { UserError, addPlayer, cleanNickname, cleanPin, cleanTeam, getLeague } from "@/lib/server/league";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/leagues/[id]/join">) => {
  const { id } = await ctx.params;
  const league = await getLeague(id);
  if (!league) throw new UserError("League not found", 404);
  const b = await body(req);
  const player = await addPlayer(league.id, cleanNickname(b.nickname), cleanPin(b.pin), cleanTeam(b.teamId));
  await issueDeviceToken(player.id, league.id);
  return { playerId: player.id };
});
