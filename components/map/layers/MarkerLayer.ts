"use client";

// Clustered destination markers driven by the viewport + filters.
// Operates imperatively on a mapbox map instance; safe on empty data.
import { useEffect } from "react";
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { useMapStore, useFilters } from "@/stores/useMapStore";
import { useDebouncedBounds } from "@/hooks/useDebouncedBounds";
import { useViewportMarkers } from "@/hooks/useViewportMarkers";
import { categoryMatchExpression, MAP_PALETTE } from "../categoryStyle";
import type { DestinationsResponse } from "@/types/api";

const SRC = "destinations";
const L_CLUSTER = "destinations-clusters";
const L_COUNT = "destinations-cluster-count";
const L_POINT = "destinations-point";
const L_LABEL = "destinations-label";

const EMPTY: DestinationsResponse = { type: "FeatureCollection", features: [] };

export function useMarkerLayer(map: MapboxMap) {
  const filters = useFilters();
  const viewport = useDebouncedBounds();
  const { data } = useViewportMarkers(viewport.bounds, viewport.zoom, filters.era);

  // Install source + layers + interaction once.
  useEffect(() => {
    if (map.getSource(SRC)) return;

    map.addSource(SRC, {
      type: "geojson",
      data: EMPTY,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 50,
    });

    map.addLayer({
      id: L_CLUSTER,
      type: "circle",
      source: SRC,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": MAP_PALETTE.cluster,
        "circle-opacity": 0.85,
        "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 15, 28],
        "circle-stroke-width": 2,
        "circle-stroke-color": MAP_PALETTE.clusterStroke,
      },
    });

    map.addLayer({
      id: L_COUNT,
      type: "symbol",
      source: SRC,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 13,
      },
      paint: { "text-color": MAP_PALETTE.label },
    });

    map.addLayer({
      id: L_POINT,
      type: "circle",
      source: SRC,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "match",
          ["get", "category"],
          ...categoryMatchExpression(),
          MAP_PALETTE.markerDefault,
        ] as unknown as string,
        "circle-radius": 7,
        "circle-stroke-width": 2,
        "circle-stroke-color": MAP_PALETTE.markerStroke,
        "circle-opacity": 0.95,
      },
    });

    map.addLayer({
      id: L_LABEL,
      type: "symbol",
      source: SRC,
      filter: ["!", ["has", "point_count"]],
      minzoom: 14,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"],
        "text-size": 11,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: {
        "text-color": MAP_PALETTE.label,
        "text-halo-color": MAP_PALETTE.labelHalo,
        "text-halo-width": 1.2,
      },
    });

    const onClusterClick = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [L_CLUSTER] });
      const clusterId = features[0]?.properties?.cluster_id;
      if (clusterId == null) return;
      const source = map.getSource(SRC) as GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        const geom = features[0].geometry;
        if (geom.type !== "Point") return;
        map.easeTo({
          center: geom.coordinates as [number, number],
          zoom: (zoom ?? map.getZoom()) + 0.2,
        });
      });
    };

    const onPointClick = (e: MapMouseEvent) => {
      // Don't hijack fare-picking clicks.
      if (useMapStore.getState().transit.fareQuery.picking) return;
      const feature = e.features?.[0];
      const slug = feature?.properties?.slug as string | undefined;
      if (!feature || !slug) return;
      useMapStore.getState().selectDestination(slug);
      if (feature.geometry.type === "Point") {
        map.easeTo({ center: feature.geometry.coordinates as [number, number] });
      }
    };

    const setPointer = () => (map.getCanvas().style.cursor = "pointer");
    const clearPointer = () => (map.getCanvas().style.cursor = "");

    map.on("click", L_CLUSTER, onClusterClick);
    map.on("click", L_POINT, onPointClick);
    map.on("mouseenter", L_CLUSTER, setPointer);
    map.on("mouseleave", L_CLUSTER, clearPointer);
    map.on("mouseenter", L_POINT, setPointer);
    map.on("mouseleave", L_POINT, clearPointer);

    return () => {
      map.off("click", L_CLUSTER, onClusterClick);
      map.off("click", L_POINT, onPointClick);
      map.off("mouseenter", L_CLUSTER, setPointer);
      map.off("mouseleave", L_CLUSTER, clearPointer);
      map.off("mouseenter", L_POINT, setPointer);
      map.off("mouseleave", L_POINT, clearPointer);
      for (const id of [L_LABEL, L_POINT, L_COUNT, L_CLUSTER]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SRC)) map.removeSource(SRC);
    };
  }, [map]);

  // Push filtered data into the source.
  useEffect(() => {
    const source = map.getSource(SRC) as GeoJSONSource | undefined;
    if (!source) return;
    const active = filters.categories;
    const features =
      active.length > 0
        ? data.features.filter((f) => active.includes(f.properties.category))
        : data.features;
    source.setData({ type: "FeatureCollection", features });
  }, [map, data, filters.categories]);
}
