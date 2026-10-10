import { revalidatePath } from "next/cache";
import { clearOverrideCache } from "@/lib/f1";
import { db, must } from "@/lib/server/db";
import { body, handle, requireProfile } from "@/lib/server/http";
import { UserError } from "@/lib/server/league";

const KEYS = ["FP1", "FP2", "FP3", "SQ", "SPRINT", "QUALI", "RACE"];

/** Admin: move a session's start (delay), or reset it with start = null. */
export const PATCH = handle(async (req: Request) => {
  const me = await requireProfile();
  if (!me.is_admin) throw new UserError("Admins only", 403);
  const b = await body(req);
  const season = Number(b.season);
  const round = Number(b.round);
  const key = String(b.key);
  if (!Number.isInteger(season) || !Number.isInteger(round) || !KEYS.includes(key)) throw new UserError("Bad session");

  if (b.start === null) {
    must(await db().from("session_overrides").delete().eq("season", season).eq("round", round).eq("session_key", key));
  } else {
    const start = new Date(String(b.start));
    if (Number.isNaN(start.getTime())) throw new UserError("Bad start time");
    must(
      await db().from("session_overrides").upsert({
        season, round, session_key: key, start: start.toISOString(), updated_at: new Date().toISOString(),
      }),
    );
  }
  clearOverrideCache();
  revalidatePath("/"); // hub is cached for 5 minutes; show the new time now
  return { ok: true };
});
