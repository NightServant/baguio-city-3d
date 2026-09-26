import type { Relief } from "@/lib/relief";
import { LazyTerrain } from "./LazyTerrain";

export function Problem({
  relief,
  originName,
  withHours,
  total,
}: {
  relief: Relief;
  originName: string;
  withHours: number;
  total: number;
}) {
  const m = (x: number) => <span className="font-mono text-foreground">{x.toLocaleString("en-PH")} m</span>;
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="max-w-[18ch] font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
          A flat map hides the hills.
        </h2>

        <figure className="mt-8">
          {/* The edges fade so the grid reads as a landscape, not a box. */}
          <LazyTerrain className="h-[280px] w-full [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)] sm:h-[440px]" />
          <figcaption className="mt-3 max-w-[60ch] text-sm text-muted-foreground">
            The real ground under the map area, heights exaggerated, drawn from the terrain model the 3D map uses.
          </figcaption>
          {/* A plain table sized by its content, inside a div that carries the
              sr-only clipping: a table itself ignores a too-small explicit
              width in auto layout (its min-content width wins), which is what
              pushed a wide, position:absolute box into the page's scrollable
              area before. The wrapping div's own width:1px + overflow:hidden
              isn't subject to that quirk, so it clips the table regardless of
              how wide any future row's content gets. */}
          <div className="sr-only">
            <table>
              <caption>Height of each landmark in the guide</caption>
              <thead>
                <tr><th>Place</th><th>Straight-line distance from {originName}</th><th>Height above sea level</th></tr>
              </thead>
              <tbody>
                {relief.points.map((p) => (
                  <tr key={p.slug}><td>{p.name}</td><td>{p.km.toFixed(1)} km</td><td>{p.elevationM} m</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>

        <div className="mt-12 grid gap-10 md:grid-cols-3">
          <p className="leading-7 text-muted-foreground">
            <span className="font-medium text-foreground">The climbs are real.</span> {relief.lowest.name} sits{" "}
            {m(relief.spanM)} below {relief.highest.name}. Between ridges the road switches back and the
            shortcut is a stairway, and a flat map hides the climb.
          </p>
          <p className="leading-7 text-muted-foreground">
            <span className="font-medium text-foreground">The cheapest ride takes local knowledge.</span>{" "}
            Jeepneys are the cheapest way around, if you know which one to board.
          </p>
          <p className="leading-7 text-muted-foreground">
            <span className="font-medium text-foreground">Hours move.</span> {withHours} of {total} places in this
            guide post opening hours, and they can change. A closed gate is a long walk back uphill.
          </p>
        </div>
      </div>
    </section>
  );
}
