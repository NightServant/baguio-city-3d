import { haversineKm } from "@/lib/geo/fare";

export interface ReliefPoint {
  slug: string;
  name: string;
  elevationM: number;
  km: number;
}
export interface Relief {
  points: ReliefPoint[];
  lowest: ReliefPoint;
  highest: ReliefPoint;
  spanM: number;
}

/**
 * Places by distance from `origin` and by height, for the homepage Problem
 * section's copy and its screen-reader table. Heights are the terrain-sampled
 * values from scripts/fix-elevations.py, so every number shown is measured.
 */
export function relief(
  origin: { lng: number; lat: number },
  places: { slug: string; name: string; lng: number; lat: number; elevationM: number | null }[],
): Relief {
  const points = places
    .filter((p): p is typeof p & { elevationM: number } => p.elevationM != null)
    .map((p) => ({ slug: p.slug, name: p.name, elevationM: p.elevationM, km: haversineKm([origin.lng, origin.lat], [p.lng, p.lat]) }))
    .sort((a, b) => a.km - b.km);
  if (points.length === 0) throw new Error("relief() needs at least one place with a height");
  const byHeight = [...points].sort((a, b) => a.elevationM - b.elevationM);
  const lowest = byHeight[0];
  const highest = byHeight[byHeight.length - 1];
  return { points, lowest, highest, spanM: highest.elevationM - lowest.elevationM };
}
