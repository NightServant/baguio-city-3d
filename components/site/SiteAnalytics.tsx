"use client";

// Vercel Web Analytics (cookieless, owner 2026-10-20), with private status-page tokens taken out of the URLs it sends.
import { Analytics } from "@vercel/analytics/next";
import { redactUrl } from "@/lib/analytics";

export function SiteAnalytics() {
  return <Analytics beforeSend={(e) => ({ ...e, url: redactUrl(e.url) })} />;
}
