import { NextResponse } from "next/server";
import { getFeaturedWeekend, getSchedule } from "@/lib/f1";
import { ensureScored, rescoreWeekend } from "@/lib/server/scoring-runner";

/** Re-fetch results this long after a weekend ends, to pick up late penalties and Jolpica catching up. */
const RECHECK_DAYS = 4;

/** Daily safety net (vercel.json cron). Pages also score lazily on load. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { season } = await getFeaturedWeekend();
  await ensureScored(season);

  const now = Date.now();
  const recent = (await getSchedule(season)).filter((w) => {
    const end = new Date(w.sessions.at(-1)!.end).getTime();
    return end < now && now - end < RECHECK_DAYS * 86400_000;
  });
  const rescored: Record<number, unknown> = {};
  for (const w of recent) rescored[w.round] = await rescoreWeekend(season, w.round).catch((e) => String(e));
  return NextResponse.json({ ok: true, season, rescored });
}
