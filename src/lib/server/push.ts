import webpush from "web-push";
import { getFeaturedWeekend } from "../f1";
import type { Session } from "../types";
import { db, fetchAll, must } from "./db";

/** Minutes before a session starts that the reminder goes out. */
export const REMIND_MIN = 10;
const MAIN: Session["key"][] = ["SQ", "SPRINT", "QUALI", "RACE"];
const PICKS: Session["key"][] = ["SQ", "SPRINT", "QUALI", "RACE"];

export const pushConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

let ready = false;
function init() {
  if (ready) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  scope: "all" | "main";
}

/** Sends to the given subscriptions; drops the ones the push service says are gone. */
export async function sendTo(subs: SubRow[], payload: PushPayload) {
  init();
  const body = JSON.stringify(payload);
  let ok = 0;
  const gone: string[] = [];
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(
      subs.slice(i, i + 50).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            TTL: 15 * 60, // a reminder is useless after the session started
            urgency: "high",
          });
          ok++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(s.endpoint);
          else console.warn("push failed", code, (e as Error).message);
        }
      }),
    );
  }
  if (gone.length) await db().from("push_subscriptions").delete().in("endpoint", gone);
  if (ok) {
    await db().from("push_subscriptions").update({ last_sent_at: new Date().toISOString() })
      .in("endpoint", subs.map((s) => s.endpoint).filter((e) => !gone.includes(e)));
  }
  return { ok, gone: gone.length };
}

/** Sessions starting within the next REMIND_MIN minutes (not yet started). */
export function dueSessions(sessions: Session[], now: Date, minutes = REMIND_MIN): Session[] {
  return sessions.filter((s) => {
    const left = (new Date(s.start).getTime() - now.getTime()) / 60_000;
    return left > 0 && left <= minutes;
  });
}

/**
 * Called every minute. Finds sessions starting within REMIND_MIN minutes that haven't been announced,
 * claims them in push_log (so parallel calls can't double-send) and notifies subscribers.
 */
export async function notifyUpcoming(now = new Date()) {
  const { weekend } = await getFeaturedWeekend(now);
  if (!weekend) return [];
  const due = dueSessions(weekend.sessions, now);
  const sent: { session: string; ok: number; gone: number }[] = [];
  for (const s of due) {
    const id = `${weekend.season}-${weekend.round}-${s.key}`;
    const claim = await db().from("push_log").insert({ session_id: id });
    if (claim.error) continue; // already announced (primary key)

    const subs = await fetchAll<SubRow>((a, b) => {
      let q = db().from("push_subscriptions").select("endpoint, p256dh, auth, scope");
      if (!MAIN.includes(s.key)) q = q.eq("scope", "all");
      return q.range(a, b);
    });
    const mins = Math.max(1, Math.round((new Date(s.start).getTime() - now.getTime()) / 60_000));
    const gp = weekend.name.replace(/ Grand Prix.*$/, " GP");
    const pick = PICKS.includes(s.key);
    const res = await sendTo(subs, {
      title: `${s.label} in ${mins} min · ${gp}`,
      body: pick ? "Last chance to lock in your top 10 prediction." : "Lights out soon. Check the schedule and standings.",
      url: pick ? `/predict/${weekend.season}/${weekend.round}/${s.key}` : "/",
      tag: id,
    });
    must(await db().from("push_log").update({ recipients: res.ok }).eq("session_id", id));
    sent.push({ session: id, ...res });
  }
  return sent;
}
