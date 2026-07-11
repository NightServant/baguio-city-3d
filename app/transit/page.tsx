import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getTransitRoutes } from "@/lib/content";
import {
  JEEPNEY_BASE_KM,
  TAXI_FLAGDOWN_PHP,
  TAXI_PER_METER_UNIT_M,
  TAXI_PER_UNIT_PHP,
  TAXI_PER_MINUTE_WAIT_PHP,
  taxiFare,
} from "@/lib/geo/fare";
import { SectionHeading } from "@/components/site/SectionHeading";

export const metadata: Metadata = {
  title: "Transit",
  description:
    "Baguio jeepney routes from the City Plaza terminal — stops, fares, and a taxi fare estimator for the City of Pines.",
};

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Worked example for the taxi explainer: Plaza to Mines View is ~3.5 km.
const SAMPLE_KM = 3.5;

export default async function TransitPage() {
  const routes = await getTransitRoutes();
  const sample = taxiFare(SAMPLE_KM);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <SectionHeading
        eyebrow="Getting around"
        title="Jeepney lines & fares"
        lede={`Every line starts at the City Plaza terminal downtown. Base fare covers the first ${JEEPNEY_BASE_KM} km; the meter of the mountains is the barker's call, so round up and pay forward.`}
      />

      {/* Route cards */}
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {routes.map((route) => (
          <article
            key={route.code}
            className="flex flex-col rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded bg-primary px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-primary-foreground">
                {route.code}
              </span>
              <span className="readout text-muted-foreground">
                {peso(route.fareBase)} base · {peso(route.farePerKm)}/km after
              </span>
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold leading-snug tracking-tight">
              {route.name}
            </h2>

            {/* Route-line motif */}
            <ol className="relative mt-5 flex-1 space-y-3 pl-4">
              <span
                className="absolute bottom-2 left-[3px] top-2 w-px bg-primary/30"
                aria-hidden="true"
              />
              {route.stops.map((stop, i) => {
                const terminal = i === 0 || i === route.stops.length - 1;
                return (
                  <li key={stop.seq} className="relative text-sm">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute -left-4 top-1.5 size-[7px] -translate-x-[3px] rounded-full",
                        terminal
                          ? "bg-primary ring-2 ring-primary/25"
                          : "border border-primary/50 bg-card",
                      )}
                    />
                    <span className={terminal ? "font-medium" : "text-muted-foreground"}>
                      {stop.name}
                    </span>
                  </li>
                );
              })}
            </ol>

            <Link
              href={`/map?route=${route.code}`}
              className="mt-6 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View route on map →
            </Link>
          </article>
        ))}
      </div>

      {/* Taxi explainer */}
      <section className="mt-16 overflow-hidden rounded-2xl border border-border bg-secondary/60">
        <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="readout text-primary">Taxi estimate</p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Flagdown {peso(TAXI_FLAGDOWN_PHP)}, then the meter climbs with the road
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              Baguio taxis are metered and famously honest. The estimate here
              mirrors the LTFRB-style structure the map's fare tool uses:
              flagdown plus a distance charge every {TAXI_PER_METER_UNIT_M} m,
              plus waiting time in traffic.
            </p>
            <Link
              href="/map"
              className={cn(buttonVariants(), "mt-6 rounded-full")}
            >
              Estimate a real trip on the map
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="readout text-muted-foreground">
              Worked example · {SAMPLE_KM} km (Plaza → Mines View)
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Flagdown</dt>
                <dd className="font-mono">{peso(TAXI_FLAGDOWN_PHP)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">
                  Distance · {peso(TAXI_PER_UNIT_PHP)} per {TAXI_PER_METER_UNIT_M} m
                </dt>
                <dd className="font-mono">{peso(sample.breakdown.distanceCharge)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">
                  Waiting · {peso(TAXI_PER_MINUTE_WAIT_PHP)}/min ·{" "}
                  {sample.breakdown.estMinutes} min est.
                </dt>
                <dd className="font-mono">{peso(sample.breakdown.waitingCharge)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
                <dt className="font-medium">Estimated fare</dt>
                <dd className="font-mono text-base font-semibold text-primary">
                  {peso(sample.fare)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Estimate only — actual meters vary with traffic and route.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
