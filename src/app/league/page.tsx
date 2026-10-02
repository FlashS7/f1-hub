import Link from "next/link";
import { ChevronRight, Globe, Lock } from "lucide-react";
import { Accent } from "@/components/Accent";
import { CodeJump, CreateLeagueForm, ProfileGate } from "@/components/league/forms";
import { PageTitle, SetupNeeded, TeamBar } from "@/components/league/ui";
import { currentProfile } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";
import { getGlobalLeague, leagueView, myPrivateLeagues } from "@/lib/server/league";
import { team } from "@/lib/teams";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leagues",
  description: "Join the global F1 prediction league or start a private one with friends. Free, no sign-up.",
};

export default async function Leagues() {
  if (!dbConfigured()) return <SetupNeeded />;

  const [me, global] = await Promise.all([currentProfile(), getGlobalLeague()]);
  const [mine, gView] = await Promise.all([
    me ? myPrivateLeagues(me.id) : Promise.resolve([]),
    global ? leagueView(global, me?.id ?? null) : Promise.resolve(null),
  ]);
  const myRow = me && gView ? gView.leaderboard.find((r) => r.player.id === me.id) : null;

  return (
    <Accent>
      <PageTitle eyebrow="Prediction league" title="Leagues">
        {me && (
          <Link href="/profile" className="mt-3 flex w-fit items-center gap-2 text-sm text-muted hover:text-text">
            <TeamBar teamId={me.team_id} className="h-5" /> Playing as <b className="text-text">{me.nickname}</b>
            <ChevronRight size={14} aria-hidden />
          </Link>
        )}
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {global && gView && (
          <section className="panel overflow-hidden" aria-labelledby="global-h">
            <Link href={`/league/${global.id}`} className="group block p-5 transition-colors hover:bg-surface-2">
              <div className="flex items-center gap-2 text-accent">
                <Globe size={16} aria-hidden />
                <span className="eyebrow !text-accent">Everyone plays here</span>
              </div>
              <h2 id="global-h" className="display mt-2 flex items-center justify-between text-3xl italic">
                {global.name}
                <ChevronRight size={20} className="text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
              </h2>
              <p className="mt-1 text-sm text-muted">
                {gView.members.length} {gView.members.length === 1 ? "player" : "players"}
                {myRow && <> · you&apos;re <b className="text-text">P{myRow.position}</b> with {myRow.total} pts</>}
              </p>
              <ol className="stagger mt-4">
                {gView.leaderboard.slice(0, 5).map((r, i) => (
                  <li key={r.player.id} style={{ "--i": i } as React.CSSProperties} className="flex items-center gap-3 border-b border-line/50 py-2">
                    <span className="display w-6 text-center text-lg italic text-muted">{r.position}</span>
                    <span className="h-5 w-1 -skew-x-12" style={{ background: team(r.player.teamId).color }} aria-hidden />
                    <span className="flex-1 truncate font-semibold">{r.player.nickname}</span>
                    <span className="font-mono font-bold tabular">{r.total}</span>
                  </li>
                ))}
              </ol>
            </Link>
          </section>
        )}

        <div className="flex flex-col gap-5">
          {me ? (
            <>
              <section className="panel p-5" aria-labelledby="mine-h">
                <h2 id="mine-h" className="display flex items-center gap-2 text-2xl">
                  <Lock size={18} className="text-faint" aria-hidden /> Private leagues
                </h2>
                {mine.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Start one for you and your friends, or open a friend&apos;s invite link.</p>
                ) : (
                  <ul className="stagger mt-3 flex flex-col gap-1.5">
                    {mine.map((l, i) => (
                      <li key={l.id} style={{ "--i": i } as React.CSSProperties}>
                        <Link href={`/league/${l.id}`} className="cut-sm group flex items-center gap-3 bg-surface-2 px-4 py-3 transition-colors hover:bg-surface-3">
                          <div className="min-w-0 flex-1">
                            <p className="display truncate text-xl">{l.name}</p>
                            <p className="text-xs text-muted">
                              {l.members} {l.members === 1 ? "player" : "players"}
                              {l.owner_profile_id === me.id ? " · owner" : ""}
                            </p>
                          </div>
                          <ChevronRight size={18} className="text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <CreateLeagueForm />
                </div>
              </section>
              <section className="panel p-5" aria-labelledby="code-h">
                <h2 id="code-h" className="display text-2xl">Have an invite code?</h2>
                <div className="mt-3">
                  <CodeJump />
                </div>
              </section>
            </>
          ) : (
            <ProfileGate
              title="Play along"
              subtitle="Pick a nickname to make predictions and start private leagues with friends. No email, no password."
            />
          )}
        </div>
      </div>
    </Accent>
  );
}
