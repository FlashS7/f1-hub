import { issueDeviceToken } from "@/lib/server/auth";
import { body, handle } from "@/lib/server/http";
import { cleanNickname, cleanPin, cleanTeam, createLeague } from "@/lib/server/league";

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const { league, player } = await createLeague(
    String(b.name ?? ""),
    cleanNickname(b.nickname),
    cleanPin(b.pin),
    cleanTeam(b.teamId),
  );
  await issueDeviceToken(player.id, league.id);
  return { leagueId: league.id, code: league.invite_code };
});
