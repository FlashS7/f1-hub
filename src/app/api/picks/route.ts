import { body, handle, requireProfile } from "@/lib/server/http";
import { UserError, savePick } from "@/lib/server/league";
import { ROUND_ORDER, type RoundType } from "@/lib/scoring.config";

/** Save my pick for a round. One pick counts in every league I'm in. */
export const PUT = handle(async (req: Request) => {
  const me = await requireProfile();
  const b = await body(req);
  const type = String(b.type) as RoundType;
  if (!ROUND_ORDER.includes(type)) throw new UserError("Unknown round type");
  const season = Number(b.season);
  const round = Number(b.round);
  if (!Number.isInteger(season) || !Number.isInteger(round)) throw new UserError("Bad round");
  await savePick(me, season, round, type, b.picks, b.fastestLap);
  return { ok: true, savedAt: new Date().toISOString() };
});
