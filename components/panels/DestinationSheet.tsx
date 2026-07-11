"use client";

// Detail card for a selected destination. Slides in from the right on desktop,
// bottom on mobile. Hand-rolled and non-modal so the map stays interactive.
// Loading + error states; closing clears the selection.
import { useEffect, useState } from "react";
import { Clock, ImageIcon, Mountain, X } from "lucide-react";
import { useSelectedSlug, useActiveSheet, useMapActions, useMapStore } from "@/stores/useMapStore";
import { addLandmarkModel } from "@/components/map/layers/LandmarkLayer";
import { CATEGORY_COLORS, CATEGORY_LABELS, ERA_LABELS } from "@/components/map/categoryStyle";
import type { DestinationFeature } from "@/types/api";
import { cn } from "@/lib/utils";

interface DetailState {
  feature: DestinationFeature | null;
  loading: boolean;
  error: boolean;
}

export function DestinationSheet() {
  const slug = useSelectedSlug();
  const activeSheet = useActiveSheet();
  const { setSelectedSlug, closeSheet } = useMapActions();
  const [state, setState] = useState<DetailState>({ feature: null, loading: false, error: false });

  const open = activeSheet === "destination" && slug !== null;

  useEffect(() => {
    if (!open || !slug) return;
    const controller = new AbortController();
    setState({ feature: null, loading: true, error: false });
    fetch(`/api/geo/destinations/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DestinationFeature;
      })
      .then((feature) => {
        setState({ feature, loading: false, error: false });
        // Landmark scaffold: no-op today (all meshUrl null), real hook-in later.
        addLandmarkModel(
          useMapStore.getState().map,
          feature.properties.landmark,
          feature.geometry.coordinates,
        );
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setState({ feature: null, loading: false, error: true });
      });
    return () => controller.abort();
  }, [open, slug]);

  if (!open) return null;

  const close = () => {
    setSelectedSlug(null);
    closeSheet();
  };

  const props = state.feature?.properties;

  return (
    <aside
      aria-label="Destination details"
      className={cn(
        "absolute z-40 flex flex-col overflow-hidden bg-card/95 shadow-xl ring-1 ring-foreground/10 backdrop-blur",
        "max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[60dvh] max-sm:rounded-t-3xl",
        "sm:right-3 sm:top-16 sm:bottom-3 sm:w-[22rem] sm:rounded-3xl",
      )}
    >
      {/* Mobile grab handle */}
      <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
        <div className="h-1 w-10 rounded-full bg-border" />
      </div>

      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
        <div className="min-w-0">
          {state.loading && <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />}
          {props && (
            <>
              <h2 className="font-heading truncate text-lg font-medium text-foreground">
                {props.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[props.category] }}
                  />
                  {CATEGORY_LABELS[props.category]}
                </span>
                {props.era && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {ERA_LABELS[props.era]}
                  </span>
                )}
              </div>
            </>
          )}
          {state.error && (
            <h2 className="font-heading text-base font-medium text-foreground">
              Couldn&apos;t load this place
            </h2>
          )}
        </div>
        <button
          type="button"
          aria-label="Close details"
          onClick={close}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        {state.loading && (
          <div className="flex flex-col gap-2" aria-hidden>
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        )}

        {state.error && (
          <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            The details service isn&apos;t answering. Close this card and tap the pin again in a
            moment.
          </p>
        )}

        {props && (
          <div className="flex flex-col gap-4">
            {/* Media */}
            {props.media.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto">
                {props.media.map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.id}
                    src={m.url}
                    alt={m.alt}
                    className="h-32 w-48 shrink-0 rounded-2xl object-cover ring-1 ring-foreground/10"
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ImageIcon className="size-6" aria-hidden />
                <span className="sr-only">No photos yet</span>
              </div>
            )}

            <p className="text-sm leading-relaxed text-foreground">{props.description}</p>

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2.5">
                <Clock className="size-4 shrink-0 text-primary" aria-hidden />
                <dt className="sr-only">Hours</dt>
                <dd className="text-muted-foreground">
                  {props.hours
                    ? `Open ${props.hours.open}–${props.hours.close}`
                    : "Open all day"}
                </dd>
              </div>
              {props.elevationM !== null && (
                <div className="flex items-center gap-2.5">
                  <Mountain className="size-4 shrink-0 text-primary" aria-hidden />
                  <dt className="sr-only">Elevation</dt>
                  <dd className="text-muted-foreground">
                    {Math.round(props.elevationM).toLocaleString()} m above sea level
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </aside>
  );
}
