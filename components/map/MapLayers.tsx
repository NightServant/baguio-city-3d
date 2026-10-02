"use client";

// Mounts all imperative map layers once the map + style are ready.
// Kept as a component so the layer hooks always run in a stable order.
import type { Map as MapLibreMap } from "maplibre-gl";
import { useMarkerLayer } from "./layers/MarkerLayer";
import { useTransitLayer } from "./layers/TransitLayer";
import { useHistoryOverlay } from "./layers/HistoryOverlay";
import { useModelLayer } from "./layers/ModelLayer";

export function MapLayers({ map }: { map: MapLibreMap }) {
  useMarkerLayer(map);
  useTransitLayer(map);
  useHistoryOverlay(map);
  useModelLayer(map);
  return null;
}
