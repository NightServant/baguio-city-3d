// Server Component: full-viewport map page. All interactivity lives in the
// client components it composes.
import type { Metadata } from "next";
import { Suspense } from "react";
import { MapLoader } from "@/components/map/MapLoader";
import { MapControls } from "@/components/map/MapControls";
import { PanelChrome } from "@/components/panels/PanelChrome";
import { DeepLink } from "@/components/map/DeepLink";

export const metadata: Metadata = {
  title: "Interactive 3D Map — Baguio City",
  description:
    "Fly over Baguio's ridges in 3D — find viewpoints, heritage sites, jeepney routes, fares, and the city's history on one living map.",
};

export default function MapPage() {
  return (
    // Height = viewport minus the sticky SiteNav (h-14 + 1px border) so
    // bottom-anchored HUD elements stay on-screen.
    <main className="relative h-[calc(100dvh-3.5rem-1px)] w-full overflow-hidden bg-muted">
      <MapLoader />
      <MapControls />
      <PanelChrome />
      <Suspense fallback={null}>
        <DeepLink />
      </Suspense>
    </main>
  );
}
