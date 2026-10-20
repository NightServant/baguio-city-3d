// A lighter map for touch phones (the owner's Realme 10 4G, Mali-G57 MC2, dropped frames while panning; 2026-10-20).
// Measured on software GL as a weak-GPU stand-in (a city-view frame, ESTIMATE of the phone's share): 3D terrain was two
// thirds of it; its mesh from 128 to 64 cells and the pixel ratio from 2 to 1.5 cut it by about a quarter.
// ?quality=high (or low) overrides the guess, to compare on a phone.
import { LngLat, type Map as MapLibreMap, type PointLike } from "maplibre-gl";

export interface MapProfile { light: boolean; pixelRatio: number; terrainMesh: number }

export function mapProfile(d: { coarsePointer: boolean; minScreenPx: number; dpr: number; quality: string | null }): MapProfile {
  const light = d.quality === "high" ? false : d.quality === "low" ? true : d.coarsePointer && d.minScreenPx < 700;
  return { light, pixelRatio: Math.min(d.dpr, light ? 1.5 : 2), terrainMesh: light ? 64 : 128 };
}

/** This device's profile (browser only). */
export function deviceMapProfile(): MapProfile {
  return mapProfile({
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    minScreenPx: Math.min(screen.width, screen.height),
    dpr: window.devicePixelRatio,
    quality: new URLSearchParams(location.search).get("quality"),
  });
}

/** MapLibre builds every mouse and touch event with map.unproject(point), and with 3D terrain that reads a pixel back
 *  from the GPU (Terrain.pointCoordinate: gl.readPixels), stalling the GPU pipeline on every event while a finger pans
 *  (maplibre-gl 5.24 src/ui/events.ts:551 and 627-631; 6.15 the same). Positions become lazy: the read happens only when
 *  something reads lng or lat (fare picking does, on a click), and it is the same terrain-aware answer as before. */
export function lazyUnproject(map: Pick<MapLibreMap, "unproject">) {
  const unproject = map.unproject.bind(map);
  map.unproject = (point: PointLike) => {
    let v: LngLat | null = null;
    const get = () => (v ??= unproject(point));
    return Object.create(LngLat.prototype, {
      lng: { get: () => get().lng, enumerable: true },
      lat: { get: () => get().lat, enumerable: true },
    }) as LngLat;
  };
}
