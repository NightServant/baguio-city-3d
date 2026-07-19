"use client";

// Client shell that loads the MapLibre canvas browser-only.
// Next 16: dynamic({ ssr: false }) is only legal inside a Client Component,
// which is exactly why this wrapper exists.
import dynamic from "next/dynamic";

function MapSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-muted">
      {/* Preset chip bar — echoes the real HUD's top-center rail. */}
      <div className="absolute inset-x-0 top-3 flex justify-center px-3">
        <div className="h-12 w-full max-w-md animate-pulse rounded-2xl bg-card/80" />
      </div>
      {/* Mode dock — top-left on desktop. */}
      <div className="absolute left-3 top-3 hidden flex-col gap-1.5 sm:flex">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-28 animate-pulse rounded-xl bg-card/80" />
        ))}
      </div>
      {/* On-voice line, centered over the shimmering canvas. */}
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Raising the mountains…</p>
      </div>
    </div>
  );
}

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function MapLoader() {
  return <MapView />;
}
