import { handle, requireProfile } from "@/lib/server/http";
import { UserError, getLeague, leaveLeague } from "@/lib/server/league";

/** Leave a private league. Your picks stay and keep counting in your other leagues. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/leagues/[id]/leave">) => {
  const { id } = await ctx.params;
  const me = await requireProfile();
  const league = await getLeague(id);
  if (!league) throw new UserError("League not found", 404);
  await leaveLeague(league, me);
  return { ok: true };
});
