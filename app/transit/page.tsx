import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/LinkButton";
import { getTransitRoutes } from "@/lib/content";
import {
  FARE_SOURCE,
  JEEPNEY_BASE_KM,
  MODERN_JEEPNEY_BASE_PHP,
  MODERN_JEEPNEY_PER_KM_PHP,
  TAXI_FLAGDOWN_PHP,
  TAXI_PER_METER_UNIT_M,
  TAXI_PER_UNIT_PHP,
  TAXI_PER_MINUTE_WAIT_PHP,
  formatLongDate,
  taxiFare, modernGuideLapsed } from "@/lib/geo/fare";
import { SectionHeading } from "@/components/site/SectionHeading";

export const metadata: Metadata = {
  title: "Jeepney routes and fares",
  description:
    "Baguio jeepney routes from the City Plaza terminal: stops, fares and a taxi fare estimator for getting around the City of Pines.",
  alternates: { canonical: "/transit" },
};

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Worked example for the taxi explainer: Plaza to Mines View is ~3.5 km.
const SAMPLE_KM = 3.5;

export default async function TransitPage() {
  const routes = await getTransitRoutes();
  const sample = taxiFare(SAMPLE_KM);
  // The six routes all currently share the same traditional rate; read it
  // from the data rather than duplicating the figure as a literal.
  const traditionalBase = routes[0]?.fareBase ?? 13;
  const traditionalPerKm = routes[0]?.farePerKm ?? 1.8;

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <SectionHeading
        as="h1"
        title="Jeepney lines & fares"
        lede={`Every line starts at the City Plaza terminal downtown. Base fare covers the first ${JEEPNEY_BASE_KM} km; the meter of the mountains is the barker's call, so round up and pay forward.`}
      />
      <p className="mt-4 text-sm text-muted-foreground">
        Traditional jeepney: {peso(traditionalBase)} for the first {JEEPNEY_BASE_KM} km, then{" "}
        {peso(traditionalPerKm)} per km
        {FARE_SOURCE.traditional.verified
          ? ""
          : ", not yet checked against a current LTFRB issuance"}
        .
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Modern jeepney: {peso(MODERN_JEEPNEY_BASE_PHP)} for the first {JEEPNEY_BASE_KM} km, then{" "}
        {peso(MODERN_JEEPNEY_PER_KM_PHP)} per km
        {FARE_SOURCE.modern.verified
          ? `, per the ${FARE_SOURCE.modern.label} effective ${formatLongDate(FARE_SOURCE.modern.effective)}`
          : ", not yet checked against a current LTFRB issuance"}
        .
      </p>
      {FARE_SOURCE.modern.verified && (
        <p className="mt-2 text-sm text-muted-foreground">
          That guide was issued as valid until {formatLongDate(FARE_SOURCE.modern.validUntil)}
          {modernGuideLapsed() ? ", a date that has passed," : ","} so confirm the fare with the driver.
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        Lines follow the roads between stops; the jeepney’s exact path can differ.
      </p>

      {/* Route cards */}
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {routes.map((route) => (
          <article
            key={route.code}
            className="flex flex-col border border-border bg-card p-6"
          >
            <h2 className="font-display text-lg leading-snug">
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
              View route on map
            </Link>
          </article>
        ))}
      </div>

      {/* Taxi explainer */}
      <section className="mt-16 overflow-hidden border border-border bg-secondary/60">
        <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl">
              Flagdown {peso(TAXI_FLAGDOWN_PHP)}, then the meter climbs with the road
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              The estimate mirrors the LTFRB-style structure the map’s fare tool uses:
              flagdown plus a distance charge every {TAXI_PER_METER_UNIT_M} m, plus
              waiting time in traffic.
              {!FARE_SOURCE.taxi.verified && " Taxi rates haven’t been checked against a current LTFRB issuance."}
            </p>
            <LinkButton href="/map" className="mt-6">
              Estimate a real trip on the map
            </LinkButton>
          </div>
          <div className="border border-border bg-card p-6">
            <p className="readout text-muted-foreground">
              Worked example: {SAMPLE_KM} km, Plaza to Mines View
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">Flagdown</dt>
                <dd className="font-mono">{peso(TAXI_FLAGDOWN_PHP)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">
                  Distance: {peso(TAXI_PER_UNIT_PHP)} per {TAXI_PER_METER_UNIT_M} m
                </dt>
                <dd className="font-mono">{peso(sample.breakdown.distanceCharge)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">
                  Waiting: {peso(TAXI_PER_MINUTE_WAIT_PHP)} per min,{" "}
                  about {sample.breakdown.estMinutes} min
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
              Estimate only. Actual meters vary with traffic and route.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
