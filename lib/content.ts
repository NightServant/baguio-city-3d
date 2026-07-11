// Server-only content access for the non-map pages.
//
// Every getter tries Postgres first (via Prisma raw SQL, since geometry columns
// are Unsupported and need ST_X/ST_Y/ST_AsGeoJSON), and on ANY error falls back
// to reading + parsing the committed data/geojson files. This keeps the site
// fully renderable while Docker/Postgres are down, and makes it automatically
// DB-backed once the database is up — no page changes required.
//
// Each getter is wrapped in React `cache()` so a single render tree touches each
// source at most once. `fs` usage also guarantees this module never ships to the
// client bundle.
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  OpeningHours,
  Era,
  LandmarkCategory,
  LandmarkCollection,
} from "@/types/geo";
import type { VenueCategory, PriceRange, VenueCollection } from "@/types/venue";
import type { JeepneyRouteCollection } from "@/types/transit";
import type { HistoryData } from "@/types/history";

// ---------------------------------------------------------------------------
// Content shapes (flattened for rendering — geometry reduced to lng/lat)
// ---------------------------------------------------------------------------

export interface Destination {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: LandmarkCategory;
  era: Era | null;
  elevationM: number | null;
  hours: OpeningHours | null;
  lng: number;
  lat: number;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  category: VenueCategory;
  priceRange: PriceRange;
  amenities: string[];
  hours: OpeningHours | null;
  description: string;
  lng: number;
  lat: number;
}

export interface TransitStopContent {
  name: string;
  seq: number;
  lng: number;
  lat: number;
}

export interface TransitRouteContent {
  id: string;
  code: string;
  name: string;
  fareBase: number;
  farePerKm: number;
  stops: TransitStopContent[];
}

// ---------------------------------------------------------------------------
// GeoJSON fallback helpers
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data", "geojson");

async function readGeojson<T>(file: string): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, file), "utf8");
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

async function destinationsFromDb(): Promise<Destination[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      id, slug, name, description,
      category::text AS category,
      era_key AS era,
      elevation_m AS "elevationM",
      hours,
      ST_X(geom) AS lng, ST_Y(geom) AS lat
    FROM destinations
    ORDER BY name ASC
  `);
  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: r.description as string,
    category: r.category as LandmarkCategory,
    era: (r.era ?? null) as Era | null,
    elevationM: r.elevationM == null ? null : Number(r.elevationM),
    hours: (r.hours ?? null) as OpeningHours | null,
    lng: Number(r.lng),
    lat: Number(r.lat),
  }));
}

async function destinationsFromFile(): Promise<Destination[]> {
  const fc = await readGeojson<LandmarkCollection>("landmarks.geojson");
  return fc.features
    .map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      return {
        id: p.slug,
        slug: p.slug,
        name: p.name,
        description: p.description,
        category: p.category,
        era: p.era ?? null,
        elevationM: p.elevation_m ?? null,
        hours: p.hours ?? null,
        lng,
        lat,
      } satisfies Destination;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const getDestinations = cache(async (): Promise<Destination[]> => {
  try {
    return await destinationsFromDb();
  } catch {
    return destinationsFromFile();
  }
});

export const getDestinationBySlug = cache(
  async (slug: string): Promise<Destination | null> => {
    const all = await getDestinations();
    return all.find((d) => d.slug === slug) ?? null;
  },
);

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export interface VenueFilters {
  category?: VenueCategory | null;
}

async function venuesFromDb(): Promise<Venue[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      id, slug, name,
      category::text AS category,
      price_range AS "priceRange",
      amenities, hours, description,
      ST_X(geom) AS lng, ST_Y(geom) AS lat
    FROM venues
    ORDER BY name ASC
  `);
  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    category: r.category as VenueCategory,
    priceRange: Number(r.priceRange) as PriceRange,
    amenities: (r.amenities ?? []) as string[],
    hours: (r.hours ?? null) as OpeningHours | null,
    description: r.description as string,
    lng: Number(r.lng),
    lat: Number(r.lat),
  }));
}

async function venuesFromFile(): Promise<Venue[]> {
  const fc = await readGeojson<VenueCollection>("venues.geojson");
  return fc.features
    .map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      return {
        id: p.slug,
        slug: p.slug,
        name: p.name,
        category: p.category,
        priceRange: p.priceRange,
        amenities: p.amenities ?? [],
        hours: p.hours ?? null,
        description: p.description,
        lng,
        lat,
      } satisfies Venue;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const getAllVenues = cache(async (): Promise<Venue[]> => {
  try {
    return await venuesFromDb();
  } catch {
    return venuesFromFile();
  }
});

export const getVenues = cache(
  async (filters: VenueFilters = {}): Promise<Venue[]> => {
    const all = await getAllVenues();
    if (!filters.category) return all;
    return all.filter((v) => v.category === filters.category);
  },
);

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

async function historyFromDb(): Promise<HistoryData> {
  const eras = await prisma.$queryRaw<HistoryData["eras"]>(Prisma.sql`
    SELECT key::text AS key, name, start_year AS "startYear", end_year AS "endYear", summary
    FROM historical_eras
    ORDER BY start_year ASC
  `);
  const events = await prisma.$queryRaw<
    Array<{
      title: string;
      year: number;
      era: string;
      description: string;
      lng: number | null;
      lat: number | null;
    }>
  >(Prisma.sql`
    SELECT
      title, year, era_key AS era, description,
      CASE WHEN geom IS NULL THEN NULL ELSE ST_X(geom) END AS lng,
      CASE WHEN geom IS NULL THEN NULL ELSE ST_Y(geom) END AS lat
    FROM historical_events
    ORDER BY year ASC
  `);
  return {
    eras,
    events: events.map((e) => ({
      title: e.title,
      year: e.year,
      era: e.era as Era,
      description: e.description,
      coord: e.lng != null && e.lat != null ? [Number(e.lng), Number(e.lat)] : null,
    })),
  };
}

async function historyFromFile(): Promise<HistoryData> {
  const raw = await readFile(path.join(DATA_DIR, "historical.json"), "utf8");
  return JSON.parse(raw) as HistoryData;
}

export const getHistory = cache(async (): Promise<HistoryData> => {
  try {
    return await historyFromDb();
  } catch {
    return historyFromFile();
  }
});

// ---------------------------------------------------------------------------
// Transit
// ---------------------------------------------------------------------------

async function transitFromDb(): Promise<TransitRouteContent[]> {
  const routes = await prisma.$queryRaw<
    Array<{ id: string; code: string; name: string; fareBase: unknown; farePerKm: unknown }>
  >(Prisma.sql`
    SELECT id, code, name, fare_base AS "fareBase", fare_per_km AS "farePerKm"
    FROM transit_routes
    WHERE kind = 'JEEPNEY'::"TransitKind"
    ORDER BY code ASC
  `);
  const stops = await prisma.$queryRaw<
    Array<{ routeId: string; name: string; seq: number; lng: number; lat: number }>
  >(Prisma.sql`
    SELECT route_id AS "routeId", name, seq, ST_X(geom) AS lng, ST_Y(geom) AS lat
    FROM transit_stops
    ORDER BY route_id ASC, seq ASC
  `);
  const stopsByRoute = new Map<string, TransitStopContent[]>();
  for (const s of stops) {
    const list = stopsByRoute.get(s.routeId) ?? [];
    list.push({ name: s.name, seq: s.seq, lng: Number(s.lng), lat: Number(s.lat) });
    stopsByRoute.set(s.routeId, list);
  }
  return routes.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    fareBase: Number(r.fareBase),
    farePerKm: Number(r.farePerKm),
    stops: stopsByRoute.get(r.id) ?? [],
  }));
}

async function transitFromFile(): Promise<TransitRouteContent[]> {
  const fc = await readGeojson<JeepneyRouteCollection>("jeepney-routes.geojson");
  return fc.features
    .map((f) => {
      const p = f.properties;
      return {
        id: p.code,
        code: p.code,
        name: p.name,
        fareBase: p.fareBase,
        farePerKm: p.farePerKm,
        stops: p.stops.map((s) => ({
          name: s.name,
          seq: s.seq,
          lng: s.coord[0],
          lat: s.coord[1],
        })),
      } satisfies TransitRouteContent;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export const getTransitRoutes = cache(async (): Promise<TransitRouteContent[]> => {
  try {
    return await transitFromDb();
  } catch {
    return transitFromFile();
  }
});

// ---------------------------------------------------------------------------
// Open-now hint (Asia/Manila — Baguio is UTC+8, no DST)
// ---------------------------------------------------------------------------

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

/** Open-now check. `null` hours mean always open (24-7 outdoor / round-the-clock). */
export function isOpenNow(hours: OpeningHours | null): boolean {
  if (!hours) return true;
  const now = manilaMinutes();
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (open === close) return true;
  if (close > open) return now >= open && now < close;
  // Overnight window (e.g. 20:00–02:00).
  return now >= open || now < close;
}
