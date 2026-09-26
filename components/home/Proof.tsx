import { FARE_SOURCE, formatLongDate } from "@/lib/geo/fare";
import { OSM_BUILDINGS } from "@/lib/sources";
import { TERRAIN_EXAGGERATION } from "@/lib/map/sources";

const n = (x: number) => x.toLocaleString("en-PH");

// R-T23: FARE_SOURCE.jeepney/.checkedOn don't exist any more. Only `modern`
// is verified, so the row's measured text is built from the verified flags
// rather than assuming a single "checked on" date applies to every fare.
const uncheckedFares = [
  !FARE_SOURCE.traditional.verified && "Traditional jeepney",
  !FARE_SOURCE.taxi.verified && "taxi",
].filter((name): name is string => Boolean(name));

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
      // Kept on one JSX line: a JSXText node that wraps to a new line right
      // after a `{expr}` loses its leading space under this repo's Next 16
      // (SWC) build, even though the same text on one line doesn't.
      measured: <>{destinations} landmarks and {venues} places to eat and stay, every landmark&apos;s height re-checked against the terrain.</>,
    },
    {
      layer: "Fares",
      // R-T23: no public URL for the modern guide, so the source links to
      // the transit page instead of FARE_SOURCE.jeepney.url (which is gone).
      source: { name: FARE_SOURCE.modern.label, href: "/transit" },
      measured: (
        <>
          Modern jeepney fare from the guide effective {formatLongDate(FARE_SOURCE.modern.effective)}.
          {uncheckedFares.length > 0 && <> {uncheckedFares.join(" and ")} fares not yet checked.</>}
        </>
      ),
    },
  ];

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-display text-3xl leading-[1.05] sm:text-4xl">What the map is made of</h2>
        <p className="mt-3 max-w-[60ch] text-muted-foreground">
          Open data you can check, and the numbers we measured from it.
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
