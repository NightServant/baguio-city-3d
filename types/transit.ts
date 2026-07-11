// Transit (jeepney) types for Baguio City 3D.
// Pure types only — no runtime constants.

import type { Feature, FeatureCollection, LineStringGeometry, Position } from "./geo";

export type TransitKind = "JEEPNEY";

export interface TransitStop {
  name: string;
  seq: number;
  coord: Position;
}

export interface JeepneyRouteProperties {
  code: string;
  name: string;
  kind: TransitKind;
  fareBase: number;
  farePerKm: number;
  stops: TransitStop[];
}

export type JeepneyRouteFeature = Feature<LineStringGeometry, JeepneyRouteProperties>;
export type JeepneyRouteCollection = FeatureCollection<JeepneyRouteFeature>;
