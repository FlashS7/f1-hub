"use client";

import { Analytics } from "@vercel/analytics/next";

/** Vercel Web Analytics (cookieless). League ids and invite codes are stripped so pages group together. */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        url.pathname = url.pathname
          .replace(/^\/join\/[^/]+/, "/join/[code]")
          .replace(/^\/league\/[0-9a-f-]{36}/, "/league/[id]")
          .replace(/\/player\/[0-9a-f-]{36}/, "/player/[id]");
        return { ...event, url: url.toString() };
      }}
    />
  );
}
