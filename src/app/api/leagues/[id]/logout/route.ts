import { forgetDevice } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

/** Forget this device (profile stays; reclaim with nickname + PIN). */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/leagues/[id]/logout">) => {
  const { id } = await ctx.params;
  await forgetDevice(id);
  return { ok: true };
});
