// The map's basemap styles and terrain/DEM setup — shared by MapView and the
// homepage demo map so both draw the same styles and relief.
import type { Map as MapLibreMap, RasterSourceSpecification } from "maplibre-gl";

// Keyless basemap style (OpenFreeMap "Liberty"). No token required.
export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Esri World Imagery: the ground the 3D city stands on (components/map/basemapTheme.ts puts it under Liberty's labels).
// The 3D trees are placed from ESA WorldCover (model/scripts/build_flora.py), credited here because the custom 3D
// layer has no source of its own to carry an attribution.
export const IMAGERY_ID = "esri-world-imagery";
export const IMAGERY_SOURCE = {
  type: "raster",
  tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
  tileSize: 256,
  // 18: Esri has photographs of Baguio to z18 (about 0.6 m a pixel); every z19 tile there is the grey "Map data not yet
  // available" placeholder (probed 2026-10-07 at the cathedral, Burnham, SM and Camp John Hay), so z19+ overzooms z18.
  maxzoom: 18,
  attribution:
    "Imagery © Esri, Maxar, Earthstar Geographics | Land cover © <a href='https://esa-worldcover.org'>ESA WorldCover</a> 2021 (CC BY 4.0)",
} as const satisfies RasterSourceSpecification;
// From zoom 15 (owner 2026-10-07: "reduce the blur and increase the sharpness"): the same tiles declared at 128 px, so
// MapLibre asks two zooms finer than the view (z17 at map zoom 15, the z18 photographs from 16 up) and draws two image
// pixels to a screen pixel. Below 15 the 256 px source keeps the bytes down.
export const IMAGERY_HD_ID = "esri-world-imagery-hd";
export const IMAGERY_HD_MINZOOM = 15;
export const IMAGERY_HD_SOURCE = { ...IMAGERY_SOURCE, tileSize: 128 } as const satisfies RasterSourceSpecification;

export const DEM_SOURCE = "terrain-dem";

/** Drawn taller than life so slopes read on a phone screen. The terrain API reports this value. */
export const TERRAIN_EXAGGERATION = 1.35;

export function applyTerrain(m: MapLibreMap, exaggeration = TERRAIN_EXAGGERATION) {
  if (!m.getSource(DEM_SOURCE)) {
    // AWS Open Data Terrain Tiles (Terrarium encoding) — free, keyless.
    m.addSource(DEM_SOURCE, {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      // 14, not the 15 the tiles go to: the OpenFreeMap vector tiles stop at
      // 14, and a DEM deeper than the basemap makes MapLibre warn "cannot
      // calculate elevation if elevation maxzoom > source.maxzoom". The
      // underlying DEM is ~30 m, so z14 already holds all its detail.
      maxzoom: 14,
      attribution:
        "Terrain © <a href='https://github.com/tilezen/joerd/blob/master/docs/attribution.md'>Mapzen / Tilezen</a>, AWS Open Data",
    });
  }
  m.setTerrain({ source: DEM_SOURCE, exaggeration });
  applySky(m);
}

/**
 * A clear-day atmosphere like Google Earth's (owner 2026-10-07): blue sky, pale haze toward the horizon, a light blue
 * fog over distant ground; a deep blue night. Reads data-theme on <html>, so MapView calls it again when the theme
 * toggles.
 */
export function applySky(m: MapLibreMap) {
  const night = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  try {
    m.setSky({
      "sky-color": night ? "#0B1424" : "#6E9FD4",
      "horizon-color": night ? "#26344A" : "#D6E4F1",
      "fog-color": night ? "#1B2534" : "#C8D8E8",
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.25,
    });
  } catch {
    /* older MapLibre without setSky — atmosphere is optional */
  }
}
