import { createHash } from "node:crypto";
import { clientIp, currentProfile } from "@/lib/server/auth";
import { db, must } from "@/lib/server/db";
import { body, handle } from "@/lib/server/http";
import { UserError } from "@/lib/server/league";

const LIMIT = { perHour: 5 };

/** Ideas and bug reports. Anyone can send one; rate limited per IP; a hidden field catches bots. */
export const POST = handle(async (req: Request) => {
  const b = await body(req);
  // Honeypot: real people never see or fill this field. Pretend success so bots don't retry.
  if (String(b.website ?? "").trim()) return { ok: true };

  const kind = b.kind === "bug" ? "bug" : b.kind === "idea" ? "idea" : null;
  if (!kind) throw new UserError("Choose idea or bug");
  const message = String(b.message ?? "").trim();
  if (message.length < 3 || message.length > 2000) throw new UserError("Message must be 3–2000 characters");
  const contact = String(b.contact ?? "").trim().slice(0, 200) || null;
  const page = String(b.page ?? "").slice(0, 300) || null;

  // Store only a salted hash of the IP, enough for rate limiting.
  const ipHash = createHash("sha256").update(`${process.env.CRON_SECRET ?? ""}:${clientIp(req)}`).digest("hex");
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db().from("feedback").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= LIMIT.perHour) throw new UserError("Thanks! That's plenty for now, try again in an hour.", 429);

  const me = await currentProfile();
  must(
    await db().from("feedback").insert({
      kind, message, contact, page, ip_hash: ipHash, profile_id: me?.id ?? null,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
    }),
  );
  return { ok: true };
});
