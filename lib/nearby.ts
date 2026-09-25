import { haversineKm } from "@/lib/geo/fare";

export interface Located {
  lng: number;
  lat: number;
}

/** The `n` items closest to `origin`, nearest first, with distance in km. */
export function nearest<T extends Located>(origin: Located, items: readonly T[], n: number): { item: T; km: number }[] {
  return items
    .map((item) => ({ item, km: haversineKm([origin.lng, origin.lat], [item.lng, item.lat]) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}
