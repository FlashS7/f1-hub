import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Accent } from "@/components/Accent";
import { AdminFeedback, type FeedbackItem } from "@/components/AdminFeedback";
import { PushTestButton } from "@/components/PushTestButton";
import { SessionDelays } from "@/components/SessionDelays";
import { PageTitle } from "@/components/league/ui";
import { getFeaturedWeekend } from "@/lib/f1";
import { predictionRounds } from "@/lib/rounds";
import { ROUND_LABELS } from "@/lib/scoring.config";
import { currentProfile } from "@/lib/server/auth";
import { db, dbConfigured } from "@/lib/server/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

const count = async (table: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db().from(table).select("*", { count: "exact", head: true });
  if (f) q = f(q);
  return (await q).count ?? 0;
};

/** ISO timestamp n days ago. */
const since = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="eyebrow">{label}</p>
      <p className="display mt-2 text-[40px] italic tabular leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default async function AdminPage() {
  if (!dbConfigured()) notFound();
  const me = await currentProfile();
  // Not advertised anywhere for non-admins; looks like a missing page to them.
  if (!me?.is_admin) notFound();

  const day = since(1);
  const week = since(7);
  const { weekend } = await getFeaturedWeekend().catch(() => ({ weekend: null }));

  const [profiles, new24, new7, privateLeagues, members, fbNew, fbRows, pickRows, pushSubs] = await Promise.all([
    count("profiles"),
    count("profiles", (q) => q.gte("created_at", day)),
    count("profiles", (q) => q.gte("created_at", week)),
    count("leagues", (q) => q.eq("is_global", false)),
    count("league_members"),
    count("feedback", (q) => q.eq("status", "new")),
    db().from("feedback").select("id, kind, message, contact, page, user_agent, status, created_at, profiles(nickname)")
      .order("status", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    weekend
      ? db().from("picks").select("round_type, profile_id").eq("season", weekend.season).eq("round", weekend.round)
      : Promise.resolve({ data: [] as { round_type: string; profile_id: string }[] }),
    count("push_subscriptions"),
  ]);

  const picks = pickRows.data ?? [];
  const pickers = new Set(picks.map((p) => p.profile_id)).size;
  const items: FeedbackItem[] = (fbRows.data ?? []).map((f) => ({
    ...(f as unknown as Omit<FeedbackItem, "nickname">),
    nickname: (f.profiles as unknown as { nickname: string } | null)?.nickname ?? null,
  }));

  return (
    <Accent>
      <div className="flex flex-col gap-6">
        <PageTitle eyebrow="Admin" title="Dashboard">
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 hover:text-text"
          >
            Visitors &amp; traffic sources: Vercel → f1-hub → Analytics <ExternalLink size={13} aria-hidden />
          </a>
        </PageTitle>

        <section aria-labelledby="st-h">
          <h2 id="st-h" className="sr-only">Stats</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Players" value={profiles} sub={`+${new24} today · +${new7} this week`} />
            <Stat label="Picking this weekend" value={pickers} sub={weekend ? weekend.name : "No weekend"} />
            <Stat label="Private leagues" value={privateLeagues} sub={`${members} memberships`} />
            <Stat label="New feedback" value={fbNew} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>Session reminders on: <b className="text-text">{pushSubs}</b> devices</span>
            <PushTestButton />
          </div>
          {weekend && (
            <p className="mt-3 text-xs text-muted">
              Picks this weekend:{" "}
              {predictionRounds(weekend)
                .map((r) => `${ROUND_LABELS[r.type]} ${picks.filter((p) => p.round_type === r.type).length}`)
                .join(" · ")}
            </p>
          )}
        </section>

        {weekend && <SessionDelays season={weekend.season} round={weekend.round} sessions={weekend.sessions} />}

        <section className="panel p-4 sm:p-5" aria-labelledby="fb-h">
          <h2 id="fb-h" className="display text-2xl">Feedback</h2>
          <div className="racing-line my-3" />
          <AdminFeedback items={items} />
        </section>
      </div>
    </Accent>
  );
}
