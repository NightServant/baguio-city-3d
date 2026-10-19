import { describe, expect, it } from "vitest";
import { modelMatrix, tmScale, WEB_MERCATOR_SCALE } from "@/lib/map/modelTransform";

// Apply a column-major 4x4 to a point.
const apply = (m: number[], [x, y, z]: number[]) => [0, 1, 2].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
const A = { x: 0.8, y: 0.45, z: 1e-5 };

describe("modelMatrix", () => {
  it("maps glTF east, up and south onto Mercator x, z and y at heading 0", () => {
    const m = modelMatrix(A, 2, 0);
    close(apply(m, [1, 0, 0]), [0.8 + 2, 0.45, 1e-5]); // +X east
    close(apply(m, [0, 1, 0]), [0.8, 0.45, 1e-5 + 2]); // +Y up
    close(apply(m, [0, 0, 1]), [0.8, 0.45 + 2, 1e-5]); // +Z is south in glTF (north is -Z); Mercator y grows south
  });
  it("keeps heights in true metres (the terrain exaggeration is baked into the ground fit)", () => {
    const m = modelMatrix(A, 1, 0);
    close(apply(m, [0, 10, 0]), [0.8, 0.45, 1e-5 + 10]);
    close(apply(m, [10, 0, 0]), [0.8 + 10, 0.45, 1e-5]);
  });
  it("turns clockwise from north by the heading", () => {
    const m = modelMatrix(A, 1, 90);
    close(apply(m, [0, 0, -1]), [0.8 + 1, 0.45, 1e-5]); // the model's north now points east
  });
});

// The tiles and landmarks are built in metres of a transverse Mercator on WGS84 (model/scripts/common.py LOCAL_TM);
// the flora in Web Mercator metres (build_flora.py, 2π × 6378137). MapLibre's metre is the mean radius's
// (maplibre-gl earthRadius 6371008.8), so each frame needs its own east and north factors to land true. Without
// them a z18 tile was 0.48% short north-south, leaving a 0.7 m gap along every tile edge (2026-10-19).
describe("model frames on the ellipsoid", () => {
  const LAT = 16.4123;
  const phi = (LAT * Math.PI) / 180;
  const unit = 1 / (2 * Math.PI * 6371008.8 * Math.cos(phi)); // anchor.meterInMercatorCoordinateUnits()
  const mercY = (lat: number) => (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2;
  const e2 = 0.00669437999014, w = 1 - e2 * Math.sin(phi) ** 2;
  const M = (6378137 * (1 - e2)) / w ** 1.5, N = 6378137 / Math.sqrt(w); // meridian and prime-vertical radii
  const O = { x: 0, y: 0, z: 0 };

  it("puts a point 100 m north (WGS84 metres) at its true Mercator latitude", () => {
    const k = tmScale(LAT);
    const dy = apply(modelMatrix(O, unit, 0, k.east, k.north), [0, 0, -100])[1];
    const want = mercY(LAT + ((100 / M) * 180) / Math.PI) - mercY(LAT);
    // 5 decimals: a linear placement can't follow Mercator's own curvature, ½·tanφ·Δφ = 2.3e-6 over 100 m
    expect(dy / want).toBeCloseTo(1, 5);
  });
  it("puts a point 100 m east (WGS84 metres) at its true Mercator longitude", () => {
    const k = tmScale(LAT);
    const dx = apply(modelMatrix(O, unit, 0, k.east, k.north), [100, 0, 0])[0];
    expect(dx / (100 / (N * Math.cos(phi)) / (2 * Math.PI))).toBeCloseTo(1, 6);
  });
  it("keeps Web Mercator metres (the flora) true", () => {
    const dx = apply(modelMatrix(O, unit, 0, WEB_MERCATOR_SCALE, WEB_MERCATOR_SCALE), [1000, 0, 0])[0];
    expect(dx / (1000 / (40_075_016.686 * Math.cos(phi)))).toBeCloseTo(1, 9);
  });
});
