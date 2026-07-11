// Server Component: full-viewport map page. All interactivity lives in the
// client components it composes.
import type { Metadata } from "next";
import { MapLoader } from "@/components/map/MapLoader";
import { MapControls } from "@/components/map/MapControls";
import { PanelChrome } from "@/components/panels/PanelChrome";

export const metadata: Metadata = {
  title: "Interactive 3D Map — Baguio City",
  description:
    "Fly over Baguio's ridges in 3D — find viewpoints, heritage sites, jeepney routes, fares, and the city's history on one living map.",
};

export default function MapPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-muted">
      <MapLoader />
      <MapControls />
      <PanelChrome />
    </main>
  );
}
