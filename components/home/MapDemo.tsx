"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Map as MapLibreMap } from "maplibre-gl";
import { applyWeaveBasemap } from "@/components/map/basemapTheme";
import { DEFAULT_CAMERA } from "@/lib/constants";
import { BASEMAP_STYLE, DEM_SOURCE, applyTerrain } from "@/lib/map/sources";
import { cn } from "@/lib/utils";

export interface DemoTarget {
  slug: string;
  name: string;
  lng: number;
  lat: number;
}

type Stage = "poster" | "loading" | "live";

/**
 * The real map, on the homepage. MapLibre loads only when this scrolls into
 * view (and not at all on Save-Data), so the page's first paint is an image.
 * It moves only when `target` changes, and `target` only changes when a
 * visitor picks a place in the carousel.
 */
export function MapDemo({ target }: { target: DemoTarget | null }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [stage, setStage] = useState<Stage>("poster");

  useEffect(() => {
    const frame = frameRef.current;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!frame || saveData) return;
    let cancelled = false;

    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setStage("loading");
        const { default: maplibregl } = await import("maplibre-gl");
        if (cancelled || !canvasRef.current) return;
        const map = new maplibregl.Map({
          container: canvasRef.current,
          style: BASEMAP_STYLE,
          center: DEFAULT_CAMERA.center as [number, number],
          zoom: DEFAULT_CAMERA.zoom,
          pitch: DEFAULT_CAMERA.pitch,
          bearing: DEFAULT_CAMERA.bearing,
          scrollZoom: false, // never hijack page scrolling
          cooperativeGestures: true,
          attributionControl: { compact: true },
        });
        map.on("style.load", () => {
          applyTerrain(map);
          applyWeaveBasemap(map, DEM_SOURCE);
        });
        map.once("idle", () => {
          if (!cancelled) setStage("live");
        });
        mapRef.current = map;
      },
      { rootMargin: "200px" },
    );
    io.observe(frame);

    return () => {
      cancelled = true;
      io.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to the picked place. If the map is still loading, this runs again
  // once it's live, so the visitor's last pick is where it lands.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stage !== "live" || !target) return;
    const to = { center: [target.lng, target.lat] as [number, number], zoom: 15.2, pitch: 62, bearing: -20 };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.jumpTo(to);
    else map.flyTo({ ...to, duration: 2400 });
  }, [target, stage]);

  return (
    <figure className="weave-edge border-y border-r border-border bg-card">
      <div ref={frameRef} className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10]">
        <div ref={canvasRef} className="absolute inset-0" role="region" aria-label="Interactive 3D map preview" />
        <Image
          src="/home/demo-map.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 56vw, 100vw"
          className={cn("pointer-events-none object-cover transition-opacity duration-500", stage === "live" && "opacity-0")}
        />
      </div>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3">
        <p role="status" className="text-sm font-medium">
          {target
            ? `Showing ${target.name} on the map`
            : stage === "loading"
              ? "Loading the terrain…"
              : "Pick a place below and the map flies there"}
        </p>
        <span className="text-xs text-muted-foreground">Map data © OpenStreetMap contributors, OpenFreeMap</span>
      </figcaption>
    </figure>
  );
}
