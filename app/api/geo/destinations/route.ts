// GET /api/geo/destinations?bbox=&zoom=&category=&era=
// FeatureCollection of destination Points (capped at 200).
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cacheAside, cacheKey } from "@/lib/redis";
import { parseBBox, parseZoom } from "@/lib/geo/bbox";
import { rowsToCollection } from "@/lib/geo/serialize";
import { jsonWithCache, errorResponse } from "@/lib/http";
import { CACHE_TTLS } from "@/lib/constants";
import type { DestinationsResponse, DestinationListProps } from "@/types/api";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set([
  "NATURE", "PARK", "VIEWPOINT", "HERITAGE", "MARKET", "MUSEUM", "CHURCH", "RECREATION",
]);
const ERAS = new Set(["PRE_COLONIAL", "AMERICAN_COLONIAL", "POST_WAR", "MODERN"]);

const MAX_FEATURES = 200;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  let bbox;
  let zoom;
  try {
    bbox = parseBBox(sp.get("bbox"));
    zoom = parseZoom(sp.get("zoom"));
  } catch (e) {
    return errorResponse((e as Error).message, 400);
  }

  const category = sp.get("category");
  const era = sp.get("era");
  if (category && !CATEGORIES.has(category)) {
    return errorResponse("unknown category", 400);
  }
  if (era && !ERAS.has(era)) {
    return errorResponse("unknown era", 400);
  }

  const key = cacheKey("geo/destinations", {
    bbox: bbox ? `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}` : null,
    zoom,
    category,
    era,
  });

  try {
    const data = await cacheAside<DestinationsResponse>(
      key,
      CACHE_TTLS.destinations,
      async () => {
        const conditions: Prisma.Sql[] = [];
        if (bbox) {
          conditions.push(
            Prisma.sql`geom && ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326)`,
          );
        }
        if (category) conditions.push(Prisma.sql`category = ${category}::"Category"`);
        if (era) conditions.push(Prisma.sql`era_key = ${era}::"EraKey"`);
        const where = conditions.length
          ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
          : Prisma.empty;

        const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT
            id, slug, name,
            category::text AS category,
            era_key AS era,
            elevation_m AS "elevationM",
            (hours IS NOT NULL) AS "hasHours",
            ST_AsGeoJSON(geom)::json AS geometry
          FROM destinations
          ${where}
          LIMIT ${MAX_FEATURES}
        `);

        return rowsToCollection(rows, (r) => ({
          id: r.id as string,
          slug: r.slug as string,
          name: r.name as string,
          category: r.category as DestinationListProps["category"],
          era: (r.era ?? null) as DestinationListProps["era"],
          elevationM: (r.elevationM ?? null) as number | null,
          hasHours: Boolean(r.hasHours),
        })) as DestinationsResponse;
      },
    );

    return jsonWithCache(data, CACHE_TTLS.destinations);
  } catch {
    return errorResponse("failed to load destinations", 500);
  }
}
