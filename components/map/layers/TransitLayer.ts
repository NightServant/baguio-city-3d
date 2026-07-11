"use client";

// Jeepney route lines. Inactive routes read as quiet threads; the active route
// gets a marching-ants dashed casing plus its stops. Safe on empty data.
import { useEffect, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { useMapStore, useActiveRouteCode } from "@/stores/useMapStore";
import { MAP_PALETTE } from "../categoryStyle";
import type { TransitRoutesResponse } from "@/types/api";

const SRC = "transit-routes";
const SRC_STOPS = "transit-stops";
const L_BASE = "transit-lines";
const L_CASING = "transit-active-casing";
const L_ACTIVE = "transit-active-line";
const L_STOPS = "transit-stops-circles";

const EMPTY: TransitRoutesResponse = { type: "FeatureCollection", features: [] };
const EMPTY_STOPS = { type: "FeatureCollection" as const, features: [] };

// Marching-ants dash frames.
const DASH_SEQUENCE: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
];

function zoomTier(zoom: number): number {
  return zoom < 13 ? 12 : zoom <= 14 ? 14 : 16;
}

export function useTransitLayer(map: MapboxMap) {
  const activeRouteCode = useActiveRouteCode();
  const zoom = useMapStore((s) => s.camera.zoom);
  const tier = zoomTier(zoom);
  const [routes, setRoutes] = useState<TransitRoutesResponse>(EMPTY);

  // Install layers once.
  useEffect(() => {
    if (map.getSource(SRC)) return;

    map.addSource(SRC, { type: "geojson", data: EMPTY });
    map.addSource(SRC_STOPS, { type: "geojson", data: EMPTY_STOPS });

    map.addLayer({
      id: L_BASE,
      type: "line",
      source: SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": MAP_PALETTE.transit.inactive,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.5, 16, 3],
        "line-opacity": 0.5,
      },
    });

    map.addLayer({
      id: L_CASING,
      type: "line",
      source: SRC,
      filter: ["==", ["get", "code"], ""],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": MAP_PALETTE.transit.activeCasing,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 6, 16, 12],
        "line-opacity": 0.45,
        "line-dasharray": [0, 4, 3],
      },
    });

    map.addLayer({
      id: L_ACTIVE,
      type: "line",
      source: SRC,
      filter: ["==", ["get", "code"], ""],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": MAP_PALETTE.transit.active,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 16, 5],
        "line-opacity": 0.95,
      },
    });

    map.addLayer({
      id: L_STOPS,
      type: "circle",
      source: SRC_STOPS,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6],
        "circle-color": MAP_PALETTE.transit.stopFill,
        "circle-stroke-color": MAP_PALETTE.transit.stopStroke,
        "circle-stroke-width": 2,
      },
    });

    const onLineClick = (e: MapMouseEvent) => {
      if (useMapStore.getState().transit.fareQuery.picking) return;
      const code = e.features?.[0]?.properties?.code as string | undefined;
      if (code) useMapStore.getState().setActiveRouteCode(code);
    };
    const setPointer = () => (map.getCanvas().style.cursor = "pointer");
    const clearPointer = () => (map.getCanvas().style.cursor = "");

    map.on("click", L_BASE, onLineClick);
    map.on("mouseenter", L_BASE, setPointer);
    map.on("mouseleave", L_BASE, clearPointer);

    return () => {
      map.off("click", L_BASE, onLineClick);
      map.off("mouseenter", L_BASE, setPointer);
      map.off("mouseleave", L_BASE, clearPointer);
      for (const id of [L_STOPS, L_ACTIVE, L_CASING, L_BASE]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SRC)) map.removeSource(SRC);
      if (map.getSource(SRC_STOPS)) map.removeSource(SRC_STOPS);
    };
  }, [map]);

  // Fetch routes whenever the zoom tier changes (geometry simplification bands).
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/geo/transit/routes?zoom=${tier}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as TransitRoutesResponse;
      })
      .then((data) => setRoutes(data))
      .catch((err) => {
        if (!controller.signal.aborted && err?.name !== "AbortError") {
          setRoutes((r) => (r.features.length ? r : EMPTY));
        }
      });
    return () => controller.abort();
  }, [tier]);

  // Push route data into source.
  useEffect(() => {
    const source = map.getSource(SRC) as GeoJSONSource | undefined;
    if (source) source.setData(routes);
  }, [map, routes]);

  // Highlight the active route + show its stops.
  useEffect(() => {
    if (!map.getLayer(L_CASING)) return;
    const code = activeRouteCode ?? "";
    map.setFilter(L_CASING, ["==", ["get", "code"], code]);
    map.setFilter(L_ACTIVE, ["==", ["get", "code"], code]);

    const stopsSource = map.getSource(SRC_STOPS) as GeoJSONSource | undefined;
    if (!stopsSource) return;
    if (!activeRouteCode) {
      stopsSource.setData(EMPTY_STOPS);
      return;
    }
    const route = routes.features.find((f) => f.properties.code === activeRouteCode);
    stopsSource.setData({
      type: "FeatureCollection",
      features: (route?.properties.stops ?? []).map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: { name: s.name, seq: s.seq },
      })),
    });
  }, [map, activeRouteCode, routes]);

  // Animate the dashed casing while a route is active.
  useEffect(() => {
    if (!activeRouteCode) return;
    let raf = 0;
    let frame = 0;
    let last = 0;
    const stepFrame = (ts: number) => {
      if (ts - last > 90) {
        last = ts;
        frame = (frame + 1) % DASH_SEQUENCE.length;
        if (map.getLayer(L_CASING)) {
          map.setPaintProperty(L_CASING, "line-dasharray", DASH_SEQUENCE[frame]);
        }
      }
      raf = requestAnimationFrame(stepFrame);
    };
    raf = requestAnimationFrame(stepFrame);
    return () => cancelAnimationFrame(raf);
  }, [map, activeRouteCode]);
}
