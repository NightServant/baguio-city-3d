"use client";

// The MapLibre GL canvas. Initializes the 3D terrain map, wires camera state
// back into the store, and mounts the imperative layers once the style is ready.
// Uses OpenFreeMap tiles + AWS Terrarium terrain — no account, key, or token.
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type MapMouseEvent } from "maplibre-gl";
import { useMapStore } from "@/stores/useMapStore";
import { BAGUIO_BOUNDS, DEFAULT_CAMERA } from "@/lib/constants";
import type { TerrainConfig } from "@/types/api";
import { MapLayers } from "./MapLayers";

// Keyless basemap style (OpenFreeMap "Liberty"). No token required.
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const DEM_SOURCE = "terrain-dem";

/** Expand [minLng,minLat,maxLng,maxLat] outward so panning has a little slack. */
function expandBounds(
  b: [number, number, number, number],
  pad = 0.03,
): [[number, number], [number, number]] {
  return [
    [b[0] - pad, b[1] - pad],
    [b[2] + pad, b[3] + pad],
  ];
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: DEFAULT_CAMERA.center as [number, number],
      zoom: DEFAULT_CAMERA.zoom,
      pitch: DEFAULT_CAMERA.pitch,
      bearing: DEFAULT_CAMERA.bearing,
      maxBounds: expandBounds(BAGUIO_BOUNDS),
      maxPitch: 80,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    useMapStore.getState().setMap(map);

    const applyTerrain = (m: MapLibreMap, exag: number) => {
      if (!m.getSource(DEM_SOURCE)) {
        // AWS Open Data Terrain Tiles (Terrarium encoding) — free, keyless.
        m.addSource(DEM_SOURCE, {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 15,
          attribution:
            "Terrain © <a href='https://github.com/tilezen/joerd/blob/master/docs/attribution.md'>Mapzen / Tilezen</a>, AWS Open Data",
        });
      }
      m.setTerrain({ source: DEM_SOURCE, exaggeration: exag });
      // Cheap atmospheric sky/fog for the 3D horizon (MapLibre 5+ supports setSky).
      try {
        map.setSky({
          "sky-color": "#a7c4e0",
          "horizon-color": "#eaf1f7",
          "fog-color": "#dfe7ee",
          "sky-horizon-blend": 0.6,
          "horizon-fog-blend": 0.5,
          "fog-ground-blend": 0.4,
        });
      } catch {
        /* older MapLibre without setSky — atmosphere is optional */
      }
    };

    // Pull terrain config (works without a DB — pure constants), fall back safely.
    let exaggeration = 1.35;
    fetch("/api/geo/terrain")
      .then((res) => (res.ok ? (res.json() as Promise<TerrainConfig>) : null))
      .then((cfg) => {
        if (cfg) exaggeration = cfg.exaggeration;
      })
      .catch(() => {})
      .finally(() => {
        if (!map.isStyleLoaded()) return;
        applyTerrain(map, exaggeration);
      });

    const onStyleLoad = () => {
      applyTerrain(map, exaggeration);
      setReady(true);
    };
    map.on("style.load", onStyleLoad);

    // Debounced camera -> store sync.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onMoveEnd = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const c = map.getCenter();
        const b = map.getBounds();
        useMapStore.getState().setCamera({
          center: [c.lng, c.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        });
        if (b) {
          useMapStore.getState().setBounds([
            b.getWest(),
            b.getSouth(),
            b.getEast(),
            b.getNorth(),
          ]);
        }
      }, 300);
    };
    map.on("moveend", onMoveEnd);

    // Seed initial bounds so the first marker fetch fires.
    const onLoad = () => {
      const b = map.getBounds();
      if (b) {
        useMapStore.getState().setBounds([
          b.getWest(),
          b.getSouth(),
          b.getEast(),
          b.getNorth(),
        ]);
      }
    };
    map.on("load", onLoad);

    // Fare-picking: any click while picking places the origin/destination point.
    const onMapClick = (e: MapMouseEvent) => {
      const { fareQuery } = useMapStore.getState().transit;
      if (!fareQuery.picking) return;
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      useMapStore.getState().setFareQuery({ [fareQuery.picking]: coord, picking: null });
    };
    map.on("click", onMapClick);

    return () => {
      if (debounce) clearTimeout(debounce);
      map.off("style.load", onStyleLoad);
      map.off("moveend", onMoveEnd);
      map.off("load", onLoad);
      map.off("click", onMapClick);
      useMapStore.getState().setMap(null);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" aria-label="Baguio City 3D map" />
      {ready && mapRef.current && <MapLayers map={mapRef.current} />}
    </div>
  );
}

export default MapView;
