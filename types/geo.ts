// Shared geospatial types for Baguio City 3D.
// Pure types only — no runtime constants.

/** WGS84 position in [longitude, latitude] order. */
export type Position = [number, number];

/** A closed linear ring: first and last positions are identical. */
export type LinearRing = Position[];

export interface PointGeometry {
  type: "Point";
  coordinates: Position;
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: Position[];
}

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: LinearRing[];
}

export interface Feature<G, P> {
  type: "Feature";
  geometry: G;
  properties: P;
}

export interface FeatureCollection<F> {
  type: "FeatureCollection";
  features: F[];
}

/** Opening/closing hours for a place. `null` denotes always-open / 24-7 outdoor. */
export interface OpeningHours {
  open: string;
  close: string;
}

export type LandmarkCategory =
  | "NATURE"
  | "PARK"
  | "VIEWPOINT"
  | "HERITAGE"
  | "MARKET"
  | "MUSEUM"
  | "CHURCH"
  | "RECREATION";

export type Era =
  | "PRE_COLONIAL"
  | "AMERICAN_COLONIAL"
  | "POST_WAR"
  | "MODERN";

export interface LandmarkProperties {
  slug: string;
  name: string;
  description: string;
  category: LandmarkCategory;
  elevation_m: number;
  era: Era;
  hours: OpeningHours | null;
  meshUrl: string | null;
}

export type LandmarkFeature = Feature<PointGeometry, LandmarkProperties>;
export type LandmarkCollection = FeatureCollection<LandmarkFeature>;

export interface DistrictProperties {
  name: string;
}

export type DistrictFeature = Feature<PolygonGeometry, DistrictProperties>;
export type DistrictCollection = FeatureCollection<DistrictFeature>;
