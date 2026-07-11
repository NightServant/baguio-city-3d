"use client";

// Debounce helpers for viewport-driven fetching.
import { useEffect, useRef, useState } from "react";
import { useMapStore, type Bounds } from "@/stores/useMapStore";

/** Returns `value` after it has stayed unchanged for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface ViewportKey {
  bounds: Bounds | null;
  zoom: number;
}

/**
 * The current viewport (bounds + zoom) from the store, debounced so rapid
 * pan/zoom or preset fly-throughs settle before we refetch.
 * Bounds are rounded to 4 decimals so trivial jitter doesn't retrigger fetches.
 */
export function useDebouncedBounds(delay = 250): ViewportKey {
  const bounds = useMapStore((s) => s.camera.bounds);
  const zoom = useMapStore((s) => s.camera.zoom);

  const rounded: Bounds | null = bounds
    ? (bounds.map((n) => Math.round(n * 1e4) / 1e4) as Bounds)
    : null;
  const key = rounded ? rounded.join(",") : "";

  const debouncedKey = useDebouncedValue(key, delay);
  const debouncedZoom = useDebouncedValue(Math.round(zoom * 10) / 10, delay);

  const last = useRef<ViewportKey>({ bounds: null, zoom });
  if (debouncedKey !== (last.current.bounds?.join(",") ?? "") || debouncedZoom !== last.current.zoom) {
    last.current = {
      bounds: debouncedKey ? (debouncedKey.split(",").map(Number) as Bounds) : null,
      zoom: debouncedZoom,
    };
  }
  return last.current;
}
