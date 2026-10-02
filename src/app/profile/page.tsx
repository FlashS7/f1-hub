import { Accent } from "@/components/Accent";
import { ProfileGate } from "@/components/league/forms";
import { ProfileEdit } from "@/components/league/ProfileEdit";
import { PlayerStats } from "@/components/league/Stats";
import { PageTitle, SetupNeeded } from "@/components/league/ui";
import { currentProfile } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";
import { getGlobalLeague, profileStats } from "@/lib/server/league";
import { team } from "@/lib/teams";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  if (!dbConfigured()) return <SetupNeeded />;
  const me = await currentProfile();
  if (!me) {
    return (
      <div className="flex flex-col gap-5">
        <PageTitle eyebrow="Prediction league" title="Profile" />
        <ProfileGate title="Play along" subtitle="Pick a nickname to play, or log in with your PIN if you already have one." />
      </div>
    );
  }
  const global = await getGlobalLeague();
  const stats = global ? await profileStats(global, me.id) : null;
  const t = team(me.team_id);

  return (
    <Accent>
      <div className="flex flex-col gap-5">
        <PageTitle
          eyebrow={
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-1 -skew-x-12" style={{ background: t.color }} />
              {t.name}
              {me.is_admin && " · Admin"}
            </span>
          }
          title={me.nickname}
        />
        {stats && (
          <>
            <p className="eyebrow -mb-2">Global league</p>
            <PlayerStats {...stats} />
          </>
        )}
        <ProfileEdit nickname={me.nickname} teamId={me.team_id} isAdmin={me.is_admin} />
      </div>
    </Accent>
  );
}
