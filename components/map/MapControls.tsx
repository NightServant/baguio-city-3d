"use client";

// Floating camera controls: preset fly-to chips, zoom, and a compass/pitch
// reset. Sized for thumbs — every hit area is at least 40px.
import { Compass, Minus, Plus } from "lucide-react";
import { useMapStore, useActiveSheet } from "@/stores/useMapStore";
import { CAMERA_PRESETS, DEFAULT_CAMERA } from "@/lib/constants";
import { cn } from "@/lib/utils";

const PRESET_LABELS: Record<string, string> = {
  "burnham-park": "Burnham",
  "session-road": "Session Rd",
  "mines-view": "Mines View",
  "camp-john-hay": "Camp John Hay",
  "kennon-road": "Kennon Rd",
};

// Honor the OS "reduce motion" setting: MapLibre's `essential: true` deliberately
// bypasses prefers-reduced-motion, so we gate the animation duration ourselves —
// jump instantly instead of sweeping the camera.
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function flyToPreset(key: string) {
  const map = useMapStore.getState().map;
  const preset = CAMERA_PRESETS[key];
  if (!map || !preset) return;
  map.flyTo({
    center: preset.center as [number, number],
    zoom: preset.zoom,
    pitch: preset.pitch,
    bearing: preset.bearing,
    duration: prefersReducedMotion() ? 0 : 2200,
    essential: true,
  });
}

function zoomBy(delta: number) {
  const map = useMapStore.getState().map;
  if (!map) return;
  map.easeTo({ zoom: map.getZoom() + delta, duration: 350 });
}

function resetView() {
  const map = useMapStore.getState().map;
  if (!map) return;
  map.easeTo({
    pitch: DEFAULT_CAMERA.pitch,
    bearing: DEFAULT_CAMERA.bearing,
    duration: 800,
  });
}

// Instrument chrome: square, hard-edged, sitting ON the terrain rather than
// floating above it on a shadow. Border, not ring; ecru hover, not a tint.
const controlButton =
  "flex size-10 items-center justify-center border border-border bg-background/92 text-foreground backdrop-blur transition-colors hover:bg-secondary active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MapControls() {
  const unavailable = useMapStore((s) => s.mapUnavailable);
  // The destination sheet covers the right edge (desktop) or the lower 60% (phones); keep the stack clear of it.
  const sheetOpen = useActiveSheet() === "destination";

  if (unavailable) return null;
  return (
    <>
      {/* Preset chips — top center, horizontally scrollable on small screens */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-hud flex justify-center px-3">
        <div className="scrollbar-none pointer-events-auto flex max-w-full gap-px overflow-x-auto border border-border bg-border/60 backdrop-blur">
          {Object.keys(CAMERA_PRESETS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => flyToPreset(key)}
              className={cn(
                "h-9 shrink-0 bg-background/92 px-3.5 text-xs font-medium text-foreground",
                "transition-colors hover:bg-primary hover:text-primary-foreground active:translate-y-px",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {PRESET_LABELS[key] ?? key}
            </button>
          ))}
        </div>
      </div>

      {/* Zoom + compass — right edge */}
      <div
        className={cn(
          "absolute z-hud flex flex-col gap-2 transition-[right,top] duration-200 ease-out motion-reduce:transition-none",
          sheetOpen
            ? "right-3 top-20 sm:right-[calc(22rem+1.5rem)] sm:top-1/2 sm:-translate-y-1/2"
            : "right-3 top-1/2 -translate-y-1/2",
        )}
      >
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)} className={controlButton}>
          <Plus className="size-4" />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)} className={controlButton}>
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Reset tilt and rotation"
          onClick={resetView}
          className={controlButton}
        >
          <Compass className="size-4" />
        </button>
      </div>
    </>
  );
}
