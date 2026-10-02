import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CodeJump, CreateLeagueForm } from "@/components/league/forms";
import { PageTitle, SetupNeeded, TeamBar } from "@/components/league/ui";
import { currentPlayer, deviceLeagueIds } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";
import { getLeague } from "@/lib/server/league";

export const metadata = { title: "Leagues" };

export default async function Leagues() {
  if (!dbConfigured()) return <SetupNeeded />;

  const ids = await deviceLeagueIds();
  const mine = (
    await Promise.all(
      ids.map(async (id) => {
        const [league, me] = await Promise.all([getLeague(id), currentPlayer(id)]);
        return league && me ? { league, me } : null;
      }),
    )
  ).filter((x) => x !== null);

  return (
    <div>
      <PageTitle eyebrow="Prediction league" title="Leagues" />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-5">
          <section className="panel p-5" aria-labelledby="mine-h">
            <h2 id="mine-h" className="display text-2xl">Your leagues</h2>
            {mine.length === 0 ? (
              <p className="mt-3 text-sm text-muted">None on this device yet. Create one, or open your friend&apos;s invite link.</p>
            ) : (
              <ul className="stagger mt-3 flex flex-col gap-1.5">
                {mine.map(({ league, me }, i) => (
                  <li key={league.id} style={{ "--i": i } as React.CSSProperties}>
                    <Link
                      href={`/league/${league.id}`}
                      className="cut-sm group flex items-center gap-3 bg-surface-2 px-4 py-3 transition-colors hover:bg-surface-3"
                    >
                      <TeamBar teamId={me.team_id} />
                      <div className="min-w-0 flex-1">
                        <p className="display truncate text-xl">{league.name}</p>
                        <p className="text-xs text-muted">as {me.nickname}{league.owner_player_id === me.id ? " · owner" : ""}</p>
                      </div>
                      <ChevronRight size={18} className="text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel p-5" aria-labelledby="code-h">
            <h2 id="code-h" className="display text-2xl">Have an invite code?</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Also use this to log back in on a new device.</p>
            <CodeJump />
          </section>
        </div>
        <section className="panel p-5" aria-labelledby="new-h">
          <h2 id="new-h" className="display text-2xl">Create a league</h2>
          <p className="mb-4 mt-1 text-sm text-muted">You&apos;ll be the owner. You get an invite link to send to friends.</p>
          <CreateLeagueForm />
        </section>
      </div>
    </div>
  );
}
