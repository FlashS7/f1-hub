import { currentPlayer } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { UserError, savePrediction } from "@/lib/server/league";
import { ROUND_ORDER, type RoundType } from "@/lib/scoring.config";

export const PUT = handle(async (req: Request, ctx: RouteContext<"/api/leagues/[id]/predictions">) => {
  const { id } = await ctx.params;
  const player = await currentPlayer(id);
  if (!player) throw new UserError("You're not in this league on this device", 401);
  const b = await body(req);
  const type = String(b.type) as RoundType;
  if (!ROUND_ORDER.includes(type)) throw new UserError("Unknown round type");
  const season = Number(b.season);
  const round = Number(b.round);
  if (!Number.isInteger(season) || !Number.isInteger(round)) throw new UserError("Bad round");
  await savePrediction(player, season, round, type, b.picks, b.fastestLap);
  return { ok: true, savedAt: new Date().toISOString() };
});
