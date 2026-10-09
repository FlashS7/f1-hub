import { db, must } from "@/lib/server/db";
import { handle, requireProfile } from "@/lib/server/http";
import { UserError } from "@/lib/server/league";
import { pushConfigured, sendTo } from "@/lib/server/push";

/** Admin: send a test reminder to every browser that turned reminders on while logged in as you. */
export const POST = handle(async () => {
  const me = await requireProfile();
  if (!me.is_admin) throw new UserError("Admins only", 403);
  if (!pushConfigured()) throw new UserError("Push keys are not set on the server", 500);
  const subs = must(await db().from("push_subscriptions").select("endpoint, p256dh, auth, scope").eq("profile_id", me.id));
  if (!subs.length) throw new UserError("No device of yours has reminders on. Turn them on under the hub countdown first.", 404);
  const res = await sendTo(subs, { title: "Qualifying in 10 min · Test GP", body: "This is a test reminder from F1 HUB.", url: "/", tag: "test" });
  return { devices: subs.length, ok: res.ok, gone: res.gone };
});
