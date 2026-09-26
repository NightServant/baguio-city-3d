import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import {
  getDestinations,
  getHistory,
  getTransitRoutes,
  getVenues,
} from "@/lib/content";
import { relief } from "@/lib/relief";
import { FogBank } from "@/components/site/atmosphere";
import { ScrollReveal, ParallaxLayer } from "@/components/site/Motion";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Hero } from "@/components/home/Hero";
import { Proof } from "@/components/home/Proof";
import { Problem } from "@/components/home/Problem";
import { ERA_YEARS, VENUE_CATEGORY_LABELS } from "@/components/site/labels";
import { JsonLd } from "@/components/site/JsonLd";
import { websiteJsonLd } from "@/lib/jsonld";
import type { VenueCategory } from "@/types/venue";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const VENUE_CATEGORY_ORDER: VenueCategory[] = [
  "RESTAURANT",
  "FOOD_SHOP",
  "HOTEL",
  "TRANSIENT",
  "SOUVENIR",
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

  const venueCounts = VENUE_CATEGORY_ORDER.map((cat) => ({
    cat,
    count: venues.filter((v) => v.category === cat).length,
  }));

  return (
    <div>
      <JsonLd data={websiteJsonLd()} />
      <Hero destinations={destinations.length} venues={venues.length} />
      <Proof destinations={destinations.length} venues={venues.length} />
      <Problem
        relief={relief(origin, destinations)}
        originName={origin.name}
        withHours={withHours}
        total={places.length}
      />

      {/* --------------------------------------------------------- History */}
      <section className="relative overflow-hidden border-y border-border bg-secondary/50">
        {/* Three ridge layers at different parallax rates. Distant ridges move
            least, which is how depth actually reads across a valley. */}
        <ParallaxLayer speed={-0.05} className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
          <svg viewBox="0 0 1200 220" className="h-[220px] w-full text-foreground/[0.05]" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 200 L120 120 L260 168 L420 88 L560 150 L700 96 L860 160 L1010 110 L1200 170 V220 H0 Z" fill="currentColor" />
          </svg>
        </ParallaxLayer>
        <ParallaxLayer speed={-0.11} className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
          <svg viewBox="0 0 1200 180" className="h-[180px] w-full text-foreground/[0.07]" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 170 L160 104 L320 150 L480 76 L640 138 L820 92 L980 146 L1200 104 V180 H0 Z" fill="currentColor" />
          </svg>
        </ParallaxLayer>
        <ParallaxLayer speed={-0.19} className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
          <svg viewBox="0 0 1200 140" className="h-[140px] w-full text-foreground/[0.10]" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 130 L140 78 L300 120 L470 60 L620 112 L790 70 L960 118 L1200 82 V140 H0 Z" fill="currentColor" />
          </svg>
        </ParallaxLayer>

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <SectionHeading
              eyebrow="Four eras"
              title="From Ibaloi pasture to Creative City"
              lede="Kafagway's cattle meadows became Burnham's planned hill station, survived the 1945 battle, and rebuilt into today's festival city. Walk the whole story on one timeline."
            />
            <div className="space-y-3">
              {history.eras.map((era, i) => (
                <ScrollReveal key={era.key} delay={((i % 3) + 1) as 1 | 2 | 3}>
                <Link
                  href="/history"
                  className="weave-edge group flex items-baseline justify-between gap-4 border-y border-r border-border bg-card px-5 py-4 transition-colors hover:bg-secondary"
                >
                  <span className="font-display text-lg font-medium tracking-tight group-hover:text-primary">
                    {era.name}
                  </span>
                  <span className="readout text-muted-foreground">
                    {ERA_YEARS[era.key]}
                  </span>
                </Link>
                </ScrollReveal>
              ))}
              <Link
                href="/history"
                className="inline-block pt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open the timeline
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- Transit + Eat */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Transit teaser */}
          <ScrollReveal className="min-w-0">
            <SectionHeading
              eyebrow="Getting around"
              title="Ride the jeepney lines"
              lede={`${routes.length} routes fan out from the City Plaza terminal — ₱13 flat for the first 4 km. Taxis start at ₱45 flagdown.`}
            />
            <ul className="mt-8 space-y-2">
              {routes.map((route) => (
                <li key={route.code}>
                  <Link
                    href={`/map?route=${route.code}`}
                    className="group flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
                  >
                    <span className="rounded bg-primary px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-primary-foreground">
                      {route.code}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {route.name}
                    </span>
                    <span className="readout text-muted-foreground">
                      {route.stops.length} stops
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/transit"
              className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Routes & fares
            </Link>
          </ScrollReveal>

          {/* Eat & Stay teaser */}
          <ScrollReveal delay={1} className="min-w-0">
            <SectionHeading
              eyebrow="Eat & stay"
              title="Ube jam, strawberry cake, pine-side lodges"
              lede="From ₱-a-plate carinderias to the Manor's fireplace lobby — every listing carries hours, price range, and a spot on the map."
            />
            <ul className="mt-8 space-y-2">
              {venueCounts.map(({ cat, count }) => (
                <li key={cat}>
                  <Link
                    href={`/eat-stay?cat=${cat}`}
                    className="group flex items-baseline justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
                  >
                    <span className="text-sm font-medium group-hover:text-primary">
                      {VENUE_CATEGORY_LABELS[cat]}
                    </span>
                    <span className="readout text-muted-foreground">{count} listed</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/eat-stay"
              className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Browse all {venues.length} places
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ----------------------------------------------------- Closing CTA */}
      <section className="relative overflow-hidden border-t-2 border-primary bg-secondary text-foreground dark:bg-card">
        <FogBank className="opacity-40" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            See the city the way the clouds do.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Terrain, landmarks and jeepney routes, all on one map.
          </p>
          <LinkButton
            href="/map"
            size="large"
            endIcon={<ArrowRight className="size-4" />}
            sx={{ mt: 4 }}
          >
            Open the 3D map
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
