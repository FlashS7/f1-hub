import { NextResponse } from "next/server";
import { notifyUpcoming, pushConfigured } from "@/lib/server/push";

/** Hit every minute by Supabase pg_cron: sends "starts in 10 min" reminders. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "push not configured" });
  try {
    return NextResponse.json({ ok: true, sent: await notifyUpcoming() });
  } catch (e) {
    console.error("notify failed", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
