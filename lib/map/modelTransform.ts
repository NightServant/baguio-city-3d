// Column-major 4x4 taking a glTF model's local metres (+X east, +Y up, -Z north; contract C2)
// to MapLibre's Mercator world (x east, y south, z up). `anchor` is the MercatorCoordinate of the
// model's origin; `metreScale` is anchor.meterInMercatorCoordinateUnits(); only height is
// multiplied by the terrain exaggeration; `rotationDeg` turns the model clockwise from north.
export function modelMatrix(
  anchor: { x: number; y: number; z: number },
  metreScale: number,
  exaggeration: number,
  rotationDeg: number,
): number[] {
  const t = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(t) * metreScale;
  const s = Math.sin(t) * metreScale;
  return [c, s, 0, 0, 0, 0, metreScale * exaggeration, 0, -s, c, 0, 0, anchor.x, anchor.y, anchor.z, 1];
}
