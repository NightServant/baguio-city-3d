"use client";

// Era scrubber: a horizontal band of the four eras with year ranges. Picking
// one re-tints the map (HistoryOverlay) and lists that era's events; events
// with coordinates fly the camera to their spot.
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useActiveEra, useMapActions, useMapStore } from "@/stores/useMapStore";
import type { EraWithEvents, ErasResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { focusRing } from "./controlStyles";

interface ErasState {
  eras: EraWithEvents[];
  loading: boolean;
  error: boolean;
}

function yearRange(era: EraWithEvents): string {
  const start = era.startYear < 0 ? "…" : String(era.startYear);
  return `${start}–${era.endYear ?? "now"}`;
}

export function TimelineScrubber() {
  const activeEra = useActiveEra();
  const { setActiveEra } = useMapActions();
  const [state, setState] = useState<ErasState>({ eras: [], loading: true, error: false });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/history/eras", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ErasResponse;
      })
      .then((data) => setState({ eras: data.eras, loading: false, error: false }))
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setState({ eras: [], loading: false, error: true });
      });
    return () => controller.abort();
  }, []);

  const selected = state.eras.find((e) => e.key === activeEra) ?? null;

  const flyToEvent = (lng?: number, lat?: number) => {
    const map = useMapStore.getState().map;
    if (!map || lng == null || lat == null) return;
    // essential: true bypasses prefers-reduced-motion, so gate the duration.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo({ center: [lng, lat], zoom: 15.5, duration: reduce ? 0 : 1800, essential: true });
  };

  return (
    <div className="flex flex-col gap-4">
      {state.loading && (
        <div className="grid grid-cols-2 gap-1.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {state.error && (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          The history timeline isn&apos;t loading right now. The rest of the map still works.
        </p>
      )}

      {/* Scrubber band */}
      {state.eras.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2">
            {state.eras.map((era) => {
              const active = era.key === activeEra;
              return (
                <button
                  key={era.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveEra(active ? null : era.key)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors active:translate-y-px",
                    focusRing,
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-xs font-medium leading-tight">{era.name}</span>
                  <span className={cn("font-mono text-[11px] tabular-nums", active ? "opacity-80" : "opacity-70")}>
                    {yearRange(era)}
                  </span>
                </button>
              );
            })}
          </div>
          {activeEra && (
            <button
              type="button"
              onClick={() => setActiveEra(null)}
              className={cn("self-start rounded text-xs font-medium text-primary hover:underline", focusRing)}
            >
              Back to the present
            </button>
          )}
        </div>
      )}

      {/* Era summary + events */}
      {selected && (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-foreground">{selected.summary}</p>
          {selected.events.length > 0 && (
            <ul className="flex flex-col gap-1">
              {selected.events.map((event) => {
                const hasCoords = event.lng != null && event.lat != null;
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      disabled={!hasCoords}
                      onClick={() => flyToEvent(event.lng, event.lat)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                        focusRing,
                        hasCoords ? "hover:bg-muted" : "cursor-default",
                      )}
                    >
                      <span className="mt-0.5 w-10 shrink-0 font-mono text-xs font-medium tabular-nums text-primary">
                        {event.year}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                          <span className="truncate">{event.title}</span>
                          {hasCoords && <MapPin className="size-3 shrink-0 text-muted-foreground" />}
                        </span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {event.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!selected && !state.loading && state.eras.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Pick an era to re-tint the map and see what happened where.
        </p>
      )}
    </div>
  );
}
