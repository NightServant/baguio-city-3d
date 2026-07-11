"use client";

// Fetches destination markers for the current viewport, aborting stale requests.
// Degrades quietly: on any failure it returns an empty collection + error flag,
// never throws, never retries in a loop.
import { useEffect, useRef, useState } from "react";
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
  const [state, setState] = useState<ViewportMarkers>({
    data: EMPTY,
    loading: false,
    error: false,
  });

  // Keeps the most recent successful data during refetches to avoid flicker.
  const dataRef = useRef<DestinationsResponse>(EMPTY);

  useEffect(() => {
    if (!bounds) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: false }));

    const params = new URLSearchParams({
      bbox: bounds.join(","),
      zoom: String(zoom),
    });
    if (era) params.set("era", era);

    fetch(`/api/geo/destinations?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DestinationsResponse;
      })
      .then((data) => {
        dataRef.current = data;
        setState({ data, loading: false, error: false });
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setState({ data: dataRef.current, loading: false, error: true });
      });

    return () => controller.abort();
  }, [bounds, zoom, era]);

  return state;
}
