// GET /api/history/eras
// Historical eras with their events nested, both ordered chronologically.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cacheAside, cacheKey } from "@/lib/redis";
import { errorResponse, jsonWithCache } from "@/lib/http";
import { CACHE_TTLS } from "@/lib/constants";
import type { ErasResponse, EraWithEvents, EraEvent } from "@/types/api";

export const dynamic = "force-dynamic";

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export async function GET() {
  const key = cacheKey("history/eras");

  try {
    const data = await cacheAside<ErasResponse>(key, CACHE_TTLS.history, async () => {
      const eras = await prisma.$queryRaw<
        Array<{ key: string; name: string; startYear: number; endYear: number | null; summary: string }>
      >(Prisma.sql`
        SELECT key::text AS key, name, start_year AS "startYear", end_year AS "endYear", summary
        FROM historical_eras
        ORDER BY start_year ASC
      `);

      const events = await prisma.$queryRaw<
        Array<{
          id: string;
          eraKey: string;
          title: string;
          year: number;
          description: string;
          lng: number | null;
          lat: number | null;
        }>
      >(Prisma.sql`
        SELECT
          id, era_key AS "eraKey", title, year, description,
          CASE WHEN geom IS NULL THEN NULL ELSE ST_X(geom) END AS lng,
          CASE WHEN geom IS NULL THEN NULL ELSE ST_Y(geom) END AS lat
        FROM historical_events
        ORDER BY year ASC
      `);

      const eventsByEra = new Map<string, EraEvent[]>();
      for (const e of events) {
        const list = eventsByEra.get(e.eraKey) ?? [];
        const item: EraEvent = {
          id: e.id,
          title: e.title,
          year: e.year,
          description: e.description,
        };
        if (e.lng != null && e.lat != null) {
          item.lng = round5(e.lng);
          item.lat = round5(e.lat);
        }
        list.push(item);
        eventsByEra.set(e.eraKey, list);
      }

      const result: EraWithEvents[] = eras.map((era) => ({
        key: era.key as EraWithEvents["key"],
        name: era.name,
        startYear: era.startYear,
        endYear: era.endYear,
        summary: era.summary,
        events: eventsByEra.get(era.key) ?? [],
      }));

      return { eras: result };
    });

    return jsonWithCache(data, CACHE_TTLS.history);
  } catch {
    return errorResponse("failed to load history", 500);
  }
}
