import type { Metadata } from "next";
import {
  getDestinations,
  getHistory,
  getTransitRoutes,
  getVenues,
} from "@/lib/content";
import { relief } from "@/lib/relief";
import { Hero } from "@/components/home/Hero";
import { Proof } from "@/components/home/Proof";
import { Problem } from "@/components/home/Problem";
import { Solution } from "@/components/home/Solution";
import { Faq } from "@/components/home/Faq";
import { ClosingCta } from "@/components/home/ClosingCta";
import { JsonLd } from "@/components/site/JsonLd";
import { websiteJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const FEATURED_SLUGS = [
  "burnham-park",
  "mines-view-park",
  "camp-john-hay",
  "session-road",
  "bencab-museum",
  "tam-awan-village",
];

export default async function Home() {
  const [destinations, venues, history, routes] = await Promise.all([
    getDestinations(),
    getVenues(),
    getHistory(),
    getTransitRoutes(),
  ]);

  const origin = destinations.find((d) => d.slug === "burnham-park") ?? destinations[0];
  const places = [...destinations, ...venues];
  const withHours = places.filter((p) => p.hours != null).length;

  const featured = FEATURED_SLUGS.map((slug) => destinations.find((d) => d.slug === slug)).filter(
    (d) => d != null,
  );

  return (
    <div>
      <JsonLd data={websiteJsonLd()} />
      <Hero destinations={destinations.length} venues={venues.length} />
      <Proof destinations={destinations.length} venues={venues.length} />
      {/* relief() throws on no-height input, and origin can be undefined on
          an empty destinations table — guard both so bad data quietly skips
          the section instead of 500ing the whole homepage. */}
      {origin && destinations.some((d) => d.elevationM != null) && (
        <Problem
          relief={relief(origin, destinations)}
          originName={origin.name}
          withHours={withHours}
          total={places.length}
        />
      )}

      <Solution featured={featured} routes={routes} venues={venues} eras={history.eras.length} />

      <Faq />
      <ClosingCta />
    </div>
  );
}
