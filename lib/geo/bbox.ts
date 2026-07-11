// Parsing + validation for spatial query params.
import { BAGUIO_BOUNDS } from "@/lib/constants";

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

const [CLAMP_MIN_LNG, CLAMP_MIN_LAT, CLAMP_MAX_LNG, CLAMP_MAX_LAT] = BAGUIO_BOUNDS;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Parse a `bbox=minLng,minLat,maxLng,maxLat` string. Returns `null` when the
 * param is absent (a valid "no filter" state). Throws `Error` on malformed
 * input so the route can map it to a 400. Coordinates are clamped to the
 * Baguio region so a client can never request the whole planet.
 */
export function parseBBox(raw: string | null): BBox | null {
  if (raw === null || raw.trim() === "") return null;

  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error("bbox must be four numbers: minLng,minLat,maxLng,maxLat");
  }

  let [minLng, minLat, maxLng, maxLat] = parts;

  // Normalise inverted extents before clamping.
  if (minLng > maxLng) [minLng, maxLng] = [maxLng, minLng];
  if (minLat > maxLat) [minLat, maxLat] = [maxLat, minLat];

  return {
    minLng: clamp(minLng, CLAMP_MIN_LNG, CLAMP_MAX_LNG),
    minLat: clamp(minLat, CLAMP_MIN_LAT, CLAMP_MAX_LAT),
    maxLng: clamp(maxLng, CLAMP_MIN_LNG, CLAMP_MAX_LNG),
    maxLat: clamp(maxLat, CLAMP_MIN_LAT, CLAMP_MAX_LAT),
  };
}

/**
 * Parse a `zoom` integer, clamped to the Mapbox range 1–22. Returns
 * `fallback` when absent; throws on non-numeric input.
 */
export function parseZoom(raw: string | null, fallback = 14): number {
  if (raw === null || raw.trim() === "") return fallback;
  const z = Number(raw);
  if (!Number.isFinite(z)) {
    throw new Error("zoom must be a number");
  }
  return clamp(Math.round(z), 1, 22);
}
