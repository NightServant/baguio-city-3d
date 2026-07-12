"use client";

// Landmark 3D models — scaffold only.
//
// The current dataset ships ZERO meshes (every landmark.meshUrl is null), so
// this layer is intentionally inert. The wiring is real: when a destination
// with a mesh is selected, DestinationSheet calls `addLandmarkModel` with the
// LandmarkInfo from the detail response, and a model/extrusion would be placed.
// With null meshes it returns immediately, so nothing renders and nothing breaks.
import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MAP_PALETTE } from "../categoryStyle";
import type { LandmarkInfo } from "@/types/api";

const SRC = "landmark-models";
const L_EXTRUDE = "landmark-extrusions";
const EMPTY = { type: "FeatureCollection" as const, features: [] };

/**
 * Place (or update) a landmark model at a coordinate. No-op when there is no
 * mesh — which is every landmark in the current seed data. When meshes exist,
 * this is where a custom `type: "custom"` layer (three.js/threebox) or a
 * fill-extrusion footprint would be added, using scale/rotation/altitude.
 */
export function addLandmarkModel(
  map: MapLibreMap | null,
  landmark: LandmarkInfo | null,
  _coord: [number, number],
): void {
  if (!map || !landmark || !landmark.meshUrl) return;
  // Intentionally unimplemented: no mesh assets exist yet. Left as a documented
  // extension point so the polish wave can drop in a real 3D model loader.
}

/** Ensures an (empty) source/layer exists so future model placement has a home. */
export function useLandmarkLayer(map: MapLibreMap) {
  useEffect(() => {
    if (map.getSource(SRC)) return;
    // Bail cleanly if the style is mid-swap (setStyle unloaded it) — a fresh
    // mount keyed on styleGeneration re-adds these once the new style loads.
    try {
      map.addSource(SRC, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: L_EXTRUDE,
        type: "fill-extrusion",
        source: SRC,
        paint: {
          "fill-extrusion-color": MAP_PALETTE.landmark,
          "fill-extrusion-opacity": 0.6,
          "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
        },
      });
    } catch {
      return;
    }
    return () => {
      if (map.getLayer(L_EXTRUDE)) map.removeLayer(L_EXTRUDE);
      if (map.getSource(SRC)) map.removeSource(SRC);
    };
  }, [map]);
}
