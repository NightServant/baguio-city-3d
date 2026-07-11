// GET /api/geo/transit/routes?zoom=
// FeatureCollection of LineStrings with zoom-appropriate geometry + stops.
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cacheAside, cacheKey } from "@/lib/redis";
import { parseZoom } from "@/lib/geo/bbox";
import { toFeatureCollection, quantizeGeometry } from "@/lib/geo/serialize";
import { jsonWithCache, errorResponse } from "@/lib/http";
import { CACHE_TTLS } from "@/lib/constants";
import type { TransitRoutesResponse, TransitRouteFeature, TransitStopLite } from "@/types/api";

export const dynamic = "force-dynamic";

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export async function GET(request: NextRequest) {
  let zoom;
  try {
    zoom = parseZoom(request.nextUrl.searchParams.get("zoom"));
  } catch (e) {
    return errorResponse((e as Error).message, 400);
  }

  // Pick the simplified geometry column for the zoom band, COALESCE to full geom.
  const geomCol =
    zoom < 13 ? Prisma.raw('"geom_z12"') : zoom <= 14 ? Prisma.raw('"geom_z14"') : Prisma.raw('"geom"');

  const key = cacheKey("geo/transit/routes", { zoom });

  try {
    const data = await cacheAside<TransitRoutesResponse>(
      key,
      CACHE_TTLS.transit,
      async () => {
        const routes = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT
            id, code, name,
            kind::text AS kind,
            fare_base::float8 AS "fareBase",
            fare_per_km::float8 AS "farePerKm",
            ST_AsGeoJSON(COALESCE(${geomCol}, "geom"))::json AS geometry
          FROM transit_routes
          ORDER BY code
        `);

        const stopRows = await prisma.$queryRaw<
          Array<{ routeId: string; seq: number; name: string; lng: number; lat: number }>
        >(Prisma.sql`
          SELECT
            route_id AS "routeId", seq, name,
            ST_X(geom) AS lng, ST_Y(geom) AS lat
          FROM transit_stops
          ORDER BY route_id, seq
        `);

        const stopsByRoute = new Map<string, TransitStopLite[]>();
        for (const s of stopRows) {
          const list = stopsByRoute.get(s.routeId) ?? [];
          list.push({ name: s.name, seq: s.seq, lng: round5(s.lng), lat: round5(s.lat) });
          stopsByRoute.set(s.routeId, list);
        }

        const features: TransitRouteFeature[] = routes.map((r) => ({
          type: "Feature",
          geometry: quantizeGeometry(
            r.geometry as { type: string; coordinates: unknown },
          ) as TransitRouteFeature["geometry"],
          properties: {
            id: r.id as string,
            code: r.code as string,
            name: r.name as string,
            kind: r.kind as TransitRouteFeature["properties"]["kind"],
            fareBase: Number(r.fareBase),
            farePerKm: Number(r.farePerKm),
            stops: stopsByRoute.get(r.id as string) ?? [],
          },
        }));

        return toFeatureCollection(features);
      },
    );

    return jsonWithCache(data, CACHE_TTLS.transit);
  } catch {
    return errorResponse("failed to load transit routes", 500);
  }
}
