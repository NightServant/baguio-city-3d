"use client";

// Fetches destination markers for the current viewport, aborting stale requests.
// Degrades quietly: on any failure it returns an empty collection + error flag,
// never throws, never retries in a loop.
import { useEffect, useMemo, useState } from "react";
import type { DestinationsResponse, Era } from "@/types/api";
import type { Bounds } from "@/stores/useMapStore";

const EMPTY: DestinationsResponse = { type: "FeatureCollection", features: [] };

export interface ViewportMarkers {
  data: DestinationsResponse;
  loading: boolean;
  error: boolean;
}

export function useViewportMarkers(
  bounds: Bounds | null,
  zoom: number,
  era: Era | null,
): ViewportMarkers {
  const key = bounds ? `${bounds.join(",")}|${zoom}|${era ?? ""}` : null;
  // `data` is the last successful response, kept through refetches so markers don't flicker
  const [state, setState] = useState<{ key: string | null; data: DestinationsResponse; error: boolean }>({
    key: null,
    data: EMPTY,
    error: false,
  });

  useEffect(() => {
    if (!bounds) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ bbox: bounds.join(","), zoom: String(zoom) });
    if (era) params.set("era", era);
    const k = `${bounds.join(",")}|${zoom}|${era ?? ""}`;
    fetch(`/api/geo/destinations?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DestinationsResponse;
      })
      .then((data) => setState({ key: k, data, error: false }))
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setState((s) => ({ key: k, data: s.data, error: true }));
      });
    return () => controller.abort();
  }, [bounds, zoom, era]);

  const loading = key !== null && state.key !== key;
  const error = !loading && state.error; // a refetch clears the last error, as before
  return useMemo(() => ({ data: state.data, loading, error }), [state.data, loading, error]);
}
