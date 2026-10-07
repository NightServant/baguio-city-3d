// Turns the OpenFreeMap "Liberty" style into a Google Earth-like view (owner 2026-10-07: "used the satellite view to
// combine with the existing 3d model", with a Google Earth 3D screenshot as the goal): Esri World Imagery is the
// ground under the 3D city, and Liberty contributes only what a photograph can't carry, its labels and faint road
// lines. Every map fill (land use, parks, water, the flat and extruded buildings) is hidden: the photograph shows
// them, and the 3D layer draws the buildings, trees and near roads.
//
// The tiles stay upstream's; only visibility and paint are overridden, so a Liberty update can't break us beyond a
// layer id going missing (every write is guarded).
//
// Two palettes, day and night, chosen from `data-theme` on <html> each time this runs, so MapView can call it again
// when the visitor toggles the theme.
import type { Map as MapLibreMap, LayerSpecification } from "maplibre-gl";
import { IMAGERY_HD_ID, IMAGERY_HD_MINZOOM, IMAGERY_HD_SOURCE, IMAGERY_ID, IMAGERY_SOURCE } from "@/lib/map/sources";

interface Palette {
  background: string; // under the imagery while its tiles load
  brightness: number; // imagery
  saturation: number;
  contrast: number;
  label: string;
  minorLabel: string;
  halo: string;
  road: [major: string, mid: string, minor: string];
  rail: string;
  boundary: string;
}

const DAY: Palette = {
  background: "#3A4148",
  brightness: 1,
  saturation: 0.1,
  contrast: 0.1,
  label: "#FFFFFF",
  minorLabel: "#F3EFE6",
  halo: "rgba(12,14,16,0.78)",
  road: ["rgba(255,236,190,0.62)", "rgba(255,255,255,0.42)", "rgba(255,255,255,0.2)"],
  rail: "rgba(255,255,255,0.35)",
  boundary: "rgba(255,255,255,0.4)",
};

// Night: the photograph dimmed and cooled, labels kept white.
const NIGHT: Palette = {
  background: "#14181C",
  brightness: 0.48,
  saturation: -0.3,
  contrast: 0.06,
  label: "#F3F1EC",
  minorLabel: "#D9D4CA",
  halo: "rgba(0,0,0,0.85)",
  road: ["rgba(255,214,150,0.5)", "rgba(230,230,230,0.32)", "rgba(220,220,220,0.16)"],
  rail: "rgba(220,220,220,0.28)",
  boundary: "rgba(220,220,220,0.32)",
};

// Liberty's park and garden POIs draw a green tree sprite over the photograph's own trees: hidden (labels stay); every
// other POI icon at half strength, so the destination pins stay the point.
const HIDE_PARK_ICONS = ["match", ["get", "class"], ["park", "garden"], 0, 0.5];

// Road line tiers by Liberty's id suffix; casings, paths and one-way arrows are hidden.
const MAJOR = /(motorway|trunk_primary)$/;
const MID = /(secondary_tertiary|_link)$/;
const MINOR = /(street|minor|service_track)$/;

/**
 * Liberty's style names some POI icons ("office", "gate", "atm", …) that its
 * sprite doesn't contain, and MapLibre logs a warning for each. Answer with a
 * blank 1×1 image so they draw nothing, quietly. Call once per map.
 */
export function blankMissingIcons(map: MapLibreMap) {
  map.on("styleimagemissing", (e) => {
    if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
}

/** True when the visitor's chosen (or system) theme is dark. */
export function isDarkTheme(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
}

type Write = ["layout" | "paint", string, unknown];

function writesFor(layer: LayerSpecification, p: Palette): Write[] {
  const { id, type } = layer;
  const hide: Write[] = [["layout", "visibility", "none"]];
  if (id === IMAGERY_ID || id === IMAGERY_HD_ID) {
    return [
      ["paint", "raster-brightness-max", p.brightness],
      ["paint", "raster-saturation", p.saturation],
      ["paint", "raster-contrast", p.contrast],
    ];
  }
  if (id === "background") return [["paint", "background-color", p.background]];
  if (type === "fill" || type === "fill-extrusion" || type === "raster" || type === "hillshade") return hide;
  if (type === "line") {
    if (id.startsWith("boundary")) return [["paint", "line-color", p.boundary]];
    if (/rail/.test(id) && !/hatching/.test(id)) return [["paint", "line-color", p.rail]];
    if (!/^(road|bridge|tunnel)_/.test(id) || /casing|path_pedestrian|hatching/.test(id)) return hide;
    const colour = MAJOR.test(id) ? p.road[0] : MID.test(id) ? p.road[1] : MINOR.test(id) ? p.road[2] : null;
    return colour ? [["paint", "line-color", colour]] : hide;
  }
  if (type === "symbol") {
    if (id.startsWith("road_one_way")) return hide;
    const minor = /^(poi|highway-name-(minor|path)|label_other|water)/.test(id);
    const out: Write[] = [
      ["paint", "text-color", minor ? p.minorLabel : p.label],
      ["paint", "text-halo-color", p.halo],
      ["paint", "text-halo-width", 1.4],
    ];
    if (/^poi_r/.test(id)) out.push(["paint", "icon-opacity", HIDE_PARK_ICONS]);
    return out;
  }
  return [];
}

/**
 * Put the imagery under Liberty's labels and set every layer for the view, in the day or night palette. Safe to call
 * on every style load and on every theme change: every write is guarded on the layer existing, and the imagery is
 * added once.
 */
export function applyEarthBasemap(map: MapLibreMap) {
  const p = isDarkTheme() ? NIGHT : DAY;
  const layers = map.getStyle()?.layers ?? [];
  if (!map.getLayer(IMAGERY_ID)) {
    if (!map.getSource(IMAGERY_ID)) map.addSource(IMAGERY_ID, IMAGERY_SOURCE);
    if (!map.getSource(IMAGERY_HD_ID)) map.addSource(IMAGERY_HD_ID, IMAGERY_HD_SOURCE);
    const above = layers.find((l) => l.id !== "background")?.id; // right above the background
    const paint = { "raster-fade-duration": 0 };
    map.addLayer({ id: IMAGERY_ID, type: "raster", source: IMAGERY_ID, maxzoom: IMAGERY_HD_MINZOOM, paint }, above);
    map.addLayer({ id: IMAGERY_HD_ID, type: "raster", source: IMAGERY_HD_ID, minzoom: IMAGERY_HD_MINZOOM, paint }, above);
  }
  for (const layer of map.getStyle()?.layers ?? []) {
    for (const [kind, prop, value] of writesFor(layer, p)) {
      try {
        if (kind === "layout") {
          map.setLayoutProperty(layer.id, prop, value);
          continue;
        }
        // No fade. With 3D terrain on, MapLibre draws fills, lines and rasters
        // into cached terrain textures; a 300 ms colour fade got captured
        // part-way and never redrawn, so after a theme toggle the ground kept
        // the old palette under new labels (seen on a real GPU).
        try {
          map.setPaintProperty(layer.id, `${prop}-transition`, { duration: 0, delay: 0 });
        } catch {
          // Not transitionable; nothing to switch off.
        }
        map.setPaintProperty(layer.id, prop, value);
      } catch {
        // A Liberty update renamed or retyped this layer. Skip it: a map that
        // is partly the wrong colour beats a map that throws on load.
      }
    }
  }
}
