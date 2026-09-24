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
import type { Map as MapLibreMap } from "maplibre-gl";

// The ground the map is woven on. Roads are graded warp threads rather than
// hue-coded classes; hierarchy comes from value and width, not colour.
const BONE = "#F5F0E6";
const WARP = "#16130F";
const THREAD = "#6B6156";

const ROAD_MAJOR = "#EFE3CD";
const ROAD_MAJOR_CASING = "#9C8969";
const ROAD_MID = "#F2EADC";
const ROAD_MID_CASING = "#B7A78C";
const ROAD_MINOR = "#FBF7EF";
const ROAD_MINOR_CASING = "#C8BCA6";

const WELD = "#CFD1B4"; // weld dye, lightened — vegetation and parks
const INDIGO = "#9FB3C4"; // indigo dye, lightened — water
const BUILDING = "#E2D9CA";

/** [layerId, paintProperty, value] — applied only if the layer exists. */
type Paint = [string, string, string | number];

const LINE = "line-color";
const FILL = "fill-color";
const TEXT = "text-color";

const PAINTS: Paint[] = [
  ["background", "background-color", BONE],
  ["natural_earth", "raster-opacity", 0],

  // Vegetation — Baguio's defining cover, so it keeps its own value, just in
  // weld rather than OSM's mint green.
  ["park", FILL, WELD],
  ["park_outline", LINE, "rgba(207,209,180,0.6)"],
  ["landcover_wood", FILL, "rgba(198,202,170,0.7)"],
  ["landcover_grass", FILL, WELD],
  ["landuse_pitch", FILL, "#D9DCC2"],
  ["landuse_track", FILL, "#D9DCC2"],
  ["landuse_cemetery", FILL, "#D9DCC2"],
  ["landuse_residential", FILL, "rgba(232,223,208,0.25)"],
  ["landuse_school", FILL, "#E6E2CE"],
  ["landuse_hospital", FILL, "#EDDDD8"],
  ["landcover_sand", FILL, "#EFE6D2"],
  ["landcover_ice", FILL, "#E8ECEC"],

  // Water — the one cool note, so Burnham's lagoon and the rivers read at all.
  ["water", FILL, INDIGO],
  ["waterway_river", LINE, INDIGO],
  ["waterway_other", LINE, INDIGO],
  ["waterway_tunnel", LINE, INDIGO],
  ["waterway_line_label", TEXT, "#44586B"],
  ["water_name_point_label", TEXT, "#44586B"],
  ["water_name_line_label", TEXT, "#44586B"],

  ["aeroway_fill", FILL, "#E4DFD6"],
  ["aeroway_runway", LINE, ROAD_MINOR],
  ["aeroway_taxiway", LINE, ROAD_MINOR],

  ["building", FILL, BUILDING],
  // The extruded massing is what the pitched camera actually shows of the city,
  // so it gets the wall colour verified from street level — painted CHB render,
  // not OSM's neutral grey.
  ["building-3d", "fill-extrusion-color", BUILDING],
  ["building-3d", "fill-extrusion-opacity", 0.92],

  // Liberty's POI markers are sprite images, so they can't be re-dyed — they
  // stay OSM blue and green. Dropped back far enough to read as reference
  // rather than compete with the madder destination pins, which are the point.
  ["poi_r20", "icon-opacity", 0.5],
  ["poi_r7", "icon-opacity", 0.5],
  ["poi_r1", "icon-opacity", 0.5],
  ["poi_transit", "icon-opacity", 0.6],

  ["boundary_3", LINE, "rgba(107,97,86,0.35)"],
  ["boundary_2", LINE, "rgba(107,97,86,0.55)"],

  ["road_major_rail", LINE, THREAD],
  ["road_major_rail_hatching", LINE, THREAD],
  ["road_transit_rail", LINE, THREAD],
  ["road_transit_rail_hatching", LINE, THREAD],

  ["poi_r20", TEXT, THREAD],
  ["poi_r7", TEXT, THREAD],
  ["poi_r1", TEXT, THREAD],
  ["poi_transit", TEXT, "#44586B"],
  ["airport", TEXT, THREAD],
  ["highway-name-path", TEXT, "rgba(107,97,86,0.8)"],
  ["highway-name-minor", TEXT, THREAD],
  ["highway-name-major", TEXT, WARP],
  ["label_other", TEXT, THREAD],
  ["label_village", TEXT, WARP],
  ["label_town", TEXT, WARP],
  ["label_city", TEXT, WARP],
  ["label_city_capital", TEXT, WARP],
  ["label_state", TEXT, THREAD],
];

// Roads come in tunnel_/road_/bridge_ triplets with identical ids otherwise, so
// they're generated rather than listed three times.
const ROAD_TIERS: [suffix: string, fill: string, casing: string][] = [
  ["motorway", ROAD_MAJOR, ROAD_MAJOR_CASING],
  ["motorway_link", ROAD_MAJOR, ROAD_MAJOR_CASING],
  ["trunk_primary", ROAD_MAJOR, ROAD_MAJOR_CASING],
  ["secondary_tertiary", ROAD_MID, ROAD_MID_CASING],
  ["link", ROAD_MID, ROAD_MID_CASING],
  ["street", ROAD_MINOR, ROAD_MINOR_CASING],
  ["minor", ROAD_MINOR, ROAD_MINOR_CASING],
  ["service_track", ROAD_MINOR, ROAD_MINOR_CASING],
  ["path_pedestrian", ROAD_MINOR, ROAD_MINOR_CASING],
];

function roadPaints(): Paint[] {
  const out: Paint[] = [];
  for (const prefix of ["road", "tunnel", "bridge"]) {
    for (const [suffix, fill, casing] of ROAD_TIERS) {
      out.push([`${prefix}_${suffix}`, LINE, fill]);
      out.push([`${prefix}_${suffix}_casing`, LINE, casing]);
    }
  }
  return out;
}

const HILLSHADE_ID = "terrain-hillshade";

/**
 * Re-dye Liberty and add relief shading. Safe to call on every style load:
 * every write is guarded on the layer existing, and the hillshade is added once.
 *
 * `demSource` must already be on the map (MapView adds it in applyTerrain).
 */
export function applyWeaveBasemap(map: MapLibreMap, demSource: string) {
  // Relief first, so it sits under the road/label writes below and any failure
  // there still leaves the terrain readable.
  if (!map.getLayer(HILLSHADE_ID) && map.getSource(demSource)) {
    map.addLayer(
      {
        id: HILLSHADE_ID,
        type: "hillshade",
        source: demSource,
        paint: {
          // Warp in the shadows, bone on the lit faces — the same two threads
          // the chrome is woven from, so relief belongs to the identity rather
          // than sitting on top of it as grey.
          "hillshade-shadow-color": "rgba(22,19,15,0.30)",
          "hillshade-highlight-color": "rgba(255,251,242,0.22)",
          "hillshade-accent-color": "rgba(140,35,24,0.14)",
          "hillshade-exaggeration": 0.5,
        },
      },
      // Above the land fills, below water and roads: ridges get modelled,
      // carriageways and labels stay crisp.
      map.getLayer("waterway_tunnel") ? "waterway_tunnel" : undefined,
    );
  }

  for (const [id, prop, value] of [...PAINTS, ...roadPaints()]) {
    if (!map.getLayer(id)) continue;
    try {
      map.setPaintProperty(id, prop, value);
    } catch {
      // A Liberty update renamed or retyped this layer. Skip it — a basemap
      // that is partly the wrong colour beats a map that throws on load.
    }
  }
}
