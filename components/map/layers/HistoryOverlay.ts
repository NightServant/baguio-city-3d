"use client";

// Timeline overlay: when an era is active, drop its historical event markers,
// dim destinations from other eras, and nudge the basemap lighting older.
// Safe on empty data; all mutations are guarded on layer existence.
import { useEffect, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { useMapStore, useActiveEra } from "@/stores/useMapStore";
import type { ErasResponse, Era } from "@/types/api";

const SRC_EVENTS = "history-events";
const L_EVENTS = "history-events-symbols";
const L_POINT = "destinations-point"; // owned by MarkerLayer; we only tweak paint

const EMPTY = { type: "FeatureCollection" as const, features: [] };

// Older eras get a warmer, lower-angle basemap light.
const LIGHT_PRESET: Record<Era, string> = {
  PRE_COLONIAL: "dusk",
  AMERICAN_COLONIAL: "dawn",
  POST_WAR: "dawn",
  MODERN: "day",
};

export function useHistoryOverlay(map: MapboxMap) {
  const activeEra = useActiveEra();
  const [eras, setEras] = useState<ErasResponse>({ eras: [] });

  // Install the events source + layer once.
  useEffect(() => {
    if (map.getSource(SRC_EVENTS)) return;
    map.addSource(SRC_EVENTS, { type: "geojson", data: EMPTY });
    map.addLayer({
      id: L_EVENTS,
      type: "symbol",
      source: SRC_EVENTS,
      layout: {
        "text-field": ["get", "title"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 11,
        "text-offset": [0, 1.4],
        "text-anchor": "top",
        "icon-image": "marker-15",
        "icon-allow-overlap": true,
        "text-optional": true,
      },
      paint: {
        "text-color": "#f4e4c1",
        "text-halo-color": "rgba(40,25,10,0.8)",
        "text-halo-width": 1.4,
        "icon-color": "#d9a441",
      },
    });

    const onEventClick = (e: MapMouseEvent) => {
      const f = e.features?.[0];
      if (f?.geometry.type === "Point") {
        map.flyTo({ center: f.geometry.coordinates as [number, number], zoom: 15.5 });
      }
    };
    const setPointer = () => (map.getCanvas().style.cursor = "pointer");
    const clearPointer = () => (map.getCanvas().style.cursor = "");
    map.on("click", L_EVENTS, onEventClick);
    map.on("mouseenter", L_EVENTS, setPointer);
    map.on("mouseleave", L_EVENTS, clearPointer);

    return () => {
      map.off("click", L_EVENTS, onEventClick);
      map.off("mouseenter", L_EVENTS, setPointer);
      map.off("mouseleave", L_EVENTS, clearPointer);
      if (map.getLayer(L_EVENTS)) map.removeLayer(L_EVENTS);
      if (map.getSource(SRC_EVENTS)) map.removeSource(SRC_EVENTS);
    };
  }, [map]);

  // Fetch eras + events once.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/history/eras", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ErasResponse;
      })
      .then((data) => setEras(data))
      .catch((err) => {
        if (!controller.signal.aborted && err?.name !== "AbortError") setEras({ eras: [] });
      });
    return () => controller.abort();
  }, []);

  // React to the active era.
  useEffect(() => {
    const source = map.getSource(SRC_EVENTS) as GeoJSONSource | undefined;

    // Basemap lighting (Standard style config); guarded — style may not support it.
    try {
      const preset = activeEra ? LIGHT_PRESET[activeEra] : "day";
      map.setConfigProperty("basemap", "lightPreset", preset);
    } catch {
      /* non-Standard style — ignore */
    }

    // Dim destinations outside the active era.
    if (map.getLayer(L_POINT)) {
      map.setPaintProperty(
        L_POINT,
        "circle-opacity",
        activeEra
          ? (["case", ["==", ["get", "era"], activeEra], 1, 0.2] as unknown as number)
          : 0.95,
      );
    }

    if (!source) return;
    if (!activeEra) {
      source.setData(EMPTY);
      return;
    }
    const era = eras.eras.find((e) => e.key === activeEra);
    const features = (era?.events ?? [])
      .filter((ev) => ev.lng != null && ev.lat != null)
      .map((ev) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [ev.lng as number, ev.lat as number] },
        properties: { title: ev.title, year: ev.year },
      }));
    source.setData({ type: "FeatureCollection", features });
  }, [map, activeEra, eras]);
}

// Re-export so panels can share the same fetched era shape without a second call
// is intentionally avoided; the TimelineScrubber fetches independently (cheap,
// cached) to stay decoupled from map lifecycle.
export type { ErasResponse };
