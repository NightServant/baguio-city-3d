import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getDestinationBySlug, getDestinations, getHistory, getVenues } from "@/lib/content";
import { haversineKm } from "@/lib/geo/fare";
import { CategoryBadge, EraBadge } from "@/components/site/badges";
import { OpenNowBadge } from "@/components/site/OpenNowBadge";
import { VenueCard } from "@/components/site/VenueCard";
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
    description: destination.description.slice(0, 160),
  };
}

const NEARBY_COUNT = 3;

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug);
  if (!destination) notFound();

  const [history, venues] = await Promise.all([getHistory(), getVenues()]);

  const era = destination.era
    ? history.eras.find((e) => e.key === destination.era) ?? null
    : null;

  const nearby = venues
    .map((v) => ({
      venue: v,
      km: haversineKm([destination.lng, destination.lat], [v.lng, v.lat]),
    }))
    .sort((a, b) => a.km - b.km)
    .slice(0, NEARBY_COUNT);

  return (
    <div className="relative overflow-hidden">
      <Contours className="absolute -right-40 -top-24 hidden h-[420px] w-[560px] text-contour lg:block" />

      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/destinations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All destinations
        </Link>

        {/* Header */}
        <header className="mt-6 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={destination.category} />
            {destination.era ? <EraBadge era={destination.era} /> : null}
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {destination.name}
          </h1>
          <p className="readout mt-4 text-muted-foreground">
            {destination.elevationM != null
              ? `ELEV ${formatElevation(destination.elevationM)} · `
              : ""}
            {formatCoord(destination.lng, destination.lat)}
          </p>
        </header>

        {/* Body */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            <p className="max-w-2xl text-base leading-8 text-foreground/90 text-pretty">
              {destination.description}
            </p>

            {era ? (
              <section className="max-w-2xl rounded-xl border border-accent-foreground/15 bg-accent/60 p-6">
                <p className="readout text-accent-foreground">
                  In its era · {ERA_YEARS[era.key]}
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">
                  {era.name}
                </h2>
                <p className="mt-3 text-sm leading-7 text-accent-foreground/90">
                  {era.summary}
                </p>
                <Link
                  href="/history"
                  className="mt-4 inline-block text-sm font-medium text-accent-foreground underline-offset-4 hover:underline"
                >
                  Read the full timeline →
                </Link>
              </section>
            ) : null}
          </div>

          {/* Fact panel */}
          <aside className="h-fit rounded-xl border border-border bg-card p-6">
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
            <Link
              href={`/map?dest=${destination.slug}`}
              className={cn(buttonVariants(), "mt-6 w-full rounded-full")}
            >
              Fly there on the map
              <ArrowRight data-icon="inline-end" />
            </Link>
          </aside>
        </div>

        {/* Nearby venues */}
        {nearby.length > 0 && (
          <section className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Eat & stay nearby
              </h2>
              <p className="readout text-muted-foreground">
                Within {Math.max(0.3, Math.ceil(nearby[nearby.length - 1].km * 10) / 10).toFixed(1)} km
              </p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.map(({ venue }) => (
                <VenueCard key={venue.slug} venue={venue} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
