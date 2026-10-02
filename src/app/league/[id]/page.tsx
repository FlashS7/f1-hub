import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { Flag } from "@/components/Flag";
import { InviteBox, RecalcButton } from "@/components/league/actions";
import { Leaderboard } from "@/components/league/Leaderboard";
import { RoundCards } from "@/components/league/RoundCards";
import { PageTitle, TeamBar } from "@/components/league/ui";
import { ROUND_LABELS } from "@/lib/scoring.config";
import { currentPlayer } from "@/lib/server/auth";
import { getLeague, leagueView } from "@/lib/server/league";
import { team } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/league/[id]">) {
  const league = await getLeague((await params).id);
  return { title: league?.name ?? "League" };
}

export default async function LeaguePage({ params, searchParams }: PageProps<"/league/[id]">) {
  const { id } = await params;
  const welcome = (await searchParams).welcome === "1";
  const [league, me, view] = await Promise.all([getLeague(id), currentPlayer(id), leagueView(id)]);
  if (!league || !me) return null; // layout already redirects
  const isOwner = league.owner_player_id === me.id;
  const nick = new Map(view.players.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={
          <span className="flex items-center gap-2">
            Prediction league · {view.season}
            {isOwner && (
              <span className="chip cut-sm bg-accent/20 text-text">
                <Crown size={11} aria-hidden /> Owner
              </span>
            )}
          </span>
        }
        title={league.name}
      >
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <InviteBox code={league.invite_code} />
          <Link href={`/league/${id}/player/${me.id}`} className="flex items-center gap-2 text-sm text-muted hover:text-text">
            <TeamBar teamId={me.team_id} className="h-5" />
            {me.nickname}
            <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
      </PageTitle>

      {welcome && (
        <div role="status" className="panel border-l-2 border-accent p-4 text-sm">
          <p className="display text-xl">You&apos;re in.</p>
          <p className="mt-1 text-muted">
            Send the invite link to your friends. This device stays logged in. On another device, open the invite link and choose
            &ldquo;I already play&rdquo; with your nickname and PIN.
          </p>
        </div>
      )}

      {view.weekend ? (
        <section aria-labelledby="wk-h">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">This weekend · Round {view.weekend.round}</p>
              <h2 id="wk-h" className="display mt-1 flex items-center gap-2.5 text-3xl italic">
                <Flag country={view.weekend.country} className="h-5 w-7" />
                {view.weekend.name}
              </h2>
            </div>
            {isOwner && <RecalcButton leagueId={id} season={view.weekend.season} round={view.weekend.round} />}
          </div>
          <RoundCards
            leagueId={id}
            meId={me.id}
            rounds={view.rounds.map((r) => ({
              season: r.round.season,
              round: r.round.round,
              type: r.round.type,
              lockAt: r.round.lockAt,
              status: r.status,
              players: view.players.map((p) => ({
                id: p.id,
                nickname: p.nickname,
                teamColor: team(p.team_id).color,
                submitted: r.submitted[p.id],
              })),
            }))}
          />
        </section>
      ) : (
        <p className="panel p-5 text-muted">No upcoming weekend on the calendar. Predictions open when the next season&apos;s schedule is out.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Leaderboard rows={view.leaderboard} leagueId={id} meId={me.id} />

        <section aria-labelledby="hist-h" className="panel p-4 sm:p-5">
          <h2 id="hist-h" className="display text-2xl">Past weekends</h2>
          <div className="racing-line mt-3" />
          {view.history.length === 0 ? (
            <p className="py-6 text-sm text-muted">Nothing scored yet. Points appear here automatically after each session.</p>
          ) : (
            <ul className="stagger mt-2 flex flex-col gap-2">
              {view.history.map((h, i) => {
                const ranked = Object.entries(h.points).sort((a, b) => b[1] - a[1]);
                const top = ranked[0]?.[1] ?? 0;
                return (
                  <li key={h.round} style={{ "--i": i } as React.CSSProperties} className="cut-sm bg-surface-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        <span className="mr-2 font-mono text-xs text-faint">R{h.round}</span>
                        {h.name}
                      </p>
                    </div>
                    <ol className="mt-2 flex flex-col gap-1">
                      {ranked.map(([pid, pts]) => {
                        const p = nick.get(pid);
                        return (
                          <li key={pid} className="flex items-center gap-2 text-sm">
                            <TeamBar teamId={p?.team_id ?? ""} className="h-4" />
                            <span className="flex-1 truncate">{p?.nickname ?? "Left the league"}</span>
                            {pts === top && top > 0 && <Crown size={13} className="text-yellow" aria-label="Weekend winner" />}
                            <span className="w-10 text-right font-mono font-bold tabular">{pts}</span>
                          </li>
                        );
                      })}
                    </ol>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {h.types.map((t) => (
                        <Link
                          key={t}
                          href={`/league/${id}/round/${view.season}/${h.round}/${t}`}
                          className="chip cut-sm bg-surface-3 text-muted hover:text-text"
                        >
                          {ROUND_LABELS[t]}
                        </Link>
                      ))}
                    </div>
                    {isOwner && (
                      <div className="mt-2 border-t border-line/60 pt-2">
                        <RecalcButton leagueId={id} season={view.season} round={h.round} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
