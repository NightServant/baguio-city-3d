import Image from "next/image";
import Link from "next/link";
import { ScrollReveal } from "@/components/site/Motion";

export function Hero({ destinations, venues }: { destinations: number; venues: number }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14 lg:pb-20">
        <div className="min-w-0">
          <h1 className="font-display text-[2.5rem] leading-[0.95] text-balance sm:text-6xl lg:text-[4.25rem]">
            Baguio City, mapped in 3D.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-8 text-muted-foreground text-pretty">
            Tilt the terrain to see how steep the walk is. Find {destinations} places worth the climb,
            the jeepney that gets you there, and {venues} places to eat and stay. Free, no account.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="#how-it-works" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              See how it works
            </Link>
          </div>
        </div>
        <div className="min-w-0">
          <div className="weave-edge border-y border-r border-border">
            <Image
              src="/home/hero-map.jpg"
              alt=""
              width={1600}
              height={943}
              preload
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="h-auto w-full"
            />
          </div>
          {/* R-T23b: the poster is a still of OSM/OpenFreeMap/terrain data, so it
              carries the same credit MapDemo's caption uses. */}
          <p className="mt-2 text-xs text-muted-foreground">
            Map data © OpenStreetMap contributors, OpenFreeMap. Terrain: Mapzen / Tilezen, AWS Open Data.
          </p>
        </div>
      </div>
      {/* The page's one orchestrated moment: the band draws itself across. */}
      <ScrollReveal variant="weave">
        <div className="weave-band" aria-hidden="true" />
      </ScrollReveal>
    </section>
  );
}
