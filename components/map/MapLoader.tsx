"use client";

// Client shell that loads the mapbox canvas browser-only.
// Next 16: dynamic({ ssr: false }) is only legal inside a Client Component,
// which is exactly why this wrapper exists.
import dynamic from "next/dynamic";

function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-3">
        <div className="relative size-10">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="absolute inset-2 rounded-full bg-primary/60" />
        </div>
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
