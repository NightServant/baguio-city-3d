"use client";

// Timeline overlay: when an era is active, drop its historical event markers,
// dim destinations from other eras, and nudge the basemap lighting older.
// Safe on empty data; all mutations are guarded on layer existence.
import { useEffect, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { useMapStore, useActiveEra } from "@/stores/useMapStore";
import { MAP_PALETTE } from "../categoryStyle";
import type { ErasResponse, Era } from "@/types/api";

const SRC_EVENTS = "history-events";
const L_EVENTS = "history-events-symbols";
const L_POINT = "destinations-point"; // owned by MarkerLayer; we only tweak paint
const IMG_EVENT_DOT = "history-event-dot"; // programmatic sprite (Standard style has no marker-15)

const EMPTY = { type: "FeatureCollection" as const, features: [] };

/**
 * Register a small amber dot-pin sprite so the event symbols have an icon that
 * actually exists (the basemap sprite ships no matching marker). Drawn to an
 * offscreen canvas — no external asset fetch. Idempotent.
 */
function ensureEventIcon(map: MapLibreMap) {
  if (map.hasImage(IMG_EVENT_DOT)) return;
  const size = 18;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(r, r, r - 3, 0, Math.PI * 2);
  ctx.fillStyle = MAP_PALETTE.era.eventIcon;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();
  map.addImage(IMG_EVENT_DOT, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
}

// Older eras get a warmer sky/fog tint (MapLibre setSky — no Standard-style
// light presets). MODERN falls back to the neutral daytime atmosphere.
const ERA_SKY: Record<Era, { sky: string; fog: string }> = {
  PRE_COLONIAL: { sky: "#c9a36a", fog: "#e6cfa6" }, // warm dusk haze
  AMERICAN_COLONIAL: { sky: "#d6b483", fog: "#ecdcc0" }, // sepia dawn
  POST_WAR: { sky: "#cdbf9a", fog: "#e8ddc6" }, // faded parchment
  MODERN: { sky: "#a7c4e0", fog: "#dfe7ee" }, // neutral day
};

export function useHistoryOverlay(map: MapLibreMap) {
  const activeEra = useActiveEra();
  const [eras, setEras] = useState<ErasResponse>({ eras: [] });

  // Install the events source + layer once.
  useEffect(() => {
    if (map.getSource(SRC_EVENTS)) return;
    ensureEventIcon(map);
    // Bail cleanly if the style is mid-swap (setStyle unloaded it) — a fresh
    // mount keyed on styleGeneration re-adds these once the new style loads.
    try {
      map.addSource(SRC_EVENTS, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: L_EVENTS,
        type: "symbol",
        source: SRC_EVENTS,
        layout: {
          "text-field": ["get", "title"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "icon-image": IMG_EVENT_DOT,
          "icon-allow-overlap": true,
          "text-optional": true,
        },
        paint: {
          "text-color": MAP_PALETTE.era.eventText,
          "text-halo-color": MAP_PALETTE.era.eventHalo,
          "text-halo-width": 1.4,
        },
      });
    } catch {
      return;
    }

    const onEventClick = (e: MapLayerMouseEvent) => {
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

    // Era mood: tint the atmospheric sky/fog warmer for older eras. Guarded —
    // setSky is a MapLibre 5+ addition and the style may not be ready.
    try {
      const tint = ERA_SKY[activeEra ?? "MODERN"];
      map.setSky({
        "sky-color": tint.sky,
        "horizon-color": "#eaf1f7",
        "fog-color": tint.fog,
        "sky-horizon-blend": 0.6,
        "horizon-fog-blend": 0.5,
        "fog-ground-blend": 0.4,
      });
    } catch {
      /* setSky unsupported or style not ready — atmosphere is optional */
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
