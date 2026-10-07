"use client";

// Handles /map deep-links emitted by the site pages. Reads the query string
// once the map instance exists in the store, then drives the camera / panels:
//   ?dest=<slug>    → open the destination sheet + easeTo its coords
//   ?route=<code>   → activate the route + open the transit panel
//   ?venue=<slug>   → resolve the slug, easeTo, drop a name popup
//   ?focus=<lng,lat>→ flyTo the coordinate (validated to the Baguio window)
// Invalid or unknown params are ignored silently — no crash, no error UI.
//
// Mounted inside a <Suspense> boundary (useSearchParams) so /map stays
// statically prerenderable. maplibre-gl is imported lazily inside the handler so
// this client component never touches `window` during server prerender.
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useMapStore } from "@/stores/useMapStore";
import { inServiceArea } from "@/lib/validate";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { DestinationFeature, VenuesResponse } from "@/types/api";

// `essential: true` (used below so the deep-link camera move survives) tells
// MapLibre to ignore prefers-reduced-motion, so we gate the duration ourselves:
// jump instantly when the user asked for reduced motion.
function motionDuration(ms: number) {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : ms;
}

// Camera moves wait for the map's first idle. Easing before any terrain had loaded left MapLibre's camera
// at elevation 0, inside the terrain (the ground renders at ~1,950 m with exaggeration), so a deep link at
// zoom 15+ showed a blank map (2026-10-05). ponytail: the 10 s fallback can still beat a very slow terrain
// load; re-sync the camera elevation on the DEM's first tiles if that turns up.
function whenSettled(map: MapLibreMap, move: () => void) {
  if (map.loaded()) return move();
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    move();
  };
  map.once("idle", go);
  setTimeout(go, 10_000);
}

export function DeepLink() {
  const params = useSearchParams();
  const map = useMapStore((s) => s.map);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !map) return;

    const dest = params.get("dest");
    const route = params.get("route");
    const venue = params.get("venue");
    const focus = params.get("focus");
    if (!dest && !route && !venue && !focus) return;

    handled.current = true;
    const controller = new AbortController();

    if (dest) {
      // Open the sheet (its own fetch renders the detail); separately fetch the
      // coords so we can fly the camera, since the sheet doesn't move the map.
      useMapStore.getState().selectDestination(dest);
      fetch(`/api/geo/destinations/${encodeURIComponent(dest)}`, { signal: controller.signal })
        .then((r) => (r.ok ? (r.json() as Promise<DestinationFeature>) : null))
        .then((f) => {
          const c = f?.geometry?.coordinates;
          if (c && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
            whenSettled(map, () => map.easeTo({ center: [c[0], c[1]], zoom: 15.5, duration: motionDuration(1600), essential: true }));
          }
        })
        .catch(() => {});
    } else if (route) {
      useMapStore.getState().setActiveRouteCode(route);
      useMapStore.getState().openSheet("transit");
    } else if (venue) {
      fetch(`/api/venues?slug=${encodeURIComponent(venue)}&limit=1`, { signal: controller.signal })
        .then((r) => (r.ok ? (r.json() as Promise<VenuesResponse>) : null))
        .then(async (data) => {
          const v = data?.items?.[0];
          if (!v || !Number.isFinite(v.lng) || !Number.isFinite(v.lat)) return;
          const center: [number, number] = [v.lng, v.lat];
          whenSettled(map, () => map.easeTo({ center, zoom: 16, duration: motionDuration(1800), essential: true }));
          const maplibregl = (await import("maplibre-gl")).default;
          new maplibregl.Popup({ closeButton: true, offset: 12 })
            .setLngLat(center)
            .setText(v.name)
            .addTo(map);
        })
        .catch(() => {});
    } else if (focus) {
      const [lngRaw, latRaw] = focus.split(",");
      const lng = Number(lngRaw);
      const lat = Number(latRaw);
      if (Number.isFinite(lng) && Number.isFinite(lat) && inServiceArea(lng, lat)) {
        whenSettled(map, () => map.flyTo({ center: [lng, lat], zoom: 16, duration: motionDuration(2000), essential: true }));
      }
    }

    return () => controller.abort();
  }, [map, params]);

  return null;
}
