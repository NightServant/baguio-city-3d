import type { Metadata } from "next";
import Link from "next/link";
import { getHistory } from "@/lib/content";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Treeline } from "@/components/site/atmosphere";

export const metadata: Metadata = {
  title: "History",
  description:
    "Four eras of Baguio — Ibaloi Kafagway, the American hill station, wartime ruin and rebuilding, and the contemporary Creative City — on one timeline.",
};

function eraYears(startYear: number, endYear: number | null): string {
  if (endYear === null) return `${startYear} — today`;
  // Pre-colonial "1500" reads better as "before 1900".
  if (startYear <= 1500) return `before ${endYear + 1}`;
  return `${startYear} — ${endYear}`;
}

export default async function HistoryPage() {
  const { eras, events } = await getHistory();

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading
          as="h1"
          eyebrow="The exhibit"
          title="Four eras of the City of Pines"
          lede="From Ibaloi cattle pasture to UNESCO Creative City in a little over a century. Events with a place on the mountain link straight to the 3D map."
        />

        <ol className="mt-14 space-y-16">
          {eras.map((era, i) => {
            const eraEvents = events
              .filter((e) => e.era === era.key)
              .sort((a, b) => a.year - b.year);
            return (
              <li key={era.key}>
                {/* Era header */}
                <header className="border-b border-border pb-6">
                  <p className="readout text-primary">
                    Era {String(i + 1).padStart(2, "0")} · {eraYears(era.startYear, era.endYear)}
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    {era.name}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground text-pretty">
                    {era.summary}
                  </p>
                </header>

                {/* Events on the rule */}
                {eraEvents.length > 0 && (
                  <ol className="mt-8 space-y-8 border-l border-border pl-6 sm:pl-8">
                    {eraEvents.map((event) => (
                      <li key={`${event.year}-${event.title}`} className="relative">
                        <span
                          className="absolute -left-6 top-1.5 size-2.5 -translate-x-1/2 rounded-full border-2 border-background bg-primary sm:-left-8"
                          aria-hidden="true"
                        />
                        <p className="font-mono text-sm font-semibold text-primary">
                          {event.year}
                        </p>
                        <h3 className="mt-1 font-display text-lg font-medium tracking-tight">
                          {event.title}
                        </h3>
                        <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                          {event.description}
                        </p>
                        {event.coord && (
                          <Link
                            href={`/map?focus=${event.coord[0]},${event.coord[1]}`}
                            className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                          >
                            View on map →
                          </Link>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <Treeline className="text-primary/25" />
    </div>
  );
}
