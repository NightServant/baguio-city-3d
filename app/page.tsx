import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import {
  getDestinations,
  getHistory,
  getTransitRoutes,
  getVenues,
} from "@/lib/content";
import { FogBank, Treeline } from "@/components/site/atmosphere";
import { TerrainCanvas } from "@/components/site/TerrainCanvas";
import { DestinationCarousel } from "@/components/site/DestinationCarousel";
import { ScrollReveal, ParallaxLayer } from "@/components/site/Motion";
import { PineIcon, FogIcon, RouteIcon, ContourIcon } from "@/components/site/AnimatedIcons";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ERA_YEARS, VENUE_CATEGORY_LABELS } from "@/components/site/labels";
import type { VenueCategory } from "@/types/venue";

// Curated landing highlights — the places first-time visitors ask about.
const FEATURED_SLUGS = [
  "burnham-park",
  "mines-view-park",
  "camp-john-hay",
  "session-road",
  "bencab-museum",
  "tam-awan-village",
];

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

  const featured = FEATURED_SLUGS.map((slug) =>
    destinations.find((d) => d.slug === slug),
  ).filter((d) => d != null);

  if (
    process.env.NODE_ENV !== "production" &&
    featured.length !== FEATURED_SLUGS.length
  ) {
    const missing = FEATURED_SLUGS.filter(
      (slug) => !destinations.some((d) => d.slug === slug),
    );
    console.warn(
      `[home] FEATURED_SLUGS references unknown destination slug(s): ${missing.join(", ")}`,
    );
  }

  const venueCounts = VENUE_CATEGORY_ORDER.map((cat) => ({
    cat,
    count: venues.filter((v) => v.category === cat).length,
  }));

  return (
    <div>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-gradient-to-b from-secondary/80 via-background to-background"
          aria-hidden="true"
        />
        {/* Real Baguio relief as a warp/weft grid, sitting in the lower-right
            and masked so it dissolves toward the text rather than colliding
            with it. z-0 keeps it under the content, which is z-10. */}
        <TerrainCanvas
          className="pointer-events-none absolute -right-[12%] -bottom-[14%] z-0 hidden h-[620px] w-[64%] lg:block"
          style={{
            maskImage:
              "radial-gradient(120% 100% at 85% 75%, #000 35%, rgba(0,0,0,0.55) 60%, transparent 85%)",
            WebkitMaskImage:
              "radial-gradient(120% 100% at 85% 75%, #000 35%, rgba(0,0,0,0.55) 60%, transparent 85%)",
          }}
        />
        <FogBank />

        <div className="relative z-10 mx-auto grid max-w-6xl gap-x-10 px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28 lg:grid-cols-[3px_1fr]">
          {/* Warp edge: the weave as structure, running the height of the hero */}
          <div className="weave-edge hidden lg:block" aria-hidden="true" />

          <div>
            {/* Scale from 36px: at 60px the longest word ("dimensions.")
                exceeds a 375px viewport and gets clipped by overflow-hidden. */}
            <h1 className="max-w-[16ch] font-display text-[2.25rem] leading-[0.95] sm:text-6xl sm:leading-[0.9] md:text-7xl lg:text-[5.5rem]">
              The Summer Capital, in three dimensions.
            </h1>

            <p className="mt-8 max-w-[58ch] text-lg leading-8 text-muted-foreground text-pretty">
              Baguio sits a mile up in the Cordilleras — pine forest, fog banks,
              and a century of hill-station history. Fly the terrain, trace the
              jeepney lines, and plan your trip ridge by ridge.
            </p>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ["Latitude", "16.4023° N"],
                ["Longitude", "120.5960° E"],
                ["Elevation", "1,500 m"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="readout mt-1 text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <LinkButton href="/map" size="large">
                Open the 3D map
              </LinkButton>
              <LinkButton href="/destinations" size="large" variant="outlined">
                Browse destinations
              </LinkButton>
            </div>

            {/* Each figure gets the icon of the thing it counts, and each icon
                animates what that thing does. */}
            <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
              {[
                { value: destinations.length, label: "Destinations", Icon: ContourIcon },
                { value: routes.length, label: "Jeepney lines", Icon: RouteIcon },
                { value: venues.length, label: "Places to eat & stay", Icon: PineIcon },
                { value: history.eras.length, label: "Eras", Icon: FogIcon },
              ].map(({ value, label, Icon }) => (
                <div key={label} className="bg-background px-4 py-3">
                  <Icon className="size-5 text-primary" />
                  <dd className="mt-2 font-display text-2xl leading-none">{value}</dd>
                  <dt className="mt-1.5 text-xs text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* The band draws itself across on entry rather than fading in. */}
        <ScrollReveal variant="weave">
          <div className="weave-band" aria-hidden="true" />
        </ScrollReveal>
      </section>

      {/* ------------------------------------------------------ Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Field guide"
            title="Start with the essentials"
            lede="Six places that explain the city — Burnham's park, the ridge-top viewpoints, and the pine estates the Americans left behind."
          />
          <Link
            href="/destinations"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            All {destinations.length} destinations
          </Link>
        </div>
        {/* Coverflow: slides rake back like ridgelines receding into haze. */}
        <ScrollReveal className="mt-10" delay={1}>
          <DestinationCarousel destinations={featured} />
        </ScrollReveal>
      </section>

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
          <ScrollReveal>
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
          <ScrollReveal delay={1}>
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
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <FogBank className="opacity-40" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            See the city the way the clouds do.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-primary-foreground/80">
            Terrain, landmarks, and live routes — the whole plateau in one view.
          </p>
          <LinkButton
            href="/map"
            size="large"
            endIcon={<ArrowRight className="size-4" />}
            sx={{ mt: 4, bgcolor: "background.default", color: "text.primary",
                  "&:hover": { bgcolor: "#E8DFD0" } }}
          >
            Open the 3D map
          </LinkButton>
        </div>
        <Treeline className="relative text-primary-foreground/20" />
      </section>
    </div>
  );
}
