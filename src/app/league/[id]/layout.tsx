import { notFound, redirect } from "next/navigation";
import { Accent } from "@/components/Accent";
import { SetupNeeded } from "@/components/league/ui";
import { currentProfile } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";
import { getLeague, isMember } from "@/lib/server/league";

// League pages stay out of search results.
export const metadata = { robots: { index: false, follow: false } };

export default async function LeagueLayout({ children, params }: LayoutProps<"/league/[id]">) {
  if (!dbConfigured()) return <SetupNeeded />;
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();
  // The global league is public. Private leagues are for members: everyone else goes through the invite page.
  if (!league.is_global) {
    const me = await currentProfile();
    if (!(await isMember(league, me?.id))) redirect(`/join/${league.invite_code}`);
  }
  return <Accent>{children}</Accent>;
}
