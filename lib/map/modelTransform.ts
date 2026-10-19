// Column-major 4x4 taking a glTF model's local metres (+X east, +Y up, -Z north; contract C2)
// to MapLibre's Mercator world (x east, y south, z up). `anchor` is the MercatorCoordinate of the
// model's origin; `metreScale` is anchor.meterInMercatorCoordinateUnits(); `rotationDeg` turns the model
// clockwise from north. Heights stay true metres: the models bake the terrain exaggeration into their
// ground fit only (model/blender/lm_common.py EXAG), so buildings keep their real size on stretched relief.
// `east`/`north` scale the horizontal metres after the turn, for a model built in another metre than MapLibre's
// (tmScale, WEB_MERCATOR_SCALE).
export function modelMatrix(
  anchor: { x: number; y: number; z: number },
  metreScale: number,
  rotationDeg: number,
  east = 1,
  north = 1,
): number[] {
  const t = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(t) * metreScale;
  const s = Math.sin(t) * metreScale;
  return [c * east, s * north, 0, 0, 0, 0, metreScale, 0, -s * east, c * north, 0, 0, anchor.x, anchor.y, anchor.z, 1];
}

// MapLibre's metre is the mean earth radius's (maplibre-gl earthRadius, 6371008.8 m). The tiles and landmarks are built
// in a transverse Mercator on WGS84 (model/scripts/common.py LOCAL_TM, centred on the city), whose metres follow the
// ellipsoid's radii of curvature; the flora in Web Mercator metres (2π × 6378137, build_flora.py).
const R_MAPLIBRE = 6371008.8;
const A = 6378137, E2 = 0.00669437999014; // WGS84

/** East and north factors from WGS84 metres at `latDeg` to MapLibre metres (prime vertical and meridian radii). */
export function tmScale(latDeg: number): { east: number; north: number } {
  const w = 1 - E2 * Math.sin((latDeg * Math.PI) / 180) ** 2;
  return { east: R_MAPLIBRE / (A / Math.sqrt(w)), north: R_MAPLIBRE / ((A * (1 - E2)) / w ** 1.5) };
}

/** From Web Mercator metres (equatorial radius) to MapLibre metres. */
export const WEB_MERCATOR_SCALE = R_MAPLIBRE / A;
