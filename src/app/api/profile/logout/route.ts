import { forgetDevice } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

/** Forget this device (profile stays; log back in with nickname + PIN). */
export const POST = handle(async () => {
  await forgetDevice();
  return { ok: true };
});
