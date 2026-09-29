import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { fareAccuracyNote, formatLongDate } from "@/lib/geo/fare";
import { TERRAIN_EXAGGERATION } from "@/lib/map/sources";
import { DATA_SOURCES, OSM_BUILDINGS } from "@/lib/sources";

export const metadata: Metadata = {
  title: "About",
  description: "How Baguio 3D is built: the open data behind the 3D map, how heights were checked and where fares come from, and how to report a mistake.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Breadcrumbs trail={[{ name: "About", path: "/about" }]} />
      <article className="legal-prose">
        <h1 className="mt-8 font-display text-4xl leading-[1.02] sm:text-5xl">About Baguio 3D</h1>
        <p>
          Baguio sits on ridges and in ravines, and a flat map hides most of that. Baguio 3D puts the city
          on its real terrain, then adds what a visitor needs on top: landmarks, jeepney routes with fares,
          and places to eat and stay with their opening hours.
        </p>

        <h2 id="sources">What it’s made of</h2>
        <ul>
          {DATA_SOURCES.map((s) => (
            <li key={s.name}>
              <a href={s.href}>{s.name}</a>: {s.supplies}.
            </li>
          ))}
        </ul>
        <p>
          OpenStreetMap has {OSM_BUILDINGS.count.toLocaleString("en-PH")} building footprints inside the map
          area, counted on {formatLongDate(OSM_BUILDINGS.countedOn)}.
        </p>

        <h2>How it was checked</h2>
        <p>
          Every destination’s height was re-sampled from the same terrain model the map draws, after the
          original figures turned out to be off by up to 441 m. {fareAccuracyNote()} The terrain is drawn
          {TERRAIN_EXAGGERATION} times taller than life so slopes read on a phone screen. Some place
          descriptions were drafted with AI assistance and edited by hand.
        </p>

        <h2>Found a mistake?</h2>
        <p>
          <Link href="/corrections">Suggest a correction</Link>. Hours and fares change, and reports from
          visitors are how the guide stays right.
        </p>

        <h2>Source code</h2>
        <p>
          The code is public on <a href="https://github.com/NightServant/baguio-city-3d">GitHub</a>.
        </p>
      </article>
    </div>
  );
}
