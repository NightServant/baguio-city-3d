// schema.org data for search engines. LocalBusiness is deliberately absent:
// Baguio 3D is a guide, not a business with premises.
import { SITE_NAME, SITE_URL } from "@/lib/site";

/** JSON for a <script type="application/ld+json">, with "<" escaped (Next JSON-LD guide). */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function websiteJsonLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL };
}

export function attractionJsonLd(d: {
  name: string;
  description: string;
  slug: string;
  lng: number;
  lat: number;
  elevationM: number | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: d.name,
    description: d.description,
    url: `${SITE_URL}/destinations/${d.slug}`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: d.lat,
      longitude: d.lng,
      ...(d.elevationM != null && { elevation: d.elevationM }),
    },
    containedInPlace: { "@type": "City", name: "Baguio", address: { "@type": "PostalAddress", addressCountry: "PH" } },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path === "/" ? "" : it.path}`,
    })),
  };
}
