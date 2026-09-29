// Re-dyes the third-party OpenFreeMap "Liberty" basemap into the Cordillera
// Weave palette, and lights the terrain with a hillshade pass.
//
// Two problems this solves, both measured on the running map:
//
// 1. Liberty ships OSM's default carto colours — highway yellow (#fea), motorway
//    orange (#fc8), park green (#d8e8c8), cornflower water. Against bone chrome
//    and madder markers that reads as two unrelated products stacked on top of
//    each other.
// 2. The map runs at pitch 60 with terrain exaggerated 1.35×, but Liberty has no
//    relief shading of its own, so a mountain city rendered in 3D still read as
//    a flat pale sheet. The DEM was already loaded — nothing was drawing it.
//
// Both are fixed here rather than by forking the style: the tiles stay
// upstream's, only paint is overridden, so a Liberty update can't break us
// beyond a layer id going missing (each write is guarded).
//
// Two palettes, day and night, chosen from `data-theme` on <html> each time
// this runs, so MapView can call it again when the visitor toggles the theme.
import type { Map as MapLibreMap } from "maplibre-gl";

interface Palette {
  ground: string;
  label: string; // major labels
  thread: string; // minor labels, rails
  roadMajor: [fill: string, casing: string];
  roadMid: [fill: string, casing: string];
  roadMinor: [fill: string, casing: string];
  weld: string; // vegetation and parks
  wood: string;
  pitch: string;
  residential: string;
  school: string;
  hospital: string;
  sand: string;
  ice: string;
  water: string;
  waterLabel: string;
  aeroway: string;
  building: string;
  boundary: [outer: string, inner: string];
  halo: string;
  shadow: string;
  highlight: string;
  accent: string;
}

// The ground the map is woven on. Roads are graded warp threads rather than
// hue-coded classes; hierarchy comes from value and width, not colour.
const DAY: Palette = {
  ground: "#F5F0E6",
  label: "#16130F",
  thread: "#6B6156",
  roadMajor: ["#EFE3CD", "#9C8969"],
  roadMid: ["#F2EADC", "#B7A78C"],
  roadMinor: ["#FBF7EF", "#C8BCA6"],
  weld: "#DDD3AC", // weld dye, lightened: straw, not sage (owner: no green)
  wood: "rgba(214,203,160,0.7)",
  pitch: "#E3DABB",
  residential: "rgba(232,223,208,0.25)",
  school: "#E6E2CE",
  hospital: "#EDDDD8",
  sand: "#EFE6D2",
  ice: "#E8ECEC",
  water: "#9FB3C4", // indigo dye, lightened — the one cool note
  waterLabel: "#44586B",
  aeroway: "#E4DFD6",
  building: "#E2D9CA",
  boundary: ["rgba(107,97,86,0.35)", "rgba(107,97,86,0.55)"],
  halo: "rgba(245,240,230,0.9)",
  // Warp in the shadows, bone on the lit faces: the chrome's own threads.
  shadow: "rgba(22,19,15,0.30)",
  highlight: "rgba(255,251,242,0.22)",
  accent: "rgba(140,35,24,0.14)",
};

// Night: the walnut ground of the dark chrome, roads as lighter browns
// catching light, parks a dark straw, water the one cool note still (slate).
const NIGHT: Palette = {
  ground: "#30261F",
  label: "#F3ECE1",
  thread: "#CDBBA7",
  roadMajor: ["#7A6452", "#3F322A"],
  roadMid: ["#65513F", "#382C24"],
  roadMinor: ["#524234", "#342920"],
  weld: "#3D3527",
  wood: "rgba(61,53,39,0.8)",
  pitch: "#41382A",
  residential: "rgba(65,52,43,0.35)",
  school: "#3E332A",
  hospital: "#44322D",
  sand: "#433728",
  ice: "#403B36",
  water: "#3A4852",
  waterLabel: "#AEBFCB",
  aeroway: "#3A2E26",
  building: "#403229",
  boundary: ["rgba(201,184,165,0.30)", "rgba(201,184,165,0.50)"],
  halo: "rgba(48,38,31,0.9)",
  shadow: "rgba(12,8,6,0.45)",
  highlight: "rgba(243,236,225,0.10)",
  accent: "rgba(217,138,123,0.10)",
};

// Liberty's park and garden POIs draw a green tree sprite, and sprites can't be
// re-dyed. The owner's rule is no green anywhere, so those icons are hidden
// (their labels stay); every other POI icon keeps the half-strength fade.
const HIDE_PARK_ICONS = ["match", ["get", "class"], ["park", "garden"], 0, 0.5];

/** [layerId, paintProperty, value] — applied only if the layer exists. */
type Paint = [string, string, unknown];

const LINE = "line-color";
const FILL = "fill-color";
const TEXT = "text-color";

const LABELS: [id: string, major: boolean][] = [
  ["poi_r20", false],
  ["poi_r7", false],
  ["poi_r1", false],
  ["airport", false],
  ["highway-name-minor", false],
  ["highway-name-major", true],
  ["label_other", false],
  ["label_village", true],
  ["label_town", true],
  ["label_city", true],
  ["label_city_capital", true],
  ["label_state", false],
];

function paints(p: Palette): Paint[] {
  return [
    ["background", "background-color", p.ground],
    ["natural_earth", "raster-opacity", 0],

    // Vegetation — Baguio's defining cover, so it keeps its own value, just in
    // weld rather than OSM's mint green.
    ["park", FILL, p.weld],
    ["park_outline", LINE, p.weld],
    ["landcover_wood", FILL, p.wood],
    ["landcover_grass", FILL, p.weld],
    ["landuse_pitch", FILL, p.pitch],
    ["landuse_track", FILL, p.pitch],
    ["landuse_cemetery", FILL, p.pitch],
    ["landuse_residential", FILL, p.residential],
    ["landuse_school", FILL, p.school],
    ["landuse_hospital", FILL, p.hospital],
    ["landcover_sand", FILL, p.sand],
    ["landcover_ice", FILL, p.ice],

    // Water — the one cool note, so Burnham's lagoon and the rivers read at all.
    ["water", FILL, p.water],
    ["waterway_river", LINE, p.water],
    ["waterway_other", LINE, p.water],
    ["waterway_tunnel", LINE, p.water],
    ["waterway_line_label", TEXT, p.waterLabel],
    ["water_name_point_label", TEXT, p.waterLabel],
    ["water_name_line_label", TEXT, p.waterLabel],
    ["poi_transit", TEXT, p.waterLabel],

    ["aeroway_fill", FILL, p.aeroway],
    ["aeroway_runway", LINE, p.roadMinor[0]],
    ["aeroway_taxiway", LINE, p.roadMinor[0]],

    ["building", FILL, p.building],
    // The extruded massing is what the pitched camera actually shows of the city,
    // so it gets the wall colour verified from street level — painted CHB render,
    // not OSM's neutral grey.
    ["building-3d", "fill-extrusion-color", p.building],
    ["building-3d", "fill-extrusion-opacity", 0.92],

    // Liberty's POI markers are sprite images, so they can't be re-dyed — they
    // stay OSM blue and green. Dropped back far enough to read as reference
    // rather than compete with the madder destination pins, which are the point.
    ["poi_r20", "icon-opacity", HIDE_PARK_ICONS],
    ["poi_r7", "icon-opacity", HIDE_PARK_ICONS],
    ["poi_r1", "icon-opacity", HIDE_PARK_ICONS],
    ["poi_transit", "icon-opacity", 0.6],

    ["boundary_3", LINE, p.boundary[0]],
    ["boundary_2", LINE, p.boundary[1]],

    ["road_major_rail", LINE, p.thread],
    ["road_major_rail_hatching", LINE, p.thread],
    ["road_transit_rail", LINE, p.thread],
    ["road_transit_rail_hatching", LINE, p.thread],
    ["highway-name-path", TEXT, p.thread],

    ...LABELS.flatMap(([id, major]): Paint[] => [
      [id, TEXT, major ? p.label : p.thread],
      [id, "text-halo-color", p.halo],
    ]),
    ["waterway_line_label", "text-halo-color", p.halo],
    ["water_name_point_label", "text-halo-color", p.halo],
    ["water_name_line_label", "text-halo-color", p.halo],
  ];
}

// Roads come in tunnel_/road_/bridge_ triplets with identical ids otherwise, so
// they're generated rather than listed three times.
const ROAD_TIERS: [suffix: string, tier: "roadMajor" | "roadMid" | "roadMinor"][] = [
  ["motorway", "roadMajor"],
  ["motorway_link", "roadMajor"],
  ["trunk_primary", "roadMajor"],
  ["secondary_tertiary", "roadMid"],
  ["link", "roadMid"],
  ["street", "roadMinor"],
  ["minor", "roadMinor"],
  ["service_track", "roadMinor"],
  ["path_pedestrian", "roadMinor"],
];

function roadPaints(p: Palette): Paint[] {
  const out: Paint[] = [];
  for (const prefix of ["road", "tunnel", "bridge"]) {
    for (const [suffix, tier] of ROAD_TIERS) {
      const [fill, casing] = p[tier];
      out.push([`${prefix}_${suffix}`, LINE, fill]);
      out.push([`${prefix}_${suffix}_casing`, LINE, casing]);
    }
  }
  return out;
}

const HILLSHADE_ID = "terrain-hillshade";

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

/**
 * Re-dye Liberty and add relief shading, in the day or night palette. Safe to
 * call on every style load and on every theme change: every write is guarded
 * on the layer existing, and the hillshade is added once.
 *
 * `demSource` must already be on the map (applyTerrain adds it).
 */
export function applyWeaveBasemap(map: MapLibreMap, demSource: string) {
  const p = isDarkTheme() ? NIGHT : DAY;

  // Relief first, so it sits under the road/label writes below and any failure
  // there still leaves the terrain readable.
  if (!map.getLayer(HILLSHADE_ID) && map.getSource(demSource)) {
    // The shading gets its own copy of the DEM: sharing one raster-dem source
    // between the hillshade and the 3D terrain renders the relief worse (and
    // MapLibre warns about it). Same tiles, so the browser cache serves them.
    const hillshadeSource = `${demSource}-hillshade`;
    if (!map.getSource(hillshadeSource)) {
      map.addSource(hillshadeSource, { ...map.getSource(demSource)!.serialize(), attribution: undefined });
    }
    map.addLayer(
      { id: HILLSHADE_ID, type: "hillshade", source: hillshadeSource, paint: { "hillshade-exaggeration": 0.5 } },
      // Above the land fills, below water and roads: ridges get modelled,
      // carriageways and labels stay crisp.
      map.getLayer("waterway_tunnel") ? "waterway_tunnel" : undefined,
    );
  }

  const hillshade: Paint[] = [
    [HILLSHADE_ID, "hillshade-shadow-color", p.shadow],
    [HILLSHADE_ID, "hillshade-highlight-color", p.highlight],
    [HILLSHADE_ID, "hillshade-accent-color", p.accent],
  ];

  for (const [id, prop, value] of [...hillshade, ...paints(p), ...roadPaints(p)]) {
    if (!map.getLayer(id)) continue;
    // No fade. With 3D terrain on, MapLibre draws fills, lines and the
    // hillshade into cached terrain textures; a 300 ms colour fade got
    // captured part-way and never redrawn, so after a theme toggle the ground
    // kept the old palette under new labels (seen on a real GPU).
    try {
      map.setPaintProperty(id, `${prop}-transition`, { duration: 0, delay: 0 });
    } catch {
      // Not transitionable; nothing to switch off.
    }
    try {
      map.setPaintProperty(id, prop, value);
    } catch {
      // A Liberty update renamed or retyped this layer. Skip it — a basemap
      // that is partly the wrong colour beats a map that throws on load.
    }
  }
}
