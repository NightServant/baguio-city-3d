"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Map as MapLibreMap } from "maplibre-gl";
import { applyWeaveBasemap } from "@/components/map/basemapTheme";
import { DEFAULT_CAMERA } from "@/lib/constants";
import { BASEMAP_STYLE, DEM_SOURCE, applyTerrain, applySky } from "@/lib/map/sources";
import { cn } from "@/lib/utils";

export interface DemoTarget {
  slug: string;
  name: string;
  lng: number;
  lat: number;
}

type Stage = "poster" | "loading" | "live" | "static";

type CaptionKind = "static" | "target" | "loading" | "idle";

/** Which caption to show. Pulled out so the choice is testable without a DOM. */
export function captionKind(stage: Stage, target: DemoTarget | null): CaptionKind {
  if (stage === "static") return "static";
  if (target) return "target";
  if (stage === "loading") return "loading";
  return "idle";
}

/**
 * The real map, on the homepage. MapLibre loads only when this scrolls into
 * view (and not at all on Save-Data), so the page's first paint is an image.
 * It moves only when `target` changes, and `target` only changes when a
 * visitor picks a place in the carousel. If the live map can't come up at all
 * (Save-Data, a failed chunk load, no WebGL, or a style that errors before
 * going live) it falls back to the `"static"` stage: an honest still with a
 * link to the real map, never claiming to show anything live.
 */
export function MapDemo({ target }: { target: DemoTarget | null }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const themeObserverRef = useRef<MutationObserver | null>(null);
  // Save-Data visitors start (and stay) on the static stage: the map never
  // loads for them, so there's nothing to synchronize after mount.
  const [stage, setStage] = useState<Stage>(() =>
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
      ? "static"
      : "poster",
  );

  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData) return; // already on the static stage from the initial state above
    const frame = frameRef.current;
    if (!frame) return;
    let cancelled = false;

    async function loadMap() {
      try {
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
        mapRef.current = map;

        let becameLive = false;
        map.on("style.load", () => {
          applyTerrain(map);
          applyWeaveBasemap(map, DEM_SOURCE);
        });
        map.once("idle", () => {
          becameLive = true;
          if (!cancelled) setStage("live");
        });
        // A style/tile error that fires before the map ever goes live means
        // it never will on its own; fall back honestly instead of leaving
        // "Loading the terrain…" up forever. Errors after going live (e.g. a
        // dropped tile) are left alone, same as the full map page.
        map.on("error", () => {
          if (becameLive || cancelled) return;
          setStage("static");
          map.remove();
          if (mapRef.current === map) mapRef.current = null;
        });

        // Mirrors MapView's themeObserver: the header's theme toggle flips
        // data-theme on <html> without a reload, so re-dye in place.
        const themeObserver = new MutationObserver(() => {
          if (!map.isStyleLoaded()) return;
          applySky(map);
          applyWeaveBasemap(map, DEM_SOURCE);
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        themeObserverRef.current = themeObserver;
      } catch {
        if (!cancelled) setStage("static");
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setStage("loading");
        void loadMap();
      },
      { rootMargin: "200px" },
    );
    io.observe(frame);

    return () => {
      cancelled = true;
      io.disconnect();
      themeObserverRef.current?.disconnect();
      themeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to the picked place. Keyed on the slug (not target's object identity)
  // so an inline object literal from the parent doesn't re-fly the map on
  // every render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stage !== "live" || !target) return;
    const to = { center: [target.lng, target.lat] as [number, number], zoom: 15.2, pitch: 62, bearing: -20 };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.jumpTo(to);
    else map.flyTo({ ...to, duration: 2400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.slug, stage]);

  const kind = captionKind(stage, target);

  return (
    <figure className="weave-edge border-y border-r border-border bg-card">
      <div ref={frameRef} className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10]">
        <div ref={canvasRef} className="absolute inset-0" />
        <Image
          src="/home/demo-map.jpg"
          alt={
            stage === "live"
              ? ""
              : "Still of the 3D map of Baguio, with the terrain shaded"
          }
          fill
          sizes="(min-width: 1024px) 56vw, 100vw"
          className={cn("pointer-events-none object-cover transition-opacity duration-500 motion-reduce:transition-none", stage === "live" && "opacity-0")}
        />
      </div>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3">
        <p role="status" className="text-sm font-medium">
          {kind === "static" ? (
            <>
              The live 3D map is on the{" "}
              <Link href="/map" className="text-primary underline-offset-4 hover:underline">
                map page
              </Link>
              .
            </>
          ) : kind === "target" ? (
            `Showing ${target!.name} on the map`
          ) : kind === "loading" ? (
            "Loading the terrain…"
          ) : (
            "Pick a place below and the map flies there"
          )}
        </p>
        <span className="text-xs text-muted-foreground">
          Map data © OpenStreetMap contributors, OpenFreeMap. Terrain: Mapzen / Tilezen, AWS Open Data
        </span>
      </figcaption>
    </figure>
  );
}
