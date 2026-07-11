"use client";

// Mounts all imperative map layers once the map + style are ready.
// Kept as a component so the layer hooks always run in a stable order.
import type { Map as MapboxMap } from "mapbox-gl";
import { useMarkerLayer } from "./layers/MarkerLayer";
import { useTransitLayer } from "./layers/TransitLayer";
import { useHistoryOverlay } from "./layers/HistoryOverlay";
import { useLandmarkLayer } from "./layers/LandmarkLayer";

export function MapLayers({ map }: { map: MapboxMap }) {
  useMarkerLayer(map);
  useTransitLayer(map);
  useHistoryOverlay(map);
  useLandmarkLayer(map);
  return null;
}
