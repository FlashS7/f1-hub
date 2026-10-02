import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Hourglass, Lock, Pencil } from "lucide-react";
import { PlayerPicks, PointsLegend, type PlayerCard } from "@/components/league/Breakdown";
import { RecalcButton } from "@/components/league/actions";
import { PageTitle } from "@/components/league/ui";
import { LocalTime } from "@/components/Timezone";
import { predictionRounds } from "@/lib/rounds";
import { ROUND_LABELS, ROUND_ORDER, SCORING, type RoundType } from "@/lib/scoring.config";
import { currentProfile } from "@/lib/server/auth";
import { UserError, canManage, getLeague, roundView } from "@/lib/server/league";
import { team } from "@/lib/teams";
import type { Driver } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/league/[id]/round/[season]/[round]/[type]">) {
  const { type, round } = await params;
  return { title: `${ROUND_LABELS[type as RoundType] ?? "Round"} · R${round}` };
}

export default async function RoundPage({ params }: PageProps<"/league/[id]/round/[season]/[round]/[type]">) {
  const p = await params;
  const type = p.type as RoundType;
  const season = Number(p.season);
  const round = Number(p.round);
  if (!ROUND_ORDER.includes(type) || !Number.isInteger(season) || !Number.isInteger(round)) notFound();

  const [league, me] = await Promise.all([getLeague(p.id), currentProfile()]);
  if (!league) notFound();

  let v: Awaited<ReturnType<typeof roundView>>;
  try {
    v = await roundView(league, me?.id ?? null, season, round, type);
  } catch (e) {
    if (e instanceof UserError) notFound();
    throw e;
  }

  const drivers = new Map<string, Driver>(v.grid.map((d) => [d.id, d]));
  const cards: PlayerCard[] = v.picks
    .map((pr) => {
      const pl = v.members.get(pr.profile_id);
      return {
        id: pr.profile_id,
        nickname: pl?.nickname ?? "Removed player",
        teamId: pl?.team_id ?? "",
        picks: pr.picks,
        fastestLap: pr.fastest_lap,
        score: v.scores[pr.profile_id] ?? null,
      };
    })
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0) || a.nickname.localeCompare(b.nickname));

  const actualTop = v.result ? Object.entries(v.result.positions).sort((a, b) => a[1] - b[1]).slice(0, 10) : [];
  const editHref = `/predict/${season}/${round}/${type}`;

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/league/${league.id}`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={15} aria-hidden /> {league.name}
      </Link>
      <PageTitle eyebrow={`Round ${round} · ${v.weekend.name}`} title={ROUND_LABELS[type]}>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {predictionRounds(v.weekend).map((s) => (
            <Link
              key={s.type}
              href={`/league/${league.id}/round/${season}/${round}/${s.type}`}
              aria-current={s.type === type ? "page" : undefined}
              className={`cut-sm px-3 py-1.5 text-[13px] font-bold uppercase tracking-[0.12em] ${
                s.type === type ? "bg-accent text-[var(--accent-ink)]" : "bg-surface-2 text-muted hover:text-text"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ROUND_LABELS[s.type]}
            </Link>
          ))}
          <span className="ml-auto font-mono text-xs text-faint">
            ×{SCORING.multipliers[type]} · locks <LocalTime iso={v.round.lockAt} opts={{ weekday: "short", hour: "2-digit", minute: "2-digit" }} />
          </span>
        </div>
      </PageTitle>

      {v.status === "open" ? (
        <section className="panel flex flex-col gap-4 p-5">
          <p className="text-muted">Picks stay hidden until the session starts. {v.submittedCount} locked in so far.</p>
          {v.submitted && (
            <ul className="flex flex-wrap gap-1.5">
              {[...v.members.values()].map((pl) => (
                <li
                  key={pl.id}
                  className={`chip cut-sm border ${v.submitted!.has(pl.id) ? "border-transparent bg-surface-3 text-text" : "border-line text-faint"}`}
                >
                  <span className="size-1.5 rounded-full" style={{ background: v.submitted!.has(pl.id) ? team(pl.team_id).color : "transparent", outline: `1px solid ${team(pl.team_id).color}` }} />
                  {pl.nickname} · {v.submitted!.has(pl.id) ? "locked in" : "waiting"}
                </li>
              ))}
            </ul>
          )}
          <Link href={editHref} className="btn-primary w-fit">
            <Pencil size={15} aria-hidden /> {v.picks.length ? "Edit your pick" : "Make your pick"}
          </Link>
        </section>
      ) : (
        <>
          <div className="panel flex flex-wrap items-center gap-3 p-4 text-sm">
            {v.status === "scored" ? (
              <PointsLegend />
            ) : (
              <span className="flex flex-wrap items-center gap-2 text-muted">
                <Lock size={15} className="text-yellow" aria-hidden /> Locked. Picks are revealed.
                <Hourglass size={15} aria-hidden /> Points arrive automatically once official results are published.
              </span>
            )}
            {canManage(league, me) && (
              <span className="ml-auto">
                <RecalcButton leagueId={league.id} season={season} round={round} />
              </span>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <div className="grid gap-4 md:grid-cols-2">
                {cards.length === 0 && <p className="panel p-5 text-muted">Nobody predicted this round.</p>}
                {cards.map((c, i) => (
                  <PlayerPicks
                    key={c.id}
                    card={c}
                    drivers={drivers}
                    rank={v.status === "scored" ? i + 1 : null}
                    me={c.id === me?.id}
                    flResult={v.result?.fastest_lap ?? null}
                  />
                ))}
              </div>
              {v.hiddenCount > 0 && (
                <p className="text-center text-xs text-faint">Showing the top picks. {v.hiddenCount} more players predicted this round.</p>
              )}
            </div>
            <aside className="panel h-fit p-4" aria-labelledby="res-h">
              <h2 id="res-h" className="display text-2xl">Official result</h2>
              <div className="racing-line mt-3" />
              {actualTop.length === 0 ? (
                <p className="py-4 text-sm text-muted">Not published yet.</p>
              ) : (
                <ol className="stagger mt-1">
                  {actualTop.map(([id, pos], i) => {
                    const d = drivers.get(id);
                    return (
                      <li key={id} style={{ "--i": i } as React.CSSProperties} className="flex items-center gap-3 border-b border-line/50 py-1.5">
                        <span className="display w-7 text-center text-lg italic text-muted">{pos}</span>
                        <span className="h-5 w-1 -skew-x-12" style={{ background: team(d?.teamId).color }} aria-hidden />
                        <span className="font-mono text-sm font-bold">{d?.code ?? id}</span>
                        <span className="truncate text-xs text-muted">{d?.lastName}</span>
                      </li>
                    );
                  })}
                  {v.result?.fastest_lap && (
                    <li className="flex items-center gap-3 py-2 text-sm">
                      <span className="chip cut-sm bg-purple/20 text-purple">FL</span>
                      <span className="font-mono font-bold">{drivers.get(v.result.fastest_lap)?.code ?? v.result.fastest_lap}</span>
                    </li>
                  )}
                </ol>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
