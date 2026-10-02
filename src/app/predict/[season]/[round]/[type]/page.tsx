import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Accent } from "@/components/Accent";
import { PredictionEditor } from "@/components/league/PredictionEditor";
import { ProfileGate } from "@/components/league/forms";
import { PageTitle, SetupNeeded } from "@/components/league/ui";
import { LocalTime } from "@/components/Timezone";
import { getGrid } from "@/lib/f1";
import { isLocked, predictionRounds } from "@/lib/rounds";
import { ROUND_LABELS, ROUND_ORDER, SCORING, type RoundType } from "@/lib/scoring.config";
import { currentProfile } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";
import { UserError, findRound, getGlobalLeague, myPick } from "@/lib/server/league";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/predict/[season]/[round]/[type]">) {
  const { type, round } = await params;
  return { title: `Predict ${ROUND_LABELS[type as RoundType] ?? "round"} · R${round}`, robots: { index: false } };
}

export default async function PredictPage({ params }: PageProps<"/predict/[season]/[round]/[type]">) {
  if (!dbConfigured()) return <SetupNeeded />;
  const p = await params;
  const type = p.type as RoundType;
  const season = Number(p.season);
  const round = Number(p.round);
  if (!ROUND_ORDER.includes(type) || !Number.isInteger(season) || !Number.isInteger(round)) notFound();

  let found: Awaited<ReturnType<typeof findRound>>;
  try {
    found = await findRound(season, round, type);
  } catch (e) {
    if (e instanceof UserError) notFound();
    throw e;
  }
  const { weekend, round: r } = found;

  // Once locked there's nothing to edit: show everyone's picks in the global league.
  if (isLocked(r.lockAt)) {
    const g = await getGlobalLeague();
    if (g) redirect(`/league/${g.id}/round/${season}/${round}/${type}`);
  }

  const [me, grid] = await Promise.all([currentProfile(), getGrid()]);
  const mine = me ? await myPick(me.id, season, round, type) : null;

  return (
    <Accent>
      <div className="flex flex-col gap-5">
        <Link href="/league" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft size={15} aria-hidden /> Leagues
        </Link>
        <PageTitle eyebrow={`Round ${round} · ${weekend.name}`} title={ROUND_LABELS[type]}>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {predictionRounds(weekend).map((s) => (
              <Link
                key={s.type}
                href={`/predict/${season}/${round}/${s.type}`}
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
              ×{SCORING.multipliers[type]} · locks <LocalTime iso={r.lockAt} opts={{ weekday: "short", hour: "2-digit", minute: "2-digit" }} />
            </span>
          </div>
        </PageTitle>

        {me ? (
          <>
            <p className="text-sm text-muted">One pick per round. It counts in the global league and in every private league you&apos;re in.</p>
            <PredictionEditor
              key={mine?.updated_at ?? "new"}
              season={season}
              round={round}
              type={type}
              lockAt={r.lockAt}
              grid={grid}
              initial={mine ? { picks: mine.picks, fastestLap: mine.fastest_lap } : null}
            />
          </>
        ) : (
          <ProfileGate
            title="Pick a nickname to play"
            subtitle="Takes ten seconds. No email, no password. This device remembers you."
            submitLabel="Start picking"
          />
        )}
      </div>
    </Accent>
  );
}
