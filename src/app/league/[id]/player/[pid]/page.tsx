import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminControls } from "@/components/league/ProfileEdit";
import { PlayerStats } from "@/components/league/Stats";
import { PageTitle } from "@/components/league/ui";
import { accentStyle } from "@/lib/accent";
import { currentProfile } from "@/lib/server/auth";
import { getLeague, getProfile, isMember, profileStats } from "@/lib/server/league";
import { team } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: PageProps<"/league/[id]/player/[pid]">) {
  const { id, pid } = await params;
  const [league, me, player] = await Promise.all([getLeague(id), currentProfile(), getProfile(pid)]);
  if (!league || !player || !(await isMember(league, pid))) notFound();

  const stats = await profileStats(league, pid);
  const t = team(player.team_id);

  return (
    <div style={accentStyle(player.team_id)} className="flex flex-col gap-5">
      <Link href={`/league/${id}`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={15} aria-hidden /> {league.name}
      </Link>
      <PageTitle
        eyebrow={
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-1 -skew-x-12" style={{ background: t.color }} />
            {t.name}
            {league.owner_profile_id === pid && " · League owner"}
          </span>
        }
        title={player.nickname}
      >
        {me?.id === pid && (
          <Link href="/profile" className="mt-3 inline-block text-sm text-muted underline underline-offset-4 hover:text-text">
            Edit your profile
          </Link>
        )}
      </PageTitle>
      <PlayerStats {...stats} />
      {me?.is_admin && me.id !== pid && <AdminControls profileId={pid} nickname={player.nickname} />}
    </div>
  );
}
