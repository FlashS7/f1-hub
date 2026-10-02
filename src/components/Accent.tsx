import type { ReactNode } from "react";
import { accentStyle } from "@/lib/accent";
import { currentProfile } from "@/lib/server/auth";
import { dbConfigured } from "@/lib/server/db";

/** Paints everything inside with the logged-in player's team colour. */
export async function Accent({ children }: { children: ReactNode }) {
  const me = dbConfigured() ? await currentProfile().catch(() => null) : null;
  return <div style={accentStyle(me?.team_id)}>{children}</div>;
}
