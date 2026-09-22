// Shared visual vocabulary for the map layers — the single source of truth for
// every literal hex the MapLibre paint expressions use (paint can't read CSS
// variables). Reconciled to the "Cordillera Weave" identity in app/globals.css.
import type { LandmarkCategory, Era, VenueCategory } from "@/types/api";

// Category pins are DATA, not brand: eight categories need eight separable
// hues, so they can't collapse to the three-colour chrome palette. They are
// drawn instead from the natural dyestuffs those textiles are coloured with —
// madder, ochre, indigo, annatto, logwood, cochineal — which keeps them
// separable, legible on the light basemap, and of a piece with the identity.
export const CATEGORY_COLORS: Record<LandmarkCategory, string> = {
  NATURE: "#7A7A45", // weld — olive-gold
  PARK: "#A38B3C", // ochre
  VIEWPOINT: "#3E5F7E", // indigo
  HERITAGE: "#8C6239", // umber
  MARKET: "#C4622D", // annatto
  MUSEUM: "#6B4A6B", // logwood
  CHURCH: "#A34458", // cochineal
  RECREATION: "#B5432F", // madder, lightened
};

/**
 * Non-category map paint. Centralized here so the marker, transit, history, and
 * landmark layers all draw from one harmonized palette.
 */
export const MAP_PALETTE = {
  // Cordillera Weave triad: warp #16130F, bone #F5F0E6, madder #8C2318.
  // Map paint is deliberately limited to these three so the HUD and the
  // terrain read as one object. Terrain supplies all other colour.
  // Clustered markers + point defaults.
  cluster: "#8C2318", // madder cluster bubble
  clusterStroke: "rgba(245,240,230,0.9)", // bone
  markerDefault: "#4A4238", // neutral warp-grey for unknown categories
  markerStroke: "rgba(245,240,230,0.92)",
  label: "#F5F0E6",
  labelHalo: "rgba(22,19,15,0.72)", // warp halo
  // Jeepney route lines.
  transit: {
    inactive: "#6B6156", // quiet warp thread
    activeCasing: "#B5432F", // marching-ants madder casing
    active: "#8C2318",
    stopFill: "#F5F0E6",
    stopStroke: "#8C2318",
  },
  // Timeline era / historical events.
  era: {
    eventIcon: "#8C2318",
    eventText: "#F5F0E6",
    eventHalo: "rgba(22,19,15,0.85)",
  },
  // Landmark fill-extrusion scaffold.
  landmark: "#8C2318",
} as const;

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

/** Flat [value, color, value, color, …] pairs for a MapLibre `match` expression. */
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
