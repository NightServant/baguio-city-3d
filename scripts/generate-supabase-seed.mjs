// Emits supabase/seed.sql from data/geojson, mirroring prisma/seed.ts.
//
// Two seeders exist because they need different credentials: `prisma db seed`
// needs DATABASE_URL (the database password), while `supabase db push
// --include-seed` authenticates with the CLI access token alone. Both read the
// same GeoJSON, so regenerate rather than hand-editing supabase/seed.sql.
//
// Run: npm run seed:supabase:generate
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = process.argv[2] ?? process.cwd();
const DATA_DIR = path.join(ROOT, "data", "geojson");
const OUT = path.join(ROOT, "supabase", "seed.sql");

const readJson = (f) => {
  const full = path.join(DATA_DIR, f);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, "utf8"));
};
const feats = (fc) => (fc && Array.isArray(fc.features) ? fc.features : []);

// Postgres literal quoting. standard_conforming_strings is on, so only the
// single quote needs doubling.
const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? "NULL" : String(Number(v)));
const json = (v) => (v == null ? "NULL" : `${q(JSON.stringify(v))}::jsonb`);
const pt = (lng, lat) => `ST_SetSRID(ST_MakePoint(${num(lng)}, ${num(lat)}), 4326)`;
const geom = (g) => `ST_SetSRID(ST_GeomFromGeoJSON(${q(JSON.stringify(g))}), 4326)`;

const landmarksFc = readJson("landmarks.geojson");
const routesFc = readJson("jeepney-routes.geojson");
const districtsFc = readJson("districts.geojson");
const hist = readJson("historical.json");
const venuesFc = readJson("venues.geojson");

const out = [];
const counts = {};
out.push("-- GENERATED FILE — do not edit by hand.");
out.push("-- Source: data/geojson · Regenerate: npm run seed:supabase:generate");
out.push("-- Apply:  supabase db push --include-seed");
out.push("BEGIN;");
out.push(`TRUNCATE TABLE
  "media_assets", "landmarks", "transit_stops", "transit_routes",
  "historical_events", "destinations", "venues", "districts", "historical_eras"
  RESTART IDENTITY CASCADE;`);

// Eras first — destinations and events reference them.
const eras = hist && Array.isArray(hist.eras) ? hist.eras : [];
for (const e of eras) {
  out.push(
    `INSERT INTO "historical_eras" ("key","name","start_year","end_year","summary") VALUES (` +
      `${q(e.key)}::"EraKey", ${q(e.name)}, ${num(e.startYear ?? e.start_year)}, ` +
      `${num(e.endYear ?? e.end_year ?? null)}, ${q(e.summary)});`,
  );
}
counts.eras = eras.length;

let landmarkCount = 0;
for (const f of feats(landmarksFc)) {
  const p = f.properties ?? {};
  const [lng, lat] = f.geometry.coordinates;
  const id = randomUUID();
  out.push(
    `INSERT INTO "destinations" ("id","slug","name","description","category","elevation_m","hours","era_key","geom") VALUES (` +
      `${q(id)}, ${q(p.slug)}, ${q(p.name)}, ${q(p.description)}, ${q(p.category)}::"Category", ` +
      `${num(p.elevation_m ?? null)}, ${json(p.hours ?? null)}, ` +
      `${p.era == null ? "NULL" : `${q(p.era)}::"EraKey"`}, ${pt(lng, lat)});`,
  );
  if (p.meshUrl) {
    out.push(
      `INSERT INTO "landmarks" ("id","destination_id","mesh_url","mesh_scale","rotation_deg","altitude_m") VALUES (` +
        `${q(randomUUID())}, ${q(id)}, ${q(p.meshUrl)}, 1, 0, 0);`,
    );
    landmarkCount++;
  }
}
counts.destinations = feats(landmarksFc).length;
counts.landmarks = landmarkCount;

const events = hist && Array.isArray(hist.events) ? hist.events : [];
for (const ev of events) {
  const c = ev.coord;
  out.push(
    `INSERT INTO "historical_events" ("id","era_key","title","year","description","geom") VALUES (` +
      `${q(randomUUID())}, ${q(ev.era)}::"EraKey", ${q(ev.title)}, ${num(ev.year)}, ` +
      `${q(ev.description)}, ${c ? pt(c[0], c[1]) : "NULL"});`,
  );
}
counts.events = events.length;

let stopCount = 0;
for (const f of feats(routesFc)) {
  const p = f.properties ?? {};
  const id = randomUUID();
  out.push(
    `INSERT INTO "transit_routes" ("id","code","name","kind","fare_base","fare_per_km","geom") VALUES (` +
      `${q(id)}, ${q(p.code)}, ${q(p.name)}, ${q(p.kind)}::"TransitKind", ` +
      `${num(p.fareBase)}, ${num(p.farePerKm)}, ${geom(f.geometry)});`,
  );
  for (const s of Array.isArray(p.stops) ? p.stops : []) {
    const [lng, lat] = s.coord;
    out.push(
      `INSERT INTO "transit_stops" ("id","route_id","seq","name","geom") VALUES (` +
        `${q(randomUUID())}, ${q(id)}, ${num(s.seq)}, ${q(s.name)}, ${pt(lng, lat)});`,
    );
    stopCount++;
  }
}
counts.routes = feats(routesFc).length;
counts.stops = stopCount;

// Simplified geometries for the lower zoom tiers.
out.push(
  `UPDATE "transit_routes" SET "geom_z12" = ST_Simplify("geom", 0.0012), "geom_z14" = ST_Simplify("geom", 0.0004);`,
);

for (const f of feats(venuesFc)) {
  const p = f.properties ?? {};
  const [lng, lat] = f.geometry.coordinates;
  out.push(
    `INSERT INTO "venues" ("id","slug","name","category","price_range","amenities","hours","description","geom") VALUES (` +
      `${q(randomUUID())}, ${q(p.slug)}, ${q(p.name)}, ${q(p.category)}::"VenueCategory", ` +
      `${num(p.priceRange)}, ${json(p.amenities ?? null)}, ${json(p.hours ?? null)}, ` +
      `${q(p.description)}, ${pt(lng, lat)});`,
  );
}
counts.venues = feats(venuesFc).length;

for (const f of feats(districtsFc)) {
  const p = f.properties ?? {};
  out.push(
    `INSERT INTO "districts" ("id","name","geom") VALUES (${q(randomUUID())}, ${q(p.name)}, ${geom(f.geometry)});`,
  );
}
counts.districts = feats(districtsFc).length;

out.push("COMMIT;");
writeFileSync(OUT, out.join("\n") + "\n");
console.log("expected:", JSON.stringify(counts));
