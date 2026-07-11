// Shared visual vocabulary for the map layers — the single source of truth for
// every literal hex the MapLibre paint expressions use (paint can't read CSS
// variables). Values are hand-reconciled to the site palette in app/globals.css:
// pine greens (primary), fog-tinted cool neutrals, and a warm sunset amber —
// while staying distinct and legible against the light OpenFreeMap basemap.
import type { LandmarkCategory, Era, VenueCategory } from "@/types/api";

// Category pins — a spectrum that leans into the theme's pine + amber register
// while keeping eight visually separable hues.
export const CATEGORY_COLORS: Record<LandmarkCategory, string> = {
  NATURE: "#2f8f66", // deep pine (primary family)
  PARK: "#6aa855", // meadow green
  VIEWPOINT: "#3f7fb0", // fog blue
  HERITAGE: "#b5813a", // heritage tan (amber family)
  MARKET: "#d67a2c", // market orange
  MUSEUM: "#8168c0", // muted violet
  CHURCH: "#bf5a76", // strawberry rose
  RECREATION: "#cf4d4d", // clay red
};

/**
 * Non-category map paint. Centralized here so the marker, transit, history, and
 * landmark layers all draw from one harmonized palette.
 */
export const MAP_PALETTE = {
  // Clustered markers + point defaults.
  cluster: "#cf7f38", // warm amber cluster bubble
  clusterStroke: "rgba(255,255,255,0.85)",
  markerDefault: "#7d8a90", // fog neutral for unknown categories
  markerStroke: "rgba(255,255,255,0.9)",
  label: "#ffffff",
  labelHalo: "rgba(26,36,30,0.6)", // pine-tinted dark halo
  // Jeepney route lines.
  transit: {
    inactive: "#7d8a95", // quiet fog thread
    activeCasing: "#e6a94a", // marching-ants amber casing
    active: "#d68a34", // active route amber
    stopFill: "#ffffff",
    stopStroke: "#d68a34",
  },
  // Timeline era / historical events.
  era: {
    eventIcon: "#d9a441", // amber event dot
    eventText: "#f2e5c8", // warm cream label
    eventHalo: "rgba(38,26,12,0.82)", // dark umber halo
  },
  // Landmark fill-extrusion scaffold.
  landmark: "#c9772e",
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
