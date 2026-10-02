import { notFound, redirect } from "next/navigation";
import { Accent } from "@/components/Accent";
import { JoinLeagueButton, ProfileGate } from "@/components/league/forms";
import { PageTitle, SetupNeeded, TeamBar } from "@/components/league/ui";
import { currentProfile } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";
import { getLeagueByCode, isMember, leagueMembers } from "@/lib/server/league";

export const metadata = { title: "Join league", robots: { index: false } };

export default async function Join({ params }: PageProps<"/join/[code]">) {
  if (!dbConfigured()) return <SetupNeeded />;
  const { code } = await params;
  const league = await getLeagueByCode(code);
  if (!league) notFound();
  const me = await currentProfile();
  if (me && (await isMember(league, me.id))) redirect(`/league/${league.id}`);
  const members = await leagueMembers(league);

  return (
    <Accent>
      <div className="mx-auto max-w-xl">
        <PageTitle eyebrow={`You're invited · ${members.length} player${members.length === 1 ? "" : "s"}`} title={league.name} />
        {me ? (
          <section className="panel flex flex-col gap-4 p-5">
            <div className="flex items-start gap-2.5 text-sm text-muted">
              <TeamBar teamId={me.team_id} className="mt-0.5 h-5" />
              <p>
                Joining as <b className="text-text">{me.nickname}</b>. Your picks count here automatically.
              </p>
            </div>
            <JoinLeagueButton leagueId={league.id} />
          </section>
        ) : (
          <ProfileGate
            title="Pick a nickname to join"
            subtitle="No email, no password. Already playing? Log in below with your PIN."
            submitLabel="Join league"
            joinLeagueId={league.id}
          />
        )}
      </div>
    </Accent>
  );
}
