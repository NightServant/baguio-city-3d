import type { Metadata } from "next";
import Link from "next/link";
import { getHistory } from "@/lib/content";
import { SectionHeading } from "@/components/site/SectionHeading";

export const metadata: Metadata = {
  title: "History",
  description:
    "Four eras of Baguio, from Ibaloi Kafagway through the American hill station, wartime ruin and rebuilding, to the contemporary Creative City.",
  alternates: { canonical: "/history" },
};

function eraYears(startYear: number, endYear: number | null): string {
  if (endYear === null) return `${startYear} to today`;
  // Pre-colonial "1500" reads better as "before 1900".
  if (startYear <= 1500) return `before ${endYear + 1}`;
  return `${startYear} to ${endYear}`;
}

export default async function HistoryPage() {
  const { eras, events } = await getHistory();

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading
          as="h1"
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
                    Era {i + 1}, {eraYears(era.startYear, era.endYear)}
                  </p>
                  <h2 className="mt-3 font-display text-3xl sm:text-4xl">
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
                        <h3 className="mt-1 font-display text-lg">
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
                            View on map
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
    </div>
  );
}
