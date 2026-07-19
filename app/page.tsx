import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  getDestinations,
  getHistory,
  getTransitRoutes,
  getVenues,
} from "@/lib/content";
import { Contours, FogBank, Treeline } from "@/components/site/atmosphere";
import { SectionHeading } from "@/components/site/SectionHeading";
import { DestinationCard } from "@/components/site/DestinationCard";
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
        <Contours className="absolute -right-24 top-1/2 hidden h-[560px] w-[760px] -translate-y-1/2 text-contour md:block" />
        <FogBank />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28">
          <p className="font-mono text-[0.6875rem] uppercase tracking-wider tabular-nums text-primary">
            16.4023° N · 120.5960° E · 1,500 m above the lowland heat
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl md:text-7xl">
            The Summer Capital, in three dimensions.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground text-pretty">
            Baguio sits a mile up in the Cordilleras — pine forest, fog banks,
            and a century of hill-station history. Fly the terrain, trace the
            jeepney lines, and plan your trip ridge by ridge.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/map"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 rounded-full px-6 text-base",
              )}
            >
              Open the 3D map
              <ArrowRight data-icon="inline-end" />
            </Link>
            <Link
              href="/destinations"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-full px-6 text-base",
              )}
            >
              Browse destinations
            </Link>
          </div>
          <p className="mt-12 font-mono text-[0.6875rem] uppercase tracking-wider tabular-nums text-muted-foreground">
            {destinations.length} destinations · {routes.length} jeepney lines ·{" "}
            {venues.length} places to eat & stay · {history.eras.length} eras
          </p>
        </div>
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
            All {destinations.length} destinations →
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Zig-zag: lead card spans left in row one, closing card spans right
              in row three, so six cards fill the 3-col grid without an orphan. */}
          {featured.map((d, i) => (
            <DestinationCard
              key={d.slug}
              destination={d}
              featured={i === 0 || i === featured.length - 1}
              className={
                i === featured.length - 1 ? "lg:col-start-2" : undefined
              }
            />
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- History */}
      <section className="relative overflow-hidden border-y border-border bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <SectionHeading
              eyebrow="Four eras"
              title="From Ibaloi pasture to Creative City"
              lede="Kafagway's cattle meadows became Burnham's planned hill station, survived the 1945 battle, and rebuilt into today's festival city. Walk the whole story on one timeline."
            />
            <div className="space-y-3">
              {history.eras.map((era) => (
                <Link
                  key={era.key}
                  href="/history"
                  className="group flex items-baseline justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40"
                >
                  <span className="font-display text-lg font-medium tracking-tight group-hover:text-primary">
                    {era.name}
                  </span>
                  <span className="readout text-muted-foreground">
                    {ERA_YEARS[era.key]}
                  </span>
                </Link>
              ))}
              <Link
                href="/history"
                className="inline-block pt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open the timeline →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- Transit + Eat */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Transit teaser */}
          <div>
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
              Routes & fares →
            </Link>
          </div>

          {/* Eat & Stay teaser */}
          <div>
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
              Browse all {venues.length} places →
            </Link>
          </div>
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
          <Link
            href="/map"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "mt-8 h-11 rounded-full px-6 text-base",
            )}
          >
            Open the 3D map
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
        <Treeline className="relative text-primary-foreground/20" />
      </section>
    </div>
  );
}
