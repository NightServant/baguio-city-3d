"use client";

// Floating camera controls: preset fly-to chips, zoom, and a compass/pitch
// reset. Sized for thumbs — every hit area is at least 40px.
import { Compass, Minus, Plus } from "lucide-react";
import { useMapStore } from "@/stores/useMapStore";
import { CAMERA_PRESETS, DEFAULT_CAMERA } from "@/lib/constants";
import { cn } from "@/lib/utils";

const PRESET_LABELS: Record<string, string> = {
  "burnham-park": "Burnham",
  "session-road": "Session Rd",
  "mines-view": "Mines View",
  "camp-john-hay": "Camp John Hay",
  "kennon-road": "Kennon Rd",
};

function flyToPreset(key: string) {
  const map = useMapStore.getState().map;
  const preset = CAMERA_PRESETS[key];
  if (!map || !preset) return;
  map.flyTo({
    center: preset.center as [number, number],
    zoom: preset.zoom,
    pitch: preset.pitch,
    bearing: preset.bearing,
    duration: 2200,
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

const controlButton =
  "flex size-10 items-center justify-center rounded-xl bg-card/90 text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-colors hover:bg-card active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MapControls() {
  return (
    <>
      {/* Preset chips — top center, horizontally scrollable on small screens */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto rounded-2xl bg-card/80 p-1.5 shadow-sm ring-1 ring-foreground/10 backdrop-blur [scrollbar-width:none]">
          {Object.keys(CAMERA_PRESETS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => flyToPreset(key)}
              className={cn(
                "h-9 shrink-0 rounded-xl px-3 text-xs font-medium text-foreground",
                "transition-colors hover:bg-primary hover:text-primary-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {PRESET_LABELS[key] ?? key}
            </button>
          ))}
        </div>
      </div>

      {/* Zoom + compass — right edge */}
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
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
