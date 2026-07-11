// Idempotent database seed for Baguio City 3D.
//
// Reads the GeoJSON/JSON files produced by the data agent under
// `data/geojson/` and loads them into PostGIS. Geometry is inserted with raw
// SQL (`ST_MakePoint` / `ST_GeomFromGeoJSON`) because Prisma has no geometry
// type. Simplified route geometries (`geom_z12` / `geom_z14`) are computed with
// `ST_Simplify` after insert. Re-running truncates first, so it is safe to run
// repeatedly.
//
// Run: `node --experimental-strip-types prisma/seed.ts`
//   or: `prisma db seed`
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires a driver adapter for the runtime client. The connection
// string comes from `.env` (loaded above via `dotenv/config`).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DATA_DIR = path.join(process.cwd(), "data", "geojson");

function readJson(file: string): any | null {
  const full = path.join(DATA_DIR, file);
  if (!existsSync(full)) {
    console.warn(`[seed] skipping ${file} — not found at ${full}`);
    return null;
  }
  return JSON.parse(readFileSync(full, "utf8"));
}

function features(fc: any): any[] {
  return fc && Array.isArray(fc.features) ? fc.features : [];
}

async function seedEras(hist: any) {
  const eras: any[] = hist && Array.isArray(hist.eras) ? hist.eras : [];
  for (const e of eras) {
    const key = e.key;
    const startYear = e.startYear ?? e.start_year;
    const endYear = e.endYear ?? e.end_year ?? null;
    await prisma.$executeRaw`
      INSERT INTO "historical_eras" ("key", "name", "start_year", "end_year", "summary")
      VALUES (${key}::"EraKey", ${e.name}, ${startYear}, ${endYear}, ${e.summary})
    `;
  }
  return eras.length;
}

async function seedDestinations(fc: any) {
  let destCount = 0;
  let landmarkCount = 0;
  for (const f of features(fc)) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry.coordinates;
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "destinations"
        ("id", "slug", "name", "description", "category", "elevation_m", "hours", "era_key", "geom")
      VALUES (
        ${id}, ${p.slug}, ${p.name}, ${p.description}, ${p.category}::"Category",
        ${p.elevation_m ?? null},
        ${p.hours ? JSON.stringify(p.hours) : null}::jsonb,
        ${p.era ?? null}::"EraKey",
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      )
    `;
    destCount++;

    if (p.meshUrl) {
      await prisma.$executeRaw`
        INSERT INTO "landmarks"
          ("id", "destination_id", "mesh_url", "mesh_scale", "rotation_deg", "altitude_m")
        VALUES (${randomUUID()}, ${id}, ${p.meshUrl}, ${1}, ${0}, ${0})
      `;
      landmarkCount++;
    }
  }
  return { destCount, landmarkCount };
}

async function seedEvents(hist: any) {
  const events: any[] = hist && Array.isArray(hist.events) ? hist.events : [];
  for (const ev of events) {
    const coord: [number, number] | undefined = ev.coord;
    const geom = coord
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${coord[0]}, ${coord[1]}), 4326)`
      : Prisma.sql`NULL`;
    await prisma.$executeRaw`
      INSERT INTO "historical_events" ("id", "era_key", "title", "year", "description", "geom")
      VALUES (${randomUUID()}, ${ev.era}::"EraKey", ${ev.title}, ${ev.year}, ${ev.description}, ${geom})
    `;
  }
  return events.length;
}

async function seedRoutes(fc: any) {
  let routeCount = 0;
  let stopCount = 0;
  for (const f of features(fc)) {
    const p = f.properties ?? {};
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "transit_routes"
        ("id", "code", "name", "kind", "fare_base", "fare_per_km", "geom")
      VALUES (
        ${id}, ${p.code}, ${p.name}, ${p.kind}::"TransitKind",
        ${p.fareBase}, ${p.farePerKm},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326)
      )
    `;
    routeCount++;

    const stops: any[] = Array.isArray(p.stops) ? p.stops : [];
    for (const s of stops) {
      const [lng, lat] = s.coord;
      await prisma.$executeRaw`
        INSERT INTO "transit_stops" ("id", "route_id", "seq", "name", "geom")
        VALUES (${randomUUID()}, ${id}, ${s.seq}, ${s.name},
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
      `;
      stopCount++;
    }
  }

  // Precompute simplified geometries for lower zoom levels.
  await prisma.$executeRaw`
    UPDATE "transit_routes"
    SET "geom_z12" = ST_Simplify("geom", 0.0012),
        "geom_z14" = ST_Simplify("geom", 0.0004)
  `;
  return { routeCount, stopCount };
}

async function seedVenues(fc: any) {
  let count = 0;
  for (const f of features(fc)) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry.coordinates;
    await prisma.$executeRaw`
      INSERT INTO "venues"
        ("id", "slug", "name", "category", "price_range", "amenities", "hours", "description", "geom")
      VALUES (
        ${randomUUID()}, ${p.slug}, ${p.name}, ${p.category}::"VenueCategory",
        ${p.priceRange},
        ${p.amenities ? JSON.stringify(p.amenities) : null}::jsonb,
        ${p.hours ? JSON.stringify(p.hours) : null}::jsonb,
        ${p.description},
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      )
    `;
    count++;
  }
  return count;
}

async function seedDistricts(fc: any) {
  let count = 0;
  for (const f of features(fc)) {
    const p = f.properties ?? {};
    await prisma.$executeRaw`
      INSERT INTO "districts" ("id", "name", "geom")
      VALUES (${randomUUID()}, ${p.name},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326))
    `;
    count++;
  }
  return count;
}

async function main() {
  const landmarks = readJson("landmarks.geojson");
  const routes = readJson("jeepney-routes.geojson");
  const districts = readJson("districts.geojson");
  const historical = readJson("historical.json");
  const venues = readJson("venues.geojson");

  // Idempotent: clear everything first, respecting FKs via CASCADE.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "media_assets", "landmarks", "transit_stops", "transit_routes",
      "historical_events", "destinations", "venues", "districts", "historical_eras"
    RESTART IDENTITY CASCADE
  `);

  // Eras must exist before destinations / events reference them.
  const eraCount = historical ? await seedEras(historical) : 0;
  const { destCount, landmarkCount } = landmarks
    ? await seedDestinations(landmarks)
    : { destCount: 0, landmarkCount: 0 };
  const eventCount = historical ? await seedEvents(historical) : 0;
  const { routeCount, stopCount } = routes
    ? await seedRoutes(routes)
    : { routeCount: 0, stopCount: 0 };
  const venueCount = venues ? await seedVenues(venues) : 0;
  const districtCount = districts ? await seedDistricts(districts) : 0;

  console.log("[seed] done:", {
    eras: eraCount,
    destinations: destCount,
    landmarks: landmarkCount,
    events: eventCount,
    routes: routeCount,
    stops: stopCount,
    venues: venueCount,
    districts: districtCount,
  });
}

main()
  .catch((e) => {
    console.error("[seed] failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
