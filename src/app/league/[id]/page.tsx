import Link from "next/link";
import { ChevronRight, Crown, Globe, Shield } from "lucide-react";
import { Flag } from "@/components/Flag";
import { InviteBox, LeaveLeagueButton, RecalcButton } from "@/components/league/actions";
import { Leaderboard } from "@/components/league/Leaderboard";
import { RoundCards, type RoundCardData } from "@/components/league/RoundCards";
import { PageTitle, TeamBar } from "@/components/league/ui";
import { ROUND_LABELS } from "@/lib/scoring.config";
import { currentProfile } from "@/lib/server/auth";
import { canManage, getLeague, leagueView, type RoundView } from "@/lib/server/league";
import { team } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/league/[id]">) {
  const league = await getLeague((await params).id);
  return { title: league?.name ?? "League" };
}

/** Rows shown in the global leaderboard (the viewer's row is always added). */
const GLOBAL_ROWS = 50;

export default async function LeaguePage({ params, searchParams }: PageProps<"/league/[id]">) {
  const { id } = await params;
  const welcome = (await searchParams).welcome === "1";
  const [league, me] = await Promise.all([getLeague(id), currentProfile()]);
  if (!league) return null; // layout already handles it
  const view = await leagueView(league, me?.id ?? null);
  const manage = canManage(league, me);
  const isOwner = !!me && league.owner_profile_id === me.id;
  const byId = new Map(view.members.map((p) => [p.id, p]));

  const toCard = (r: RoundView): RoundCardData => ({
    season: r.round.season,
    round: r.round.round,
    type: r.round.type,
    lockAt: r.round.lockAt,
    status: r.status,
    mine: me ? r.submitted.includes(me.id) : null,
    submittedCount: r.submittedCount,
    players: league.is_global
      ? undefined
      : view.members.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          teamColor: team(p.team_id).color,
          submitted: r.submitted.includes(p.id),
        })),
  });

  let rows = view.leaderboard;
  if (league.is_global && rows.length > GLOBAL_ROWS) {
    const mine = rows.find((r) => r.player.id === me?.id);
    rows = rows.slice(0, GLOBAL_ROWS);
    if (mine && !rows.includes(mine)) rows = [...rows, mine];
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {league.is_global ? (
              <span className="flex items-center gap-1.5"><Globe size={12} aria-hidden /> Global league</span>
            ) : (
              "Private league"
            )}
            · {view.season} · {view.members.length} {view.members.length === 1 ? "player" : "players"}
            {isOwner && (
              <span className="chip cut-sm bg-accent/20 text-text"><Crown size={11} aria-hidden /> Owner</span>
            )}
            {me?.is_admin && (
              <span className="chip cut-sm bg-accent/20 text-text"><Shield size={11} aria-hidden /> Admin</span>
            )}
          </span>
        }
        title={league.name}
      >
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {league.is_global ? (
            <p className="text-sm text-muted">Everyone with a profile is in. Make your picks and climb the table.</p>
          ) : (
            <InviteBox code={league.invite_code} />
          )}
          {me && (
            <Link href="/profile" className="flex items-center gap-2 text-sm text-muted hover:text-text">
              <TeamBar teamId={me.team_id} className="h-5" />
              {me.nickname}
              <ChevronRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      </PageTitle>

      {welcome && !league.is_global && (
        <div role="status" className="panel border-l-2 border-accent p-4 text-sm">
          <p className="display text-xl">You&apos;re in.</p>
          <p className="mt-1 text-muted">
            Share the invite link with friends. Your picks count here and in the global league automatically. On another device, log in
            with your nickname and PIN.
          </p>
        </div>
      )}

      {view.lastWeekend && view.lastRounds.length > 0 && (
        <section aria-labelledby="lwk-h">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">Last weekend · Round {view.lastWeekend.round}</p>
              <h2 id="lwk-h" className="display mt-1 flex items-center gap-2.5 text-3xl italic">
                <Flag country={view.lastWeekend.country} className="h-5 w-7" />
                {view.lastWeekend.name}
              </h2>
            </div>
            {manage && <RecalcButton leagueId={id} season={view.lastWeekend.season} round={view.lastWeekend.round} />}
          </div>
          <RoundCards leagueId={id} rounds={view.lastRounds.map(toCard)} />
        </section>
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
            {manage && <RecalcButton leagueId={id} season={view.weekend.season} round={view.weekend.round} />}
          </div>
          <RoundCards leagueId={id} rounds={view.rounds.map(toCard)} />
        </section>
      ) : (
        <p className="panel p-5 text-muted">No upcoming weekend on the calendar. Predictions open when the next season&apos;s schedule is out.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-2">
          <Leaderboard rows={rows} leagueId={id} meId={me?.id ?? null} />
          {rows.length < view.leaderboard.length && (
            <p className="text-center text-xs text-faint">Showing the top {GLOBAL_ROWS} of {view.leaderboard.length}.</p>
          )}
        </div>

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
                    <p className="font-semibold">
                      <span className="mr-2 font-mono text-xs text-faint">R{h.round}</span>
                      {h.name}
                      {league.is_global && <span className="ml-2 text-xs font-normal text-faint">{h.players} players</span>}
                    </p>
                    <ol className="mt-2 flex flex-col gap-1">
                      {ranked.map(([pid, pts]) => {
                        const p = byId.get(pid);
                        return (
                          <li key={pid} className={`flex items-center gap-2 text-sm ${pid === me?.id ? "text-text" : ""}`}>
                            <TeamBar teamId={p?.team_id ?? ""} className="h-4" />
                            <span className={`flex-1 truncate ${pid === me?.id ? "font-bold" : ""}`}>{p?.nickname ?? "Removed player"}</span>
                            {pts === top && top > 0 && <Crown size={13} className="text-yellow" aria-label="Weekend winner" />}
                            <span className="w-10 text-right font-mono font-bold tabular">{pts}</span>
                          </li>
                        );
                      })}
                    </ol>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {h.types.map((t) => (
                        <Link key={t} href={`/league/${id}/round/${view.season}/${h.round}/${t}`} className="chip cut-sm bg-surface-3 text-muted hover:text-text">
                          {ROUND_LABELS[t]}
                        </Link>
                      ))}
                    </div>
                    {manage && (
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

      {me && !league.is_global && !isOwner && (
        <div className="flex justify-end">
          <LeaveLeagueButton leagueId={id} />
        </div>
      )}
    </div>
  );
}
