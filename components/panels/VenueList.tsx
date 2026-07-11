"use client";

// Venue results for the Explore panel. Cursor-paginated "load more"; clicking
// an item eases the camera to it and shows a lightweight mapbox popup.
// Degrades to a quiet notice when the API is unreachable.
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { MapPin } from "lucide-react";
import { useFilters, useMapStore } from "@/stores/useMapStore";
import { useDebouncedValue } from "@/hooks/useDebouncedBounds";
import type { VenueCategory, VenueListItem, VenuesResponse } from "@/types/api";
import { PRICE_GLYPHS, VENUE_CATEGORY_LABELS } from "@/components/map/categoryStyle";

interface VenueListState {
  items: VenueListItem[];
  nextCursor: string | null;
  loading: boolean;
  error: boolean;
}

function buildParams(
  filters: { priceMax: number | null; openNow: boolean; q: string },
  venueCategory: VenueCategory | null,
  cursor: string | null,
): URLSearchParams {
  const params = new URLSearchParams();
  if (venueCategory) params.set("category", venueCategory);
  if (filters.priceMax !== null) params.set("priceMax", String(filters.priceMax));
  if (filters.openNow) params.set("openNow", "true");
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (cursor) params.set("cursor", cursor);
  return params;
}

export function VenueList({ venueCategory }: { venueCategory: VenueCategory | null }) {
  const filters = useFilters();
  const q = useDebouncedValue(filters.q, 300);
  const [state, setState] = useState<VenueListState>({
    items: [],
    nextCursor: null,
    loading: true,
    error: false,
  });
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const filterKey = JSON.stringify([venueCategory, filters.priceMax, filters.openNow, q]);

  // Fresh page whenever filters change.
  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: false }));
    const params = buildParams({ priceMax: filters.priceMax, openNow: filters.openNow, q }, venueCategory, null);
    fetch(`/api/venues?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VenuesResponse;
      })
      .then((data) =>
        setState({ items: data.items, nextCursor: data.nextCursor, loading: false, error: false }),
      )
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setState({ items: [], nextCursor: null, loading: false, error: true });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // Clean up any popup we opened when the list unmounts.
  useEffect(() => {
    return () => {
      popupRef.current?.remove();
    };
  }, []);

  const loadMore = () => {
    if (!state.nextCursor || state.loading) return;
    setState((s) => ({ ...s, loading: true }));
    const params = buildParams(
      { priceMax: filters.priceMax, openNow: filters.openNow, q },
      venueCategory,
      state.nextCursor,
    );
    fetch(`/api/venues?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VenuesResponse;
      })
      .then((data) =>
        setState((s) => ({
          items: [...s.items, ...data.items],
          nextCursor: data.nextCursor,
          loading: false,
          error: false,
        })),
      )
      .catch(() => setState((s) => ({ ...s, loading: false, error: true })));
  };

  const showVenue = (venue: VenueListItem) => {
    const map = useMapStore.getState().map;
    if (!map) return;
    map.easeTo({ center: [venue.lng, venue.lat], zoom: Math.max(map.getZoom(), 15.5) });
    popupRef.current?.remove();
    popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: "260px" })
      .setLngLat([venue.lng, venue.lat])
      .setHTML(
        `<div style="font-family:inherit">
          <strong>${escapeHtml(venue.name)}</strong>
          <div style="opacity:.7;font-size:12px">${VENUE_CATEGORY_LABELS[venue.category]} · ${PRICE_GLYPHS[venue.priceRange]}</div>
        </div>`,
      )
      .addTo(map);
  };

  return (
    <section className="flex flex-col gap-2">
      {state.error && (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          Venues aren&apos;t loading right now. The map still works — try again in a moment.
        </p>
      )}

      {!state.error && !state.loading && state.items.length === 0 && (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          Nothing matches these filters yet. Loosen one and more places will appear.
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {state.items.map((venue) => (
          <li key={venue.id}>
            <button
              type="button"
              onClick={() => showVenue(venue)}
              className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted"
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {venue.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {VENUE_CATEGORY_LABELS[venue.category]} · {PRICE_GLYPHS[venue.priceRange]}
                  {venue.hours ? ` · ${venue.hours.open}–${venue.hours.close}` : " · Open daily"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {state.loading && (
        <div className="flex flex-col gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {state.nextCursor && !state.loading && (
        <button
          type="button"
          onClick={loadMore}
          className="h-9 rounded-xl bg-muted text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Load more places
        </button>
      )}
    </section>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
