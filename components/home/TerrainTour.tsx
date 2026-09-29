"use client";

import { useState } from "react";
import type { Destination } from "@/lib/content";
import { DestinationCarousel } from "@/components/site/DestinationCarousel";
import { MapDemo, type DemoTarget } from "./MapDemo";

/** The carousel steers the live map: each place a visitor lands on, the map flies to. */
export function TerrainTour({ destinations }: { destinations: Destination[] }) {
  const [target, setTarget] = useState<DemoTarget | null>(null);
  return (
    <div className="min-w-0 space-y-6">
      <MapDemo target={target} />
      <DestinationCarousel
        destinations={destinations}
        onActiveChange={(d) => setTarget({ slug: d.slug, name: d.name, lng: d.lng, lat: d.lat })}
      />
    </div>
  );
}
