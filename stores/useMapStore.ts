"use client";

// Central client store for the interactive map page.
// Slice-organized: map instance, camera, filters, transit, timeline, ui.
// Non-serializable map instance lives here so panels (rendered outside the map
// subtree) can issue imperative camera commands via getState().
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Era, LandmarkCategory, PriceRange, FareMode, FareResponse } from "@/types/api";
import { DEFAULT_CAMERA } from "@/lib/constants";

export type SheetKind = "destination" | "filters" | "transit" | "timeline" | null;

export type LngLat = [number, number];
export type Bounds = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

export interface CameraState {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
  bounds: Bounds | null;
}

export interface FiltersState {
  categories: LandmarkCategory[];
  era: Era | null;
  priceMax: PriceRange | null;
  openNow: boolean;
  q: string;
}

export interface FareQuery {
  mode: FareMode;
  from: LngLat | null;
  to: LngLat | null;
  /** When set, the next map click is captured into `from` or `to`. */
  picking: "from" | "to" | null;
}

export interface TransitState {
  activeRouteCode: string | null;
  fareQuery: FareQuery;
  fareResult: FareResponse | null;
}

export interface TimelineState {
  activeEra: Era | null;
}

export type Basemap = "terrain" | "satellite";

export interface UiState {
  selectedSlug: string | null;
  activeSheet: SheetKind;
  /** Active basemap: vector Liberty terrain vs. Esri satellite imagery. */
  basemap: Basemap;
  /**
   * Bumped on every MapLibre `style.load`. `setStyle` destroys all sources,
   * layers and terrain, so app layers must be re-added afterward. MapLayers is
   * keyed by this counter, so a bump remounts every layer hook — running each
   * cleanup (off handlers, remove) then re-adding sources/layers on the fresh
   * style, which also dedupes delegated event handlers.
   */
  styleGeneration: number;
}

interface MapStore {
  map: MapLibreMap | null;
  camera: CameraState;
  filters: FiltersState;
  transit: TransitState;
  timeline: TimelineState;
  ui: UiState;

  // map instance
  setMap: (map: MapLibreMap | null) => void;

  // camera
  setCamera: (partial: Partial<Omit<CameraState, "bounds">>) => void;
  setBounds: (bounds: Bounds) => void;

  // filters
  toggleCategory: (category: LandmarkCategory) => void;
  setEra: (era: Era | null) => void;
  setPriceMax: (priceMax: PriceRange | null) => void;
  setOpenNow: (openNow: boolean) => void;
  setQ: (q: string) => void;
  resetFilters: () => void;

  // transit
  setActiveRouteCode: (code: string | null) => void;
  setFareQuery: (partial: Partial<FareQuery>) => void;
  setFareResult: (result: FareResponse | null) => void;

  // timeline
  setActiveEra: (era: Era | null) => void;

  // ui
  setSelectedSlug: (slug: string | null) => void;
  openSheet: (sheet: SheetKind) => void;
  closeSheet: () => void;
  selectDestination: (slug: string) => void;
  setBasemap: (basemap: Basemap) => void;
  bumpStyleGeneration: () => void;
}

const INITIAL_FILTERS: FiltersState = {
  categories: [],
  era: null,
  priceMax: null,
  openNow: false,
  q: "",
};

export const useMapStore = create<MapStore>((set) => ({
  map: null,
  camera: {
    center: DEFAULT_CAMERA.center as LngLat,
    zoom: DEFAULT_CAMERA.zoom,
    pitch: DEFAULT_CAMERA.pitch,
    bearing: DEFAULT_CAMERA.bearing,
    bounds: null,
  },
  filters: { ...INITIAL_FILTERS },
  transit: {
    activeRouteCode: null,
    fareQuery: { mode: "jeepney", from: null, to: null, picking: null },
    fareResult: null,
  },
  timeline: { activeEra: null },
  ui: { selectedSlug: null, activeSheet: null, basemap: "terrain", styleGeneration: 0 },

  setMap: (map) => set({ map }),

  setCamera: (partial) =>
    set((s) => ({ camera: { ...s.camera, ...partial } })),
  setBounds: (bounds) => set((s) => ({ camera: { ...s.camera, bounds } })),

  toggleCategory: (category) =>
    set((s) => {
      const has = s.filters.categories.includes(category);
      return {
        filters: {
          ...s.filters,
          categories: has
            ? s.filters.categories.filter((c) => c !== category)
            : [...s.filters.categories, category],
        },
      };
    }),
  setEra: (era) => set((s) => ({ filters: { ...s.filters, era } })),
  setPriceMax: (priceMax) => set((s) => ({ filters: { ...s.filters, priceMax } })),
  setOpenNow: (openNow) => set((s) => ({ filters: { ...s.filters, openNow } })),
  setQ: (q) => set((s) => ({ filters: { ...s.filters, q } })),
  resetFilters: () => set({ filters: { ...INITIAL_FILTERS } }),

  setActiveRouteCode: (code) =>
    set((s) => ({ transit: { ...s.transit, activeRouteCode: code } })),
  setFareQuery: (partial) =>
    set((s) => ({ transit: { ...s.transit, fareQuery: { ...s.transit.fareQuery, ...partial } } })),
  setFareResult: (result) =>
    set((s) => ({ transit: { ...s.transit, fareResult: result } })),

  setActiveEra: (era) => set(() => ({ timeline: { activeEra: era } })),

  setSelectedSlug: (slug) => set((s) => ({ ui: { ...s.ui, selectedSlug: slug } })),
  openSheet: (sheet) => set((s) => ({ ui: { ...s.ui, activeSheet: sheet } })),
  closeSheet: () => set((s) => ({ ui: { ...s.ui, activeSheet: null } })),
  selectDestination: (slug) =>
    set((s) => ({ ui: { ...s.ui, selectedSlug: slug, activeSheet: "destination" } })),
  setBasemap: (basemap) => set((s) => ({ ui: { ...s.ui, basemap } })),
  bumpStyleGeneration: () =>
    set((s) => ({ ui: { ...s.ui, styleGeneration: s.ui.styleGeneration + 1 } })),
}));

// ---------------------------------------------------------------------------
// Granular selector hooks
// ---------------------------------------------------------------------------

export const useCamera = () => useMapStore((s) => s.camera);
export const useFilters = () => useMapStore(useShallow((s) => s.filters));
export const useTransit = () => useMapStore(useShallow((s) => s.transit));
export const useTimeline = () => useMapStore((s) => s.timeline);
export const useActiveEra = () => useMapStore((s) => s.timeline.activeEra);
export const useSelectedSlug = () => useMapStore((s) => s.ui.selectedSlug);
export const useActiveSheet = () => useMapStore((s) => s.ui.activeSheet);
export const useActiveRouteCode = () => useMapStore((s) => s.transit.activeRouteCode);
export const useBasemap = () => useMapStore((s) => s.ui.basemap);
export const useStyleGeneration = () => useMapStore((s) => s.ui.styleGeneration);

/** Stable bag of every action. Actions are defined once, so this never changes identity per-field. */
export const useMapActions = () =>
  useMapStore(
    useShallow((s) => ({
      setMap: s.setMap,
      setCamera: s.setCamera,
      setBounds: s.setBounds,
      toggleCategory: s.toggleCategory,
      setEra: s.setEra,
      setPriceMax: s.setPriceMax,
      setOpenNow: s.setOpenNow,
      setQ: s.setQ,
      resetFilters: s.resetFilters,
      setActiveRouteCode: s.setActiveRouteCode,
      setFareQuery: s.setFareQuery,
      setFareResult: s.setFareResult,
      setActiveEra: s.setActiveEra,
      setSelectedSlug: s.setSelectedSlug,
      openSheet: s.openSheet,
      closeSheet: s.closeSheet,
      selectDestination: s.selectDestination,
      setBasemap: s.setBasemap,
      bumpStyleGeneration: s.bumpStyleGeneration,
    })),
  );
