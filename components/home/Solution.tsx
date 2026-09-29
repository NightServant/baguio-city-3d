import Link from "next/link";
import type { Destination, TransitRouteContent, Venue } from "@/lib/content";
import { ContourIcon, RouteIcon } from "@/components/site/AnimatedIcons";
import { OpenNowBadge } from "@/components/site/OpenNowBadge";
import { PriceGlyphs } from "@/components/site/badges";
import { TerrainTour } from "./TerrainTour";

const more = "text-sm font-medium text-primary underline-offset-4 hover:underline";

export function Solution({
  featured,
  routes,
  venues,
  eras,
}: {
  featured: Destination[];
  routes: TransitRouteContent[];
  venues: Venue[];
  eras: number;
}) {
  const sample = venues.filter((v) => v.hours != null).slice(0, 4);
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="max-w-[20ch] font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
          One map for the climb, the ride and the table.
        </h2>

        {/* Terrain: the live product, steered by the carousel */}
        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0">
            <ContourIcon className="size-6 text-primary" />
            <h3 className="mt-3 font-display text-2xl">Fly the terrain</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Every landmark sits on real ground heights. Pick a place and the map flies you over the ridges to it,
              before you walk it.
            </p>
            <Link href="/map" className={`mt-4 inline-block ${more}`}>Open the full map</Link>
          </div>
          {featured.length > 0 ? <TerrainTour destinations={featured} /> : null}
        </div>

        {/* Jeepneys */}
        <div className="mt-16 grid gap-8 border-t border-border pt-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0">
            <RouteIcon className="size-6 text-primary" />
            <h3 className="mt-3 font-display text-2xl">Board the right jeepney</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              {routes.length} routes from the City Plaza, each with its stops and fares.
            </p>
            <Link href="/transit" className={`mt-4 inline-block ${more}`}>Routes and fares</Link>
          </div>
          <ul className="min-w-0 border-t border-border">
            {routes.slice(0, 4).map((r) => (
              <li key={r.code}>
                <Link
                  href={`/map?route=${r.code}`}
                  className="block truncate border-b border-border py-4 font-medium hover:bg-secondary"
                >
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Hours */}
        <div className="mt-16 grid gap-8 border-t border-border pt-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0">
            <h3 className="font-display text-2xl">Know what’s open</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Listings with posted hours show them, and whether the place is open right now, in Baguio time.
            </p>
            <Link href="/eat-stay" className={`mt-4 inline-block ${more}`}>Places to eat and stay</Link>
          </div>
          <ul className="min-w-0 border-t border-border">
            {sample.map((v) => (
              <li key={v.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-4">
                <span className="min-w-0 font-medium">{v.name}</span>
                <span className="flex items-center gap-4">
                  <PriceGlyphs priceRange={v.priceRange} />
                  <OpenNowBadge hours={v.hours} />
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* History, which left the nav (ruling R3) */}
        <div className="mt-16 border-t border-border pt-12 lg:max-w-[36rem]">
          <h3 className="font-display text-2xl">Read the city’s past</h3>
          <p className="mt-3 leading-7 text-muted-foreground">
            {eras} eras, from Ibaloi pasture to today, pinned to the places they happened.
          </p>
          <Link href="/history" className={`mt-4 inline-block ${more}`}>Open the timeline</Link>
        </div>
      </div>
    </section>
  );
}
