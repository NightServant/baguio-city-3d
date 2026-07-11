// API request/response contracts for Baguio City 3D.
//
// Wave 3 (client + stores) imports from this file. These interfaces describe
// exactly what each route handler under app/api/ returns. Where a shape already
// exists in the domain type modules we reuse it rather than redefine.
import type {
  Feature,
  FeatureCollection,
  PointGeometry,
  LineStringGeometry,
  Position,
  OpeningHours,
  LandmarkCategory,
  Era,
} from "./geo";
import type { VenueCategory, PriceRange } from "./venue";

export type { Era, LandmarkCategory } from "./geo";
export type { VenueCategory, PriceRange } from "./venue";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface MediaItem {
  id: string;
  url: string;
  kind: string;
  alt: string;
}

export interface CameraView {
  center: Position;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface ErrorResponse {
  error: string;
}

// ---------------------------------------------------------------------------
// GET /api/geo/destinations
// ---------------------------------------------------------------------------

export interface DestinationListProps {
  id: string;
  slug: string;
  name: string;
  category: LandmarkCategory;
  era: Era | null;
  elevationM: number | null;
  hasHours: boolean;
}

export type DestinationListFeature = Feature<PointGeometry, DestinationListProps>;
export type DestinationsResponse = FeatureCollection<DestinationListFeature>;

// ---------------------------------------------------------------------------
// GET /api/geo/destinations/[slug]
// ---------------------------------------------------------------------------

export interface LandmarkInfo {
  meshUrl: string;
  meshScale: number;
  rotationDeg: number;
  altitudeM: number;
}

export interface DestinationDetailProps {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: LandmarkCategory;
  era: Era | null;
  elevationM: number | null;
  hasHours: boolean;
  hours: OpeningHours | null;
  media: MediaItem[];
  landmark: LandmarkInfo | null;
}

export type DestinationFeature = Feature<PointGeometry, DestinationDetailProps>;

// ---------------------------------------------------------------------------
// GET /api/geo/transit/routes
// ---------------------------------------------------------------------------

export type TransitRouteKind = "JEEPNEY" | "TAXI_SIM";

export interface TransitStopLite {
  name: string;
  seq: number;
  lng: number;
  lat: number;
}

export interface TransitRouteProps {
  id: string;
  code: string;
  name: string;
  kind: TransitRouteKind;
  fareBase: number;
  farePerKm: number;
  stops: TransitStopLite[];
}

export type TransitRouteFeature = Feature<LineStringGeometry, TransitRouteProps>;
export type TransitRoutesResponse = FeatureCollection<TransitRouteFeature>;

// ---------------------------------------------------------------------------
// GET /api/geo/transit/fare
// ---------------------------------------------------------------------------

export type FareMode = "jeepney" | "taxi";

export interface FareResponse {
  mode: FareMode;
  distanceKm: number;
  fare: number;
  breakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// GET /api/venues
// ---------------------------------------------------------------------------

export interface VenueListItem {
  id: string;
  slug: string;
  name: string;
  category: VenueCategory;
  priceRange: PriceRange;
  description: string;
  lng: number;
  lat: number;
  hours: OpeningHours | null;
}

export interface VenuesResponse {
  items: VenueListItem[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// GET /api/venues/[id]
// ---------------------------------------------------------------------------

export interface VenueDetail {
  id: string;
  slug: string;
  name: string;
  category: VenueCategory;
  priceRange: PriceRange;
  amenities: string[] | null;
  hours: OpeningHours | null;
  description: string;
  lng: number;
  lat: number;
  media: MediaItem[];
}

// ---------------------------------------------------------------------------
// GET /api/history/eras
// ---------------------------------------------------------------------------

export interface EraEvent {
  id: string;
  title: string;
  year: number;
  description: string;
  lng?: number;
  lat?: number;
}

export interface EraWithEvents {
  key: Era;
  name: string;
  startYear: number;
  endYear: number | null;
  summary: string;
  events: EraEvent[];
}

export interface ErasResponse {
  eras: EraWithEvents[];
}

// ---------------------------------------------------------------------------
// GET /api/geo/terrain
// ---------------------------------------------------------------------------

export interface TerrainConfig {
  center: Position;
  bounds: [number, number, number, number];
  camera: CameraView;
  presets: Record<string, CameraView>;
  demSource: "mapbox-dem";
  exaggeration: number;
}
