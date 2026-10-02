import { CloudOff } from "lucide-react";
import { Flag } from "@/components/Flag";
import { LastResult, StandingsPanel } from "@/components/Standings";
import { TrackMap } from "@/components/TrackMap";
import { NextSession, Schedule } from "@/components/WeekendPanel";
import { PredictStrip } from "@/components/PredictStrip";
import { predictionRounds } from "@/lib/rounds";
import Link from "next/link";
import { getConstructorStandings, getDriverStandings, getFeaturedWeekend, getLastRaceResult } from "@/lib/f1";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

// Re-render at most every 5 minutes; Jolpica responses are cached separately.
export const revalidate = 300;

export const metadata = { alternates: { canonical: "/" } };

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "F1 HUB",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "SportsApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};

const settle = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch (e) {
    console.error("hub data", e);
    return null;
  }
};

export default async function Home() {
  const [featured, drivers, constructors, last] = await Promise.all([
    settle(getFeaturedWeekend()),
    settle(getDriverStandings()),
    settle(getConstructorStandings()),
    settle(getLastRaceResult()),
  ]);
  const apiDown = featured === null && drivers === null;
  const w = featured?.weekend ?? null;

  return (
    <div className="flex flex-col gap-5">
      {apiDown && (
        <div role="status" className="panel flex items-center gap-3 border-l-2 border-yellow p-4 text-sm">
          <CloudOff size={18} className="shrink-0 text-yellow" aria-hidden />
          <p>
            Live F1 data is unreachable right now. If you&apos;ve opened the app before, the last known data is shown when offline. Try
            again in a few minutes.
          </p>
        </div>
      )}

      {w ? (
        <section aria-labelledby="gp-h" className="panel overflow-hidden">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-l from-surface-2/60 to-transparent md:block" />
          <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[1.25fr_1fr] md:items-center">
            <div className="flex min-w-0 flex-col gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className="chip cut-sm bg-red text-white">Round {w.round}</span>
                  {w.isSprint && <span className="chip cut-sm bg-purple/20 text-purple">Sprint weekend</span>}
                  <span className="text-xs uppercase tracking-[0.2em] text-faint">{w.season}</span>
                </div>
                <h1 id="gp-h" className="display mt-3 text-[44px] italic sm:text-[64px]">
                  {w.name.split(" Grand Prix")[0]}
                  {w.name.includes(" Grand Prix") && (
                    <span className="block text-[0.5em] not-italic text-muted">Grand Prix{w.name.split(" Grand Prix")[1]}</span>
                  )}
                </h1>
                <p className="mt-3 flex items-center gap-2.5 text-sm text-muted">
                  <Flag country={w.country} />
                  <span>
                    {w.circuitName} · {w.locality}, {w.country}
                  </span>
                </p>
              </div>
              <NextSession weekend={w} />
            </div>
            <TrackMap circuitId={w.circuitId} name={w.circuitName} className="mx-auto aspect-square w-full max-w-[260px] md:max-w-[380px]" />
          </div>
        </section>
      ) : (
        !apiDown && (
          <section className="panel p-7">
            <p className="eyebrow">Off-season</p>
            <h1 className="display mt-2 text-5xl italic">Season complete</h1>
            <p className="mt-3 max-w-prose text-muted">
              No upcoming sessions on the calendar yet. The countdown comes back as soon as next season&apos;s schedule is published.
            </p>
          </section>
        )
      )}

      {w && predictionRounds(w).length > 0 && <PredictStrip rounds={predictionRounds(w)} />}

      <div className="grid gap-5 lg:grid-cols-2">
        {w && <Schedule weekend={w} />}
        <LastResult result={last} />
        {(drivers?.length || constructors?.length) ? (
          <div className={w ? "lg:col-span-2" : ""}>
            <StandingsPanel drivers={drivers ?? []} constructors={constructors ?? []} />
          </div>
        ) : null}
      </div>

      {!w && (
        <section aria-labelledby="about-h" className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex-1">
            <h2 id="about-h" className="display text-2xl italic">F1 prediction league</h2>
            <p className="mt-2 max-w-prose text-sm text-muted">
              Predict the top 10 of every qualifying, sprint qualifying, sprint and race, in the global league or a private one with
              friends. Free, no sign-up: pick a nickname and PIN.
            </p>
          </div>
          <Link href="/league" className="btn-primary shrink-0">
            See the leaderboard
          </Link>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
    </div>
  );
}
