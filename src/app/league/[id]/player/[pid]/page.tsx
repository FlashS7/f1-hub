import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProfileEdit } from "@/components/league/ProfileEdit";
import { PageTitle } from "@/components/league/ui";
import { accentStyle } from "@/lib/accent";
import { currentPlayer } from "@/lib/server/auth";
import { getLeague, getPlayers, playerStats } from "@/lib/server/league";
import { team } from "@/lib/teams";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="eyebrow">{label}</p>
      <p className="display mt-2 text-[40px] italic tabular leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default async function PlayerPage({ params }: PageProps<"/league/[id]/player/[pid]">) {
  const { id, pid } = await params;
  const [league, me, players] = await Promise.all([getLeague(id), currentPlayer(id), getPlayers(id)]);
  const player = players.find((p) => p.id === pid);
  if (!league || !me || !player) notFound();

  const { row, history } = await playerStats(id, pid);
  const t = team(player.team_id);
  const self = me.id === pid;
  const bestName = row?.best ? history.find((h) => h.round === row.best!.round)?.name : null;

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
            {league.owner_player_id === pid && " · League owner"}
          </span>
        }
        title={player.nickname}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total points" value={row?.total ?? 0} sub={row ? `P${row.position} of ${players.length}` : undefined} />
        <Stat label="Weekends played" value={row?.weekendsPlayed ?? 0} sub={`${row?.weekendsWon ?? 0} won`} />
        <Stat label="Best weekend" value={row?.best?.points ?? "–"} sub={bestName ?? undefined} />
        <Stat
          label="Accuracy"
          value={`${Math.round((row?.accuracy ?? 0) * 100)}%`}
          sub="Picks in the exact position"
        />
      </div>

      {self ? (
        <ProfileEdit leagueId={id} nickname={player.nickname} teamId={player.team_id} isOwner={league.owner_player_id === me.id} />
      ) : null}
    </div>
  );
}
