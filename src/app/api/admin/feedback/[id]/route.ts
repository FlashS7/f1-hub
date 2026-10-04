import { db, must } from "@/lib/server/db";
import { body, handle, requireProfile } from "@/lib/server/http";
import { UserError } from "@/lib/server/league";

async function admin() {
  const me = await requireProfile();
  if (!me.is_admin) throw new UserError("Admins only", 403);
}

/** Mark as done / new. */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/admin/feedback/[id]">) => {
  await admin();
  const { id } = await ctx.params;
  const status = (await body(req)).status === "done" ? "done" : "new";
  must(await db().from("feedback").update({ status }).eq("id", id));
  return { ok: true };
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/admin/feedback/[id]">) => {
  await admin();
  const { id } = await ctx.params;
  must(await db().from("feedback").delete().eq("id", id));
  return { ok: true };
});
