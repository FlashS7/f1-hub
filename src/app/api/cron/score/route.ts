import { NextResponse } from "next/server";
import { getFeaturedWeekend } from "@/lib/f1";
import { ensureScored } from "@/lib/server/scoring-runner";

/** Daily safety net (vercel.json cron). Pages also score lazily on load. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { season } = await getFeaturedWeekend();
  await ensureScored(season);
  return NextResponse.json({ ok: true, season });
}
