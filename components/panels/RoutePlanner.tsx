"use client";

// Jeepney route picker + fare calculator.
// Picking a route highlights it on the map (TransitLayer) and lists its stops.
// Fares: jeepney = stop-to-stop along the active route; taxi = two map clicks.
import { useEffect, useState } from "react";
import { Bus, CarTaxiFront, Crosshair } from "lucide-react";
import {
  useActiveRouteCode,
  useMapActions,
  useMapStore,
  useTransit,
} from "@/stores/useMapStore";
import type { FareResponse, TransitRouteFeature, TransitRoutesResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { focusRing } from "./controlStyles";

interface RoutesState {
  routes: TransitRouteFeature[];
  loading: boolean;
  error: boolean;
}

const BREAKDOWN_LABELS: Record<string, string> = {
  base: "Base fare",
  distance: "Distance charge",
  flagdown: "Flag-down",
  perKm: "Per-km charge",
};

function peso(n: number): string {
  return `₱${n.toFixed(2)}`;
}

export function RoutePlanner() {
  const activeRouteCode = useActiveRouteCode();
  const { setActiveRouteCode } = useMapActions();
  const [state, setState] = useState<RoutesState>({ routes: [], loading: true, error: false });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/geo/transit/routes?zoom=12", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as TransitRoutesResponse;
      })
      .then((data) => setState({ routes: data.features, loading: false, error: false }))
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setState({ routes: [], loading: false, error: true });
      });
    return () => controller.abort();
  }, []);

  const activeRoute =
    state.routes.find((r) => r.properties.code === activeRouteCode) ?? null;

  const pickRoute = (route: TransitRouteFeature) => {
    const next = route.properties.code === activeRouteCode ? null : route.properties.code;
    setActiveRouteCode(next);
    if (next) {
      // Frame the route.
      const map = useMapStore.getState().map;
      const coords = route.geometry.coordinates;
      if (map && coords.length > 1) {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const [lng, lat] of coords) {
          minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
          maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
        }
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, pitch: 45, duration: 1500 });
      }
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Routes
        </p>

        {state.loading && (
          <div className="flex flex-col gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        )}

        {state.error && (
          <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            Jeepney routes aren&apos;t loading right now. Try again in a moment.
          </p>
        )}

        {!state.error && !state.loading && state.routes.length === 0 && (
          <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            No jeepney routes to show yet. Check back in a moment.
          </p>
        )}

        <ul className="flex flex-col gap-1.5">
          {state.routes.map((route) => {
            const active = route.properties.code === activeRouteCode;
            return (
              <li key={route.properties.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickRoute(route)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors active:translate-y-px",
                    focusRing,
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/70",
                  )}
                >
                  <Bus className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {route.properties.name}
                    </span>
                    <span className={cn("block text-xs", active ? "opacity-80" : "text-muted-foreground")}>
                      {route.properties.code} · {route.properties.stops.length} stops · base{" "}
                      {peso(route.properties.fareBase)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {activeRoute && (
          <ol className="ml-1.5 flex flex-col border-l border-border pl-3 text-xs text-muted-foreground">
            {activeRoute.properties.stops.map((stop) => (
              <li key={stop.seq} className="relative py-1">
                <span className="absolute -left-[17px] top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary" />
                {stop.name}
              </li>
            ))}
          </ol>
        )}
      </section>

      <hr className="border-border" />

      <FareCalculator activeRoute={activeRoute} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fare calculator
// ---------------------------------------------------------------------------

export function FareCalculator({ activeRoute }: { activeRoute: TransitRouteFeature | null }) {
  const transit = useTransit();
  const { setFareQuery, setFareResult } = useMapActions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stop-to-stop selection for jeepney mode (indices into activeRoute stops).
  const [fromStop, setFromStop] = useState<number | "">("");
  const [toStop, setToStop] = useState<number | "">("");

  const { mode, from, to, picking } = transit.fareQuery;
  const result = transit.fareResult;

  // Reset stop picks when the route changes.
  useEffect(() => {
    setFromStop("");
    setToStop("");
    setFareResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoute?.properties.code]);

  const stops = activeRoute?.properties.stops ?? [];

  const jeepneyReady =
    mode === "jeepney" && activeRoute && fromStop !== "" && toStop !== "" && fromStop !== toStop;
  const taxiReady = mode === "taxi" && from && to;

  const calculate = async () => {
    setError(null);
    setLoading(true);
    setFareResult(null);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === "jeepney") {
        if (!activeRoute || fromStop === "" || toStop === "") return;
        const a = stops[fromStop];
        const b = stops[toStop];
        params.set("routeCode", activeRoute.properties.code);
        params.set("fromLng", String(a.lng));
        params.set("fromLat", String(a.lat));
        params.set("toLng", String(b.lng));
        params.set("toLat", String(b.lat));
      } else {
        if (!from || !to) return;
        params.set("fromLng", String(from[0]));
        params.set("fromLat", String(from[1]));
        params.set("toLng", String(to[0]));
        params.set("toLat", String(to[1]));
      }
      const res = await fetch(`/api/geo/transit/fare?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFareResult((await res.json()) as FareResponse);
    } catch {
      setError("The fare service isn't answering right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const fmtCoord = (c: [number, number] | null) =>
    c ? `${c[1].toFixed(4)}, ${c[0].toFixed(4)}` : "Not set";

  return (
    <section className="flex flex-col gap-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Fare estimate
      </p>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            { key: "jeepney", label: "Jeepney", icon: Bus },
            { key: "taxi", label: "Taxi", icon: CarTaxiFront },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => {
              setFareQuery({ mode: key, picking: null });
              setFareResult(null);
              setError(null);
            }}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors active:translate-y-px",
              focusRing,
              mode === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "jeepney" && !activeRoute && (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          Pick a route above first — jeepney fares follow the route&apos;s own rates.
        </p>
      )}

      {mode === "jeepney" && activeRoute && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Board at
            <select
              value={fromStop}
              onChange={(e) => setFromStop(e.target.value === "" ? "" : Number(e.target.value))}
              className="h-9 rounded-xl border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">Choose a stop</option>
              {stops.map((s, i) => (
                <option key={s.seq} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Get off at
            <select
              value={toStop}
              onChange={(e) => setToStop(e.target.value === "" ? "" : Number(e.target.value))}
              className="h-9 rounded-xl border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">Choose a stop</option>
              {stops.map((s, i) => (
                <option key={s.seq} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {mode === "taxi" && (
        <div className="flex flex-col gap-1.5">
          {(
            [
              { key: "from", label: "From", value: from },
              { key: "to", label: "To", value: to },
            ] as const
          ).map(({ key, label, value }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFareQuery({ picking: picking === key ? null : key })}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors active:translate-y-px",
                focusRing,
                picking === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/70",
              )}
            >
              <Crosshair className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs opacity-70">{label}</span>
                <span className="block truncate font-mono tabular-nums">
                  {picking === key ? "Tap the map…" : fmtCoord(value)}
                </span>
              </span>
            </button>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Tap a field, then tap the map to drop that point.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!(jeepneyReady || taxiReady) || loading}
        onClick={calculate}
        className={cn(
          "h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
          focusRing,
        )}
      >
        {loading ? "Working it out…" : "Estimate fare"}
      </button>

      {error && (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">{error}</p>
      )}

      {result && (
        <div className="rounded-2xl bg-muted p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              {result.mode === "jeepney" ? "Jeepney fare" : "Taxi estimate"} ·{" "}
              {result.distanceKm.toFixed(1)} km
            </span>
            <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {peso(result.fare)}
            </span>
          </div>
          <dl className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2.5 text-xs">
            {Object.entries(result.breakdown).map(([k, v]) => (
              <div key={k} className="flex justify-between text-muted-foreground">
                <dt>{BREAKDOWN_LABELS[k] ?? k}</dt>
                <dd className="font-mono tabular-nums">{peso(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
