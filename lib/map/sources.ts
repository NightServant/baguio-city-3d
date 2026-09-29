// The map's basemap styles and terrain/DEM setup — shared by MapView and the
// homepage demo map so both draw the same styles and relief.
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

// Keyless basemap style (OpenFreeMap "Liberty"). No token required.
export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Minimal keyless satellite style — Esri World Imagery raster tiles. The glyphs
// endpoint is REQUIRED: the app's symbol layers (marker labels, cluster counts,
// history events) render Noto Sans glyphs and break without a font source. A
// slight brightness/saturation pull-back keeps overlay markers legible on top of
// the imagery.
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster",
      source: "esri-world-imagery",
      paint: {
        "raster-brightness-max": 0.92,
        "raster-saturation": -0.12,
      },
    },
  ],
};

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
 * Cheap atmospheric sky/fog for the 3D horizon (MapLibre 5+ supports setSky),
 * in the chrome's light: bone sky and ecru horizon by day, walnut by night.
 * Reads data-theme on <html>, so MapView calls it again when the theme toggles.
 */
export function applySky(m: MapLibreMap) {
  const night = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  try {
    m.setSky({
      "sky-color": night ? "#211A15" : "#DCD3C4",
      "horizon-color": night ? "#41342B" : "#F5F0E6",
      "fog-color": night ? "#352A23" : "#E8DFD0",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.4,
    });
  } catch {
    /* older MapLibre without setSky — atmosphere is optional */
  }
}
