// Shape checks for untrusted route parameters. SQL is already parameterized;
// these keep junk out of queries and out of the Redis key space.
import { SERVICE_AREA } from "@/lib/constants";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID = /^[a-z0-9-]{20,40}$/i; // cuid (local) or uuid (Supabase seed)
const ROUTE_CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export const MAX_QUERY_LENGTH = 80;

export const isSlug = (s: string) => s.length <= 80 && SLUG.test(s);
export const isId = (s: string) => ID.test(s);
export const isRouteCode = (s: string) => s.length <= 16 && ROUTE_CODE.test(s);

export function inServiceArea(lng: number, lat: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = SERVICE_AREA;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
