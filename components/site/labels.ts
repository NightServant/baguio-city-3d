// Shared display labels for enum-ish content values.
import type { Era, LandmarkCategory } from "@/types/geo";
import type { VenueCategory } from "@/types/venue";

export const ERA_LABELS: Record<Era, string> = {
  PRE_COLONIAL: "Ibaloi highlands",
  AMERICAN_COLONIAL: "American era",
  POST_WAR: "Post-war",
  MODERN: "Contemporary",
};

export const ERA_YEARS: Record<Era, string> = {
  PRE_COLONIAL: "before 1900",
  AMERICAN_COLONIAL: "1900–1941",
  POST_WAR: "1942–1989",
  MODERN: "1990–today",
};

export const CATEGORY_LABELS: Record<LandmarkCategory, string> = {
  NATURE: "Nature",
  PARK: "Park",
  VIEWPOINT: "Viewpoint",
  HERITAGE: "Heritage",
  MARKET: "Market",
  MUSEUM: "Museum",
  CHURCH: "Church",
  RECREATION: "Recreation",
};

export const VENUE_CATEGORY_LABELS: Record<VenueCategory, string> = {
  RESTAURANT: "Restaurants",
  FOOD_SHOP: "Food shops",
  HOTEL: "Hotels",
  TRANSIENT: "Transient houses",
  SOUVENIR: "Souvenirs",
};

export const VENUE_CATEGORY_SINGULAR: Record<VenueCategory, string> = {
  RESTAURANT: "Restaurant",
  FOOD_SHOP: "Food shop",
  HOTEL: "Hotel",
  TRANSIENT: "Transient house",
  SOUVENIR: "Souvenir shop",
};

/** Format a coordinate pair as a survey readout, e.g. `16.4116° N · 120.5936° E`. */
export function formatCoord(lng: number, lat: number): string {
  return `${lat.toFixed(4)}° N · ${lng.toFixed(4)}° E`;
}

/** Format elevation, e.g. `1,445 m`. */
export function formatElevation(m: number): string {
  return `${m.toLocaleString("en-PH")} m`;
}
