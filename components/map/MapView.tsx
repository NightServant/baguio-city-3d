"use client";

// The mapbox-gl canvas. Initializes the 3D terrain map, wires camera state back
// into the store, and mounts the imperative layers once the style is ready.
// Never crashes without a token — renders a setup notice instead.
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";
import { MountainSnow } from "lucide-react";
import { useMapStore } from "@/stores/useMapStore";
import { BAGUIO_BOUNDS, DEFAULT_CAMERA } from "@/lib/constants";
import type { TerrainConfig } from "@/types/api";
import { MapLayers } from "./MapLayers";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const TOKEN_MISSING = !TOKEN || TOKEN.startsWith("pk.REPLACE");

const DEM_SOURCE = "mapbox-dem";

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

function TokenNotice() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted p-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm ring-1 ring-foreground/5">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MountainSnow className="size-6" />
        </div>
        <h2 className="font-heading text-lg font-medium text-foreground">
          Add a Mapbox token to explore in 3D
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The interactive terrain map needs a Mapbox access token. Create one at{" "}
          <span className="font-medium text-foreground">account.mapbox.com</span>, then set it in
          your <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code> file:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-left text-xs text-foreground">
          NEXT_PUBLIC_MAPBOX_TOKEN=&quot;pk.your_real_token&quot;
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          Restart the dev server after saving. Everything else on this page still works.
        </p>
      </div>
    </div>
  );
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (TOKEN_MISSING || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: DEFAULT_CAMERA.center as [number, number],
      zoom: DEFAULT_CAMERA.zoom,
      pitch: DEFAULT_CAMERA.pitch,
      bearing: DEFAULT_CAMERA.bearing,
      maxBounds: expandBounds(BAGUIO_BOUNDS),
      attributionControl: true,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    useMapStore.getState().setMap(map);

    const applyTerrain = (m: MapboxMap, exag: number) => {
      if (!m.getSource(DEM_SOURCE)) {
        m.addSource(DEM_SOURCE, {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      m.setTerrain({ source: DEM_SOURCE, exaggeration: exag });
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
    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
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

  if (TOKEN_MISSING) {
    return (
      <div className="absolute inset-0">
        <TokenNotice />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" aria-label="Baguio City 3D map" />
      {ready && mapRef.current && <MapLayers map={mapRef.current} />}
    </div>
  );
}

export default MapView;
