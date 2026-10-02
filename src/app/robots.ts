import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Public pages are indexable; private league pages and the API are not.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/league/", "/join/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
