import type { CSSProperties } from "react";
import { teamColor } from "./teams";

/** Black or white, whichever reads better on the given hex colour. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // 0.179 is where black and white text have equal contrast.
  return L > 0.179 ? "#0a0a0d" : "#ffffff";
}

/** Style that sets the player accent for everything inside. */
export function accentStyle(teamId: string | null | undefined): CSSProperties {
  if (!teamId) return {};
  const c = teamColor(teamId);
  return { "--accent": c, "--accent-ink": inkOn(c) } as CSSProperties;
}
