// GET /api/venues/[id]  (id is the cuid PK). Full venue + media. 404 if unknown.
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cacheAside, cacheKey } from "@/lib/redis";
import { errorResponse, jsonWithCache } from "@/lib/http";
import { CACHE_TTLS } from "@/lib/constants";
import type { VenueDetail, MediaItem } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return errorResponse("missing id", 400);

  const key = cacheKey("venues/detail", { id });

  try {
    const venue = await cacheAside<VenueDetail | null>(key, CACHE_TTLS.venues, async () => {
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT
          id, slug, name,
          category::text AS category,
          price_range AS "priceRange",
          amenities, hours, description,
          ST_X(geom) AS lng, ST_Y(geom) AS lat
        FROM venues
        WHERE id = ${id}
        LIMIT 1
      `);
      const row = rows[0];
      if (!row) return null;

      const media = await prisma.$queryRaw<Array<MediaItem>>(Prisma.sql`
        SELECT id, url, kind, alt
        FROM media_assets
        WHERE venue_id = ${id}
        ORDER BY id
      `);

      return {
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        category: row.category as VenueDetail["category"],
        priceRange: Number(row.priceRange) as VenueDetail["priceRange"],
        amenities: (row.amenities ?? null) as string[] | null,
        hours: (row.hours ?? null) as VenueDetail["hours"],
        description: row.description as string,
        lng: Math.round((row.lng as number) * 1e5) / 1e5,
        lat: Math.round((row.lat as number) * 1e5) / 1e5,
        media,
      } satisfies VenueDetail;
    });

    if (!venue) return errorResponse("venue not found", 404);
    return jsonWithCache(venue, CACHE_TTLS.venues);
  } catch {
    return errorResponse("failed to load venue", 500);
  }
}
