import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/LinkButton";
import { getDestinationBySlug, getDestinations, getHistory, getTransitRoutes, getVenues } from "@/lib/content";
import { clip } from "@/lib/site";
import { attractionJsonLd } from "@/lib/jsonld";
import { nearest } from "@/lib/nearby";
import { CategoryBadge, EraBadge } from "@/components/site/badges";
import { OpenNowBadge } from "@/components/site/OpenNowBadge";
import { VenueCard } from "@/components/site/VenueCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import { Contours } from "@/components/site/atmosphere";
import {
  ERA_YEARS,
  formatCoord,
  formatElevation,
} from "@/components/site/labels";

export async function generateStaticParams() {
  const destinations = await getDestinations();
  return destinations.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug);
  if (!destination) return { title: "Destination not found" };
  return {
    title: destination.name,
    description: clip(destination.description),
    alternates: { canonical: `/destinations/${destination.slug}` },
  };
}

const NEARBY_COUNT = 3;
const WALKABLE_KM = 0.8;

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug);
  if (!destination) notFound();

  const [history, venues, destinations, routes] = await Promise.all([
    getHistory(),
    getVenues(),
    getDestinations(),
    getTransitRoutes(),
  ]);

  const era = destination.era
    ? history.eras.find((e) => e.key === destination.era) ?? null
    : null;

  const nearby = nearest(destination, venues, NEARBY_COUNT);

  const nearbyPlaces = nearest(destination, destinations.filter((d) => d.slug !== destination.slug), NEARBY_COUNT);

  // The jeepney that stops closest to this place, if one stops within walking distance.
  const ride = routes
    .flatMap((route) => nearest(destination, route.stops, 1).map(({ item: stop, km }) => ({ route, stop, km })))
    .sort((a, b) => a.km - b.km)[0];

  return (
    <div className="relative overflow-hidden">
      <Contours className="absolute -right-40 -top-24 hidden h-[420px] w-[560px] text-contour lg:block" />

      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <Breadcrumbs trail={[{ name: "Destinations", path: "/destinations" }, { name: destination.name, path: `/destinations/${destination.slug}` }]} />
        <JsonLd data={attractionJsonLd(destination)} />

        {/* Header */}
        <header className="mt-6 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={destination.category} />
            {destination.era ? <EraBadge era={destination.era} /> : null}
          </div>
          <h1 className="mt-4 font-display text-4xl text-balance sm:text-5xl">
            {destination.name}
          </h1>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {destination.elevationM != null ? (
              <div><dt className="text-xs text-muted-foreground">Elevation</dt><dd className="readout">{formatElevation(destination.elevationM)}</dd></div>
            ) : null}
            <div><dt className="text-xs text-muted-foreground">Position</dt><dd className="readout">{formatCoord(destination.lng, destination.lat)}</dd></div>
          </dl>
        </header>

        {/* Body */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            <p className="max-w-2xl text-base leading-8 text-foreground/90 text-pretty">
              {destination.description}
            </p>

            {era ? (
              <section className="max-w-2xl border border-accent-foreground/15 bg-accent/60 p-6">
                <h2 className="font-display text-xl">
                  {era.name}
                </h2>
                <p className="readout mt-2 text-accent-foreground">{ERA_YEARS[era.key]}</p>
                <p className="mt-3 text-sm leading-7 text-accent-foreground/90">
                  {era.summary}
                </p>
                <Link
                  href="/history"
                  className="mt-4 inline-block text-sm font-medium text-accent-foreground underline-offset-4 hover:underline"
                >
                  Read the full timeline
                </Link>
              </section>
            ) : null}

            {ride && ride.km <= WALKABLE_KM ? (
              <section className="max-w-2xl border-t border-border pt-6">
                <h2 className="font-display text-xl">Getting here</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {ride.km < 0.05 ? (
                    <>The {ride.route.name} jeepney stops at {ride.stop.name}.</>
                  ) : (
                    <>
                      The {ride.route.name} jeepney stops at {ride.stop.name},{" "}
                      <span className="font-mono text-foreground">{Math.round(ride.km * 1000)} m</span> away.
                    </>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
                  <Link href={`/map?route=${ride.route.code}`} className="text-primary underline-offset-4 hover:underline">Show the route on the map</Link>
                  <Link href="/transit" className="text-primary underline-offset-4 hover:underline">All routes and fares</Link>
                </div>
              </section>
            ) : null}
          </div>

          {/* Fact panel */}
          <aside className="h-fit border border-border bg-card p-6">
            <p className="readout text-muted-foreground">At a glance</p>
            <dl className="mt-4 space-y-4 text-sm">
              {destination.elevationM != null && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Elevation</dt>
                  <dd className="font-mono">{formatElevation(destination.elevationM)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Coordinates</dt>
                <dd className="font-mono text-xs">
                  {formatCoord(destination.lng, destination.lat)}
                </dd>
              </div>
              {destination.era && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Era</dt>
                  <dd>{era?.name ?? destination.era}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Hours</dt>
                <dd>
                  <OpenNowBadge hours={destination.hours} />
                </dd>
              </div>
            </dl>
            <LinkButton href={`/map?dest=${destination.slug}`} className="mt-6 w-full">
              Fly there on the map
            </LinkButton>
            <Link href={`/corrections?page=/destinations/${destination.slug}`} className="mt-4 block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Something wrong here? Suggest a correction
            </Link>
          </aside>
        </div>

        {/* Nearby venues */}
        {nearby.length > 0 && (
          <section className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-2xl">
                Eat & stay nearby
              </h2>
              <p className="readout text-muted-foreground">
                Within {Math.max(0.3, Math.ceil(nearby[nearby.length - 1].km * 10) / 10).toFixed(1)} km
              </p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.map(({ item }) => (
                <VenueCard key={item.slug} venue={item} />
              ))}
            </div>
          </section>
        )}

        {/* Nearby places */}
        <section className="mt-16">
          <h2 className="font-display text-2xl">Nearby places</h2>
          <ul className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-3">
            {nearbyPlaces.map(({ item, km }) => (
              <li key={item.slug} className="bg-card">
                <Link href={`/destinations/${item.slug}`} className="flex h-full items-baseline justify-between gap-4 p-5 hover:bg-secondary">
                  <span className="font-medium">{item.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{km.toFixed(1)} km</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
