import type { MetadataRoute } from "next";
import { getDestinations } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

const PAGES = ["/", "/map", "/destinations", "/eat-stay", "/transit", "/history", "/about", "/corrections", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const destinations = await getDestinations();
  return [
    ...PAGES.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` })),
    ...destinations.map((d) => ({ url: `${SITE_URL}/destinations/${d.slug}` })),
  ];
}
