import { handle, requireProfile } from "@/lib/server/http";
import { UserError, getLeague, joinLeague } from "@/lib/server/league";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/leagues/[id]/join">) => {
  const { id } = await ctx.params;
  const me = await requireProfile();
  const league = await getLeague(id);
  if (!league) throw new UserError("League not found", 404);
  await joinLeague(league, me);
  return { ok: true };
});
