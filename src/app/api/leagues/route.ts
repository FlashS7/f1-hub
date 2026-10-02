import { body, handle, requireProfile } from "@/lib/server/http";
import { createLeague } from "@/lib/server/league";

/** Create a private league; the creator becomes its owner. */
export const POST = handle(async (req: Request) => {
  const me = await requireProfile();
  const b = await body(req);
  const league = await createLeague(b.name, me);
  return { leagueId: league.id, code: league.invite_code };
});
