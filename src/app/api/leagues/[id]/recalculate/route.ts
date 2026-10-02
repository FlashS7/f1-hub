import { currentProfile } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { UserError, canManage, getLeague } from "@/lib/server/league";
import { rescoreWeekend } from "@/lib/server/scoring-runner";

/** "Recalculate weekend": league owner (or the admin) only, enforced here. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/leagues/[id]/recalculate">) => {
  const { id } = await ctx.params;
  const [league, me] = await Promise.all([getLeague(id), currentProfile()]);
  if (!league) throw new UserError("League not found", 404);
  if (!canManage(league, me)) throw new UserError("Only the league owner can recalculate", 403);
  const b = await body(req);
  const season = Number(b.season);
  const round = Number(b.round);
  if (!Number.isInteger(season) || !Number.isInteger(round)) throw new UserError("Bad round");
  return { ok: true, result: await rescoreWeekend(season, round) };
});
