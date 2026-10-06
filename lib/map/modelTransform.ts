// Column-major 4x4 taking a glTF model's local metres (+X east, +Y up, -Z north; contract C2)
// to MapLibre's Mercator world (x east, y south, z up). `anchor` is the MercatorCoordinate of the
// model's origin; `metreScale` is anchor.meterInMercatorCoordinateUnits(); `rotationDeg` turns the model
// clockwise from north. Heights stay true metres: the models bake the terrain exaggeration into their
// ground fit only (model/blender/lm_common.py EXAG), so buildings keep their real size on stretched relief.
export function modelMatrix(
  anchor: { x: number; y: number; z: number },
  metreScale: number,
  rotationDeg: number,
): number[] {
  const t = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(t) * metreScale;
  const s = Math.sin(t) * metreScale;
  return [c, s, 0, 0, 0, 0, metreScale, 0, -s, c, 0, 0, anchor.x, anchor.y, anchor.z, 1];
}
