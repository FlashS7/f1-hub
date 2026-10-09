import { currentProfile } from "@/lib/server/auth";
import { db, must } from "@/lib/server/db";
import { body, handle } from "@/lib/server/http";
import { UserError } from "@/lib/server/league";

/** Save (or update) this browser's push subscription. */
export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const sub = b.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\/\S+$/.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    throw new UserError("Invalid subscription");
  }
  const scope = b.scope === "main" ? "main" : "all";
  const me = await currentProfile().catch(() => null);
  must(
    await db().from("push_subscriptions").upsert({
      endpoint, p256dh, auth, scope, profile_id: me?.id ?? null,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
    }),
  );
  return { ok: true, scope };
});

/** Turn reminders off for this browser. */
export const DELETE = handle(async (req: Request) => {
  const endpoint = String((await body(req)).endpoint ?? "");
  if (endpoint) must(await db().from("push_subscriptions").delete().eq("endpoint", endpoint));
  return { ok: true };
});
