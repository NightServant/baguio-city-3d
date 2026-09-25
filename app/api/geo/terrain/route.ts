// GET /api/geo/terrain
// Static map/camera configuration. No DB — pure constants.
import { jsonWithCache } from "@/lib/http";
import {
  BAGUIO_CENTER,
  BAGUIO_BOUNDS,
  DEFAULT_CAMERA,
  CAMERA_PRESETS,
  CACHE_TTLS,
} from "@/lib/constants";
import { TERRAIN_EXAGGERATION } from "@/lib/map/sources";
import type { TerrainConfig } from "@/types/api";

export async function GET() {
  const body: TerrainConfig = {
    center: BAGUIO_CENTER,
    bounds: BAGUIO_BOUNDS,
    camera: DEFAULT_CAMERA,
    presets: CAMERA_PRESETS,
    demSource: {
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 15,
    },
    exaggeration: TERRAIN_EXAGGERATION,
  };
  return jsonWithCache(body, CACHE_TTLS.terrain);
}
