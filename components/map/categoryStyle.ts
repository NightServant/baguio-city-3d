// Shared visual vocabulary for destination categories.
// Colors are literal hex (mapbox paint expressions can't read CSS variables),
// tuned to read as distinct pins against the muted 3D basemap.
import type { LandmarkCategory, Era, VenueCategory } from "@/types/api";

export const CATEGORY_COLORS: Record<LandmarkCategory, string> = {
  NATURE: "#2f9e6f",
  PARK: "#5bb85b",
  VIEWPOINT: "#3b82c4",
  HERITAGE: "#b8863b",
  MARKET: "#e0872e",
  MUSEUM: "#8b6bd6",
  CHURCH: "#c25a7a",
  RECREATION: "#d64f4f",
};

export const CATEGORY_LABELS: Record<LandmarkCategory, string> = {
  NATURE: "Nature",
  PARK: "Parks",
  VIEWPOINT: "Viewpoints",
  HERITAGE: "Heritage",
  MARKET: "Markets",
  MUSEUM: "Museums",
  CHURCH: "Churches",
  RECREATION: "Recreation",
};

export const LANDMARK_CATEGORIES = Object.keys(CATEGORY_COLORS) as LandmarkCategory[];

/** Flat [value, color, value, color, …] pairs for a mapbox `match` expression. */
export function categoryMatchExpression(): (string | string[])[] {
  const pairs: string[] = [];
  for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
    pairs.push(cat, color);
  }
  return pairs as unknown as (string | string[])[];
}

export const ERA_LABELS: Record<Era, string> = {
  PRE_COLONIAL: "Pre-colonial",
  AMERICAN_COLONIAL: "American colonial",
  POST_WAR: "Post-war",
  MODERN: "Modern",
};

export const VENUE_CATEGORY_LABELS: Record<VenueCategory, string> = {
  RESTAURANT: "Restaurant",
  HOTEL: "Hotel",
  TRANSIENT: "Transient",
  SOUVENIR: "Souvenir",
  FOOD_SHOP: "Food shop",
};

export const PRICE_GLYPHS: Record<number, string> = {
  1: "₱",
  2: "₱₱",
  3: "₱₱₱",
  4: "₱₱₱₱",
};
