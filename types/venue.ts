// Venue types for Baguio City 3D.
// Pure types only — no runtime constants.

import type { Feature, FeatureCollection, OpeningHours, PointGeometry } from "./geo";

export type VenueCategory =
  | "RESTAURANT"
  | "HOTEL"
  | "TRANSIENT"
  | "SOUVENIR"
  | "FOOD_SHOP";

/** 1 (budget) through 4 (premium). */
export type PriceRange = 1 | 2 | 3 | 4;

export interface VenueProperties {
  slug: string;
  name: string;
  category: VenueCategory;
  priceRange: PriceRange;
  amenities: string[];
  hours: OpeningHours | null;
  description: string;
}

export type VenueFeature = Feature<PointGeometry, VenueProperties>;
export type VenueCollection = FeatureCollection<VenueFeature>;
