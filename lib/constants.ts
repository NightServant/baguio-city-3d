// Static map + camera configuration for Baguio City 3D.
// Pure constants — safe to import anywhere (client or server).
import type { Position } from "@/types/geo";

/** City center in [longitude, latitude] order. */
export const BAGUIO_CENTER: Position = [120.596, 16.4023];

/** Geographic clamp for all spatial input, [minLng, minLat, maxLng, maxLat]. */
export const BAGUIO_BOUNDS: [number, number, number, number] = [
  120.5, 16.3, 120.7, 16.5,
];

export interface CameraView {
  center: Position;
  zoom: number;
  pitch: number;
  bearing: number;
}

/** Default opening camera framing the city core in 3D. */
export const DEFAULT_CAMERA: CameraView = {
  center: BAGUIO_CENTER,
  zoom: 13.5,
  pitch: 60,
  bearing: -20,
};

/** Named fly-to presets for signature locations. */
export const CAMERA_PRESETS: Record<string, CameraView> = {
  "burnham-park": {
    center: [120.5936, 16.4116],
    zoom: 15.5,
    pitch: 55,
    bearing: -25,
  },
  "session-road": {
    center: [120.5967, 16.4118],
    zoom: 16,
    pitch: 60,
    bearing: 30,
  },
  "mines-view": {
    center: [120.6305, 16.4145],
    zoom: 15,
    pitch: 65,
    bearing: -60,
  },
  "camp-john-hay": {
    center: [120.6187, 16.3956],
    zoom: 14.5,
    pitch: 55,
    bearing: 15,
  },
  "kennon-road": {
    center: [120.605, 16.365],
    zoom: 13,
    pitch: 70,
    bearing: -10,
  },
};

/** Cache TTLs (seconds) keyed by resource family. */
export const CACHE_TTLS = {
  terrain: 3600,
  transit: 3600,
  destinations: 300,
  venues: 300,
  history: 3600,
} as const;
