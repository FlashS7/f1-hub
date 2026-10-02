import { notFound, redirect } from "next/navigation";
import { SetupNeeded } from "@/components/league/ui";
import { accentStyle } from "@/lib/accent";
import { currentPlayer } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";
import { getLeague } from "@/lib/server/league";

// Private league pages stay out of search results.
export const metadata = { robots: { index: false, follow: false } };

export default async function LeagueLayout({ children, params }: LayoutProps<"/league/[id]">) {
  if (!dbConfigured()) return <SetupNeeded />;
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  const me = await currentPlayer(id);
  // Not on this device: go through the invite page (join or log back in with PIN).
  if (!me) redirect(`/join/${league.invite_code}`);
  return <div style={accentStyle(me.team_id)}>{children}</div>;
}
