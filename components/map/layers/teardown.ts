import type { Map as MapLibreMap } from "maplibre-gl";

// map.remove() drops the style object, so any getLayer/getSource/off call after
// it dereferences undefined. Layer cleanups can run after removal (Fast Refresh,
// StrictMode remounts), and a removed map has nothing left to tear down anyway.
export function isTornDown(map: MapLibreMap) {
  return map._removed || !map.style;
}
