// Helpers to assemble raw SQL rows (with `ST_AsGeoJSON(geom)::json` geometry)
// into GeoJSON Features / FeatureCollections. Coordinates are quantized to 5
// decimal places (~1.1 m) to shrink payloads for mobile-data users.
import type {
  Feature,
  FeatureCollection,
  LineStringGeometry,
  Position,
  PointGeometry,
} from "@/types/geo";

const PRECISION = 5;

function round(n: number): number {
  const scale = 10 ** PRECISION;
  return Math.round(n * scale) / scale;
}

function quantizePosition(pos: Position): Position {
  return [round(pos[0]), round(pos[1])];
}

/** Quantize any GeoJSON geometry's coordinates in place-free fashion. */
export function quantizeGeometry<G extends { type: string; coordinates: unknown }>(
  geom: G,
): G {
  const { type, coordinates } = geom;
  if (type === "Point") {
    return { ...geom, coordinates: quantizePosition(coordinates as Position) };
  }
  if (type === "LineString" || type === "MultiPoint") {
    return {
      ...geom,
      coordinates: (coordinates as Position[]).map(quantizePosition),
    };
  }
  if (type === "Polygon" || type === "MultiLineString") {
    return {
      ...geom,
      coordinates: (coordinates as Position[][]).map((ring) =>
        ring.map(quantizePosition),
      ),
    };
  }
  if (type === "MultiPolygon") {
    return {
      ...geom,
      coordinates: (coordinates as Position[][][]).map((poly) =>
        poly.map((ring) => ring.map(quantizePosition)),
      ),
    };
  }
  return geom;
}

/**
 * Build a Feature from a DB row shaped `{ geometry, ...properties }`. The
 * `geometry` key is peeled off; everything else becomes `properties`.
 */
export function rowToFeature<G, P>(
  row: { geometry: unknown } & Record<string, unknown>,
): Feature<G, P> {
  const { geometry, ...properties } = row;
  return {
    type: "Feature",
    geometry: quantizeGeometry(geometry as { type: string; coordinates: unknown }) as G,
    properties: properties as P,
  };
}

/** Wrap a list of features in a FeatureCollection. */
export function toFeatureCollection<F>(features: F[]): FeatureCollection<F> {
  return { type: "FeatureCollection", features };
}

/**
 * Convenience: assemble rows into a FeatureCollection with an explicit
 * `(row) -> { geometry, properties }` mapper.
 */
export function rowsToCollection<G, P>(
  rows: Array<Record<string, unknown>>,
  mapProperties: (row: Record<string, unknown>) => P,
): FeatureCollection<Feature<G, P>> {
  const features = rows.map((row) => {
    const geometry = row.geometry;
    return {
      type: "Feature" as const,
      geometry: quantizeGeometry(geometry as { type: string; coordinates: unknown }) as G,
      properties: mapProperties(row as Record<string, unknown>),
    };
  });
  return toFeatureCollection(features);
}

export type { PointGeometry, LineStringGeometry };
