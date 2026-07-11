// GET /api/geo/destinations/[slug]
// Single destination Feature with full properties. 404 if unknown.
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cacheAside, cacheKey } from "@/lib/redis";
import { rowToFeature } from "@/lib/geo/serialize";
import { jsonWithCache, errorResponse } from "@/lib/http";
import { CACHE_TTLS } from "@/lib/constants";
import type { DestinationFeature, MediaItem, LandmarkInfo } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) return errorResponse("missing slug", 400);

  const key = cacheKey("geo/destinations/detail", { slug });

  try {
    const feature = await cacheAside<DestinationFeature | null>(
      key,
      CACHE_TTLS.destinations,
      async () => {
        const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT
            id, slug, name, description,
            category::text AS category,
            era_key AS era,
            elevation_m AS "elevationM",
            hours,
            ST_AsGeoJSON(geom)::json AS geometry
          FROM destinations
          WHERE slug = ${slug}
          LIMIT 1
        `);
        const row = rows[0];
        if (!row) return null;

        const id = row.id as string;

        const landmarks = await prisma.$queryRaw<Array<LandmarkInfo>>(Prisma.sql`
          SELECT
            mesh_url AS "meshUrl",
            mesh_scale AS "meshScale",
            rotation_deg AS "rotationDeg",
            altitude_m AS "altitudeM"
          FROM landmarks
          WHERE destination_id = ${id}
          LIMIT 1
        `);

        const media = await prisma.$queryRaw<Array<MediaItem>>(Prisma.sql`
          SELECT id, url, kind, alt
          FROM media_assets
          WHERE destination_id = ${id}
          ORDER BY id
        `);

        const { geometry, hours, ...rest } = row;
        return rowToFeature<DestinationFeature["geometry"], DestinationFeature["properties"]>({
          geometry,
          ...rest,
          hours: (hours ?? null) as DestinationFeature["properties"]["hours"],
          hasHours: hours != null,
          media,
          landmark: landmarks[0] ?? null,
        }) as DestinationFeature;
      },
    );

    if (!feature) return errorResponse("destination not found", 404);
    return jsonWithCache(feature, CACHE_TTLS.destinations);
  } catch {
    return errorResponse("failed to load destination", 500);
  }
}
