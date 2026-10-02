import { db, must } from "@/lib/server/db";
import { body, handle, requireProfile } from "@/lib/server/http";
import { UserError, cleanNickname, getProfile, isUniqueViolation } from "@/lib/server/league";

/** Moderation: admin only, enforced here. */
async function admin() {
  const me = await requireProfile();
  if (!me.is_admin) throw new UserError("Admins only", 403);
  return me;
}

/** Rename a player (e.g. an offensive nickname). */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/admin/profiles/[pid]">) => {
  await admin();
  const { pid } = await ctx.params;
  if (!(await getProfile(pid))) throw new UserError("Player not found", 404);
  const nickname = cleanNickname((await body(req)).nickname);
  const res = await db().from("profiles").update({ nickname }).eq("id", pid);
  if (res.error) {
    if (isUniqueViolation(res.error.message)) throw new UserError("That nickname is taken", 409);
    throw new Error(res.error.message);
  }
  return { ok: true };
});

/** Remove a player completely (profile, picks, memberships). */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/admin/profiles/[pid]">) => {
  const me = await admin();
  const { pid } = await ctx.params;
  if (pid === me.id) throw new UserError("You can't remove yourself", 400);
  must(await db().from("profiles").delete().eq("id", pid));
  return { ok: true };
});
