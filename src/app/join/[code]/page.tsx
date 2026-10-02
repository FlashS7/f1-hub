import { notFound, redirect } from "next/navigation";
import { JoinTabs } from "@/components/league/JoinTabs";
import { PageTitle, SetupNeeded } from "@/components/league/ui";
import { currentPlayer } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";
import { getLeagueByCode, getPlayers } from "@/lib/server/league";

export const metadata = { title: "Join league", robots: { index: false } };

export default async function Join({ params }: PageProps<"/join/[code]">) {
  if (!dbConfigured()) return <SetupNeeded />;
  const { code } = await params;
  const league = await getLeagueByCode(code);
  if (!league) notFound();
  if (await currentPlayer(league.id)) redirect(`/league/${league.id}`);
  const players = await getPlayers(league.id);

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow={`You're invited · ${players.length} player${players.length === 1 ? "" : "s"}`} title={league.name} />
      <JoinTabs leagueId={league.id} />
    </div>
  );
}
