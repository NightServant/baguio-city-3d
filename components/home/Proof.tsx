import { FARE_SOURCE, fareAccuracyNote, formatLongDate } from "@/lib/geo/fare";
import { OSM_BUILDINGS } from "@/lib/sources";
import { TERRAIN_EXAGGERATION } from "@/lib/map/sources";

const n = (x: number) => x.toLocaleString("en-PH");

export function Proof({ destinations, venues }: { destinations: number; venues: number }) {
  const rows = [
    {
      layer: "Terrain",
      source: { name: "AWS Terrain Tiles (Mapzen, Tilezen)", href: "https://registry.opendata.aws/terrain-tiles/" },
      measured: <>Drawn {TERRAIN_EXAGGERATION}× taller than life, so slopes read on a phone.</>,
    },
    {
      layer: "Streets and buildings",
      source: { name: "OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
      measured: (
        <>
          <span className="font-mono text-foreground">{n(OSM_BUILDINGS.count)}</span> building footprints in the
          map area, counted {formatLongDate(OSM_BUILDINGS.countedOn)}.
        </>
      ),
    },
    {
      layer: "Places",
      source: { name: "Curated for this guide", href: "/about#sources" },
      // R-T23c: venues have no heights, so this can only claim landmarks.
      // Kept on one JSX line: a multi-line JSX text node containing an HTML
      // entity (this one has &apos;) loses its leading space under this
      // repo's Next 16 (SWC) build, even though the same text on one line
      // doesn't.
      measured: <>{destinations} landmarks and {venues} places to eat and stay, every landmark&apos;s height re-checked against the terrain.</>,
    },
    {
      layer: "Fares",
      // R-T23: no public URL for the modern guide, so the source links to
      // the transit page instead of FARE_SOURCE.jeepney.url (which is gone).
      source: { name: FARE_SOURCE.modern.label, href: "/transit" },
      // R-T23d: reuse the shared note (also used on /terms) instead of
      // re-deriving which fares are unverified here — that reimplementation
      // both hid the guide's now-passed expiry date and got the unverified
      // sentence's capitalization wrong when only taxi was unchecked.
      measured: fareAccuracyNote(),
    },
  ];

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-display text-3xl leading-[1.05] sm:text-4xl">What the map is made of</h2>
        <p className="mt-3 max-w-[60ch] text-muted-foreground">
          Where each layer comes from, and the numbers we measured from it.
        </p>
        <dl className="mt-10 border-t border-border">
          {rows.map((r) => (
            <div key={r.layer} className="grid gap-1 border-b border-border py-5 md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-8">
              <dt className="font-medium">{r.layer}</dt>
              <dd>
                <a href={r.source.href} className="text-primary underline-offset-4 hover:underline">{r.source.name}</a>
              </dd>
              <dd className="text-muted-foreground">{r.measured}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
