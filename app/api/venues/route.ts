// GET /api/venues?category=&priceMax=&openNow=&q=&slug=&cursor=&limit=
// Cursor-paginated venue list with full-text search + open-now filtering.
//
// `openNow` is computed in JS from the hours JSON, assuming the Asia/Manila
// timezone (Baguio, UTC+8, no DST). Because that filter is post-query, we
// over-fetch a bounded window and slice in memory — fine for this small dataset.
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cacheAside, cacheKey } from "@/lib/redis";
import { errorResponse, jsonWithCache } from "@/lib/http";
import { CACHE_TTLS } from "@/lib/constants";
import type { VenuesResponse, VenueListItem } from "@/types/api";
import type { OpeningHours } from "@/types/geo";

export const dynamic = "force-dynamic";

const VENUE_CATEGORIES = new Set([
  "RESTAURANT", "HOTEL", "TRANSIENT", "SOUVENIR", "FOOD_SHOP",
]);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const OVERFETCH_CAP = 200;

/** Current HH:MM in Asia/Manila as minutes-since-midnight. */
function manilaMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Open-now check. `null` hours are treated as always open (24-7). */
function isOpenNow(hours: OpeningHours | null, nowMin: number): boolean {
  if (!hours) return true;
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (open === close) return true; // full day
  if (close > open) return nowMin >= open && nowMin < close;
  // Overnight window (e.g. 20:00–02:00).
  return nowMin >= open || nowMin < close;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const category = sp.get("category");
  if (category && !VENUE_CATEGORIES.has(category)) {
    return errorResponse("unknown category", 400);
  }

  let priceMax: number | null = null;
  const priceMaxRaw = sp.get("priceMax");
  if (priceMaxRaw) {
    priceMax = Number(priceMaxRaw);
    if (!Number.isInteger(priceMax) || priceMax < 1 || priceMax > 4) {
      return errorResponse("priceMax must be an integer 1-4", 400);
    }
  }

  let limit = DEFAULT_LIMIT;
  const limitRaw = sp.get("limit");
  if (limitRaw) {
    const l = Number(limitRaw);
    if (!Number.isInteger(l) || l < 1) {
      return errorResponse("limit must be a positive integer", 400);
    }
    limit = Math.min(l, MAX_LIMIT);
  }

  const q = sp.get("q")?.trim() || null;
  const cursor = sp.get("cursor") || null;
  const openNow = sp.get("openNow") === "true";

  // Exact slug match — resolves a single venue (used by the map deep-links).
  let slug: string | null = null;
  const slugRaw = sp.get("slug");
  if (slugRaw !== null) {
    const s = slugRaw.trim();
    if (s.length === 0 || s.length > 80) {
      return errorResponse("slug must be 1-80 characters", 400);
    }
    slug = s;
  }

  const key = cacheKey("venues", { category, priceMax, q, slug, cursor, limit, openNow });

  try {
    const data = await cacheAside<VenuesResponse>(key, CACHE_TTLS.venues, async () => {
      const conditions: Prisma.Sql[] = [];
      if (cursor) conditions.push(Prisma.sql`id > ${cursor}`);
      if (category) conditions.push(Prisma.sql`category = ${category}::"VenueCategory"`);
      if (priceMax !== null) conditions.push(Prisma.sql`price_range <= ${priceMax}`);
      if (slug) conditions.push(Prisma.sql`slug = ${slug}`);
      if (q) conditions.push(Prisma.sql`search_tsv @@ plainto_tsquery('english', ${q})`);
      const where = conditions.length
        ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
        : Prisma.empty;

      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT
          id, slug, name,
          category::text AS category,
          price_range AS "priceRange",
          description, hours,
          ST_X(geom) AS lng, ST_Y(geom) AS lat
        FROM venues
        ${where}
        ORDER BY id ASC
        LIMIT ${OVERFETCH_CAP}
      `);

      const nowMin = manilaMinutes();
      const filtered = openNow
        ? rows.filter((r) => isOpenNow((r.hours ?? null) as OpeningHours | null, nowMin))
        : rows;

      const page = filtered.slice(0, limit);
      const items: VenueListItem[] = page.map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        name: r.name as string,
        category: r.category as VenueListItem["category"],
        priceRange: Number(r.priceRange) as VenueListItem["priceRange"],
        description: r.description as string,
        lng: Math.round((r.lng as number) * 1e5) / 1e5,
        lat: Math.round((r.lat as number) * 1e5) / 1e5,
        hours: (r.hours ?? null) as OpeningHours | null,
      }));

      const hasMore = filtered.length > limit;
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

      return { items, nextCursor };
    });

    return jsonWithCache(data, CACHE_TTLS.venues);
  } catch {
    return errorResponse("failed to load venues", 500);
  }
}
