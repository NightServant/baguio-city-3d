"use client";

// The MapLibre GL canvas. Initializes the 3D terrain map, wires camera state
// back into the store, and mounts the imperative layers once the style is ready.
// Uses OpenFreeMap tiles + AWS Terrarium terrain — no account, key, or token.
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import maplibregl, {
  type Map as MapLibreMap,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import { useMapStore, type Basemap } from "@/stores/useMapStore";
import { BAGUIO_BOUNDS, DEFAULT_CAMERA } from "@/lib/constants";
import type { TerrainConfig } from "@/types/api";
import { MapLayers } from "./MapLayers";

// Keyless basemap style (OpenFreeMap "Liberty"). No token required.
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Minimal keyless satellite style — Esri World Imagery raster tiles. The glyphs
// endpoint is REQUIRED: the app's symbol layers (marker labels, cluster counts,
// history events) render Noto Sans glyphs and break without a font source. A
// slight brightness/saturation pull-back keeps overlay markers legible on top of
// the imagery.
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster",
      source: "esri-world-imagery",
      paint: {
        "raster-brightness-max": 0.92,
        "raster-saturation": -0.12,
      },
    },
  ],
};

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
  // Basemap/DEM tile failures surface a single dismissible notice over the
  // canvas. Once the user dismisses it we stay quiet for the session.
  const [tileError, setTileError] = useState(false);
  const errorDismissed = useRef(false);
  const basemap = useMapStore((s) => s.ui.basemap);
  const styleGeneration = useMapStore((s) => s.ui.styleGeneration);
  // Which basemap the map's CURRENT, FULLY LOADED style reflects. Only ever
  // updated inside the map's `style.load` handler (via pendingBasemapRef), so
  // `appliedBasemap === basemap` is a commit-time guarantee that the style is
  // loaded and matches the requested basemap. MapLayers is mounted only under
  // that condition — see the render expression below.
  const [appliedBasemap, setAppliedBasemap] = useState<Basemap>("terrain");
  // The basemap the in-flight (or most recent) style corresponds to. Written
  // right before map creation / setStyle; read by the style.load handler.
  const pendingBasemapRef = useRef<Basemap>("terrain");

  // True whenever a stylesheet is in flight — from map construction and from
  // every setStyle() basemap swap until the matching style.load. In that window
  // MapLibre has torn down style.projection, and any frame rendered against it
  // throws (Painter.useProgram dereferences style.projection.shaderPreludeCode).
  // Starts true: the initial style is in flight the moment the map is created.
  const styleInFlightRef = useRef(true);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Honor a basemap already chosen before the map exists (the ?basemap=
    // deep-link sets the store while this component's dynamic chunk is still
    // loading), so a satellite deep-link starts directly on the satellite style
    // instead of loading Liberty and then switching.
    const initialBasemap = useMapStore.getState().ui.basemap;
    pendingBasemapRef.current = initialBasemap;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialBasemap === "satellite" ? SATELLITE_STYLE : BASEMAP_STYLE,
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

    // applyTerrain re-establishes the 3D relief after any style load. It runs on
    // the initial style.load, the /api/geo/terrain fetch, AND after every
    // setStyle basemap switch — because setStyle() destroys ALL sources, layers,
    // terrain and sky. addSource is guarded (idempotent); setTerrain/setSky are
    // cheap and re-run each time so the DEM + atmosphere are always restored,
    // keeping satellite imagery draped over the same 3D terrain.
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
        m.setSky({
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

    // Fires on the initial style AND after every basemap setStyle(). Re-apply
    // terrain/sky, then record which basemap this loaded style belongs to and
    // bump the generation. The resulting commit is the ONLY place MapLayers can
    // (re)mount, and at that instant the style spec is guaranteed loaded — the
    // exact flag addSource's _checkLoaded asserts is set right before this
    // event fires.
    const onStyleLoad = () => {
      styleInFlightRef.current = false;
      applyTerrain(map, exaggeration);
      useMapStore.getState().bumpStyleGeneration();
      setAppliedBasemap(pendingBasemapRef.current);
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

    // Tile/network failures (basemap raster, vector tiles, or the Terrarium DEM)
    // fire `error` repeatedly — one per failed tile. Collapse them into a single
    // notice: React bails on setState(true) when already true, and once the user
    // dismisses it we suppress the rest for the session.
    const onError = () => {
      if (errorDismissed.current) return;
      setTileError(true);
    };
    map.on("error", onError);

    // MapLibre drives rendering purely via requestAnimationFrame, which the
    // browser pauses whenever the tab/window is hidden. Unlike resize or user
    // interaction, MapLibre 5.x has NO visibilitychange handler (verified: zero
    // such listeners in maplibre-gl 5.24), so a map that starts or finishes
    // loading while the page is backgrounded can be left showing only its blank
    // clear-color until the user happens to pan/zoom. Force a repaint (and a
    // resize, in case the container changed while hidden) when the page becomes
    // visible again so the current map state always paints.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      map.resize();
      // Skip the nudge only while a stylesheet is in flight (see
      // styleInFlightRef) — forcing a frame then throws inside MapLibre. Note
      // this deliberately does NOT use map.isStyleLoaded(): that also waits on
      // every source, so it stays false long after rendering is safe, which
      // would suppress the repaint in the common "finished loading while
      // hidden" case this handler exists to fix. The pending style.load paints
      // on its own, so skipping during the swap loses nothing.
      if (!styleInFlightRef.current) map.triggerRepaint();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (debounce) clearTimeout(debounce);
      map.off("style.load", onStyleLoad);
      map.off("moveend", onMoveEnd);
      map.off("load", onLoad);
      map.off("click", onMapClick);
      map.off("error", onError);
      document.removeEventListener("visibilitychange", onVisibility);
      useMapStore.getState().setMap(null);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Basemap switch. setStyle preserves the camera transform; onStyleLoad (above)
  // re-applies terrain/sky, records the applied basemap, and bumps the
  // generation, at which point MapLayers remounts. `diff: false` swaps the whole
  // style rather than diffing raster-vs-vector.
  //
  // Ordering guarantee (the fix for "Style is not done loading"): MapLayers is
  // rendered only while `appliedBasemap === basemap`. The commit that changes
  // `basemap` therefore UNMOUNTS MapLayers during its mutation phase — running
  // every layer cleanup against the still-loaded old style — before this passive
  // effect calls setStyle and unloads it. While the new style is in flight the
  // mismatch keeps MapLayers unmounted (no mount effects can run, including
  // Strict Mode double-invokes), and the only path that mounts it again is the
  // style.load commit above, where the style spec is loaded by definition. The
  // layer install effects can therefore never race setStyle, on any load path.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (appliedBasemap === basemap) return;
    pendingBasemapRef.current = basemap;
    styleInFlightRef.current = true;
    map.setStyle(basemap === "satellite" ? SATELLITE_STYLE : BASEMAP_STYLE, { diff: false });
  }, [basemap, appliedBasemap, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" aria-label="Baguio City 3D map" />
      {ready && appliedBasemap === basemap && mapRef.current && (
        <MapLayers key={styleGeneration} map={mapRef.current} />
      )}

      {tileError && (
        <div
          role="status"
          className="absolute left-1/2 top-16 z-hud flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-card/95 px-4 py-2.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur animate-in fade-in slide-in-from-top-2 duration-200 ease-out motion-reduce:animate-none"
        >
          <div className="flex min-w-0 flex-col">
            <span className="readout text-muted-foreground">Map tiles</span>
            <span className="mt-1 text-xs text-foreground">Some map tiles didn&apos;t load.</span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reload
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              errorDismissed.current = true;
              setTileError(false);
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default MapView;
