-- Baguio City 3D — initial schema (PostGIS).
-- Hand-authored to create geometry columns, spatial (GIST) indexes, and a
-- full-text (GIN) index that Prisma cannot express from schema.prisma.

-- Extensions -----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enums ----------------------------------------------------------------------
CREATE TYPE "Category" AS ENUM (
  'NATURE', 'PARK', 'VIEWPOINT', 'HERITAGE', 'MARKET', 'MUSEUM', 'CHURCH', 'RECREATION'
);

CREATE TYPE "EraKey" AS ENUM (
  'PRE_COLONIAL', 'AMERICAN_COLONIAL', 'POST_WAR', 'MODERN'
);

CREATE TYPE "TransitKind" AS ENUM ('JEEPNEY', 'TAXI_SIM');

CREATE TYPE "VenueCategory" AS ENUM (
  'RESTAURANT', 'HOTEL', 'TRANSIENT', 'SOUVENIR', 'FOOD_SHOP'
);

-- historical_eras ------------------------------------------------------------
CREATE TABLE "historical_eras" (
  "key"        "EraKey" NOT NULL,
  "name"       TEXT NOT NULL,
  "start_year" INTEGER NOT NULL,
  "end_year"   INTEGER,
  "summary"    TEXT NOT NULL,
  CONSTRAINT "historical_eras_pkey" PRIMARY KEY ("key")
);

-- destinations ---------------------------------------------------------------
CREATE TABLE "destinations" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category"    "Category" NOT NULL,
  "elevation_m" DOUBLE PRECISION,
  "hours"       JSONB,
  "era_key"     "EraKey",
  "geom"        geometry(Point, 4326) NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations" ("slug");
CREATE INDEX "destinations_geom_idx" ON "destinations" USING GIST ("geom");
ALTER TABLE "destinations"
  ADD CONSTRAINT "destinations_era_key_fkey"
  FOREIGN KEY ("era_key") REFERENCES "historical_eras" ("key")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- landmarks ------------------------------------------------------------------
CREATE TABLE "landmarks" (
  "id"             TEXT NOT NULL,
  "destination_id" TEXT NOT NULL,
  "mesh_url"       TEXT NOT NULL,
  "mesh_scale"     DOUBLE PRECISION NOT NULL,
  "rotation_deg"   DOUBLE PRECISION NOT NULL,
  "altitude_m"     DOUBLE PRECISION NOT NULL,
  CONSTRAINT "landmarks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "landmarks_destination_id_idx" ON "landmarks" ("destination_id");
ALTER TABLE "landmarks"
  ADD CONSTRAINT "landmarks_destination_id_fkey"
  FOREIGN KEY ("destination_id") REFERENCES "destinations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- historical_events ----------------------------------------------------------
CREATE TABLE "historical_events" (
  "id"          TEXT NOT NULL,
  "era_key"     "EraKey" NOT NULL,
  "title"       TEXT NOT NULL,
  "year"        INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "geom"        geometry(Point, 4326),
  CONSTRAINT "historical_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "historical_events_era_key_idx" ON "historical_events" ("era_key");
CREATE INDEX "historical_events_geom_idx" ON "historical_events" USING GIST ("geom");
ALTER TABLE "historical_events"
  ADD CONSTRAINT "historical_events_era_key_fkey"
  FOREIGN KEY ("era_key") REFERENCES "historical_eras" ("key")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- transit_routes -------------------------------------------------------------
CREATE TABLE "transit_routes" (
  "id"          TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "kind"        "TransitKind" NOT NULL,
  "fare_base"   DECIMAL(10, 2) NOT NULL,
  "fare_per_km" DECIMAL(10, 2) NOT NULL,
  "geom"        geometry(LineString, 4326) NOT NULL,
  "geom_z12"    geometry(LineString, 4326),
  "geom_z14"    geometry(LineString, 4326),
  CONSTRAINT "transit_routes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transit_routes_code_key" ON "transit_routes" ("code");
CREATE INDEX "transit_routes_geom_idx" ON "transit_routes" USING GIST ("geom");
CREATE INDEX "transit_routes_geom_z12_idx" ON "transit_routes" USING GIST ("geom_z12");
CREATE INDEX "transit_routes_geom_z14_idx" ON "transit_routes" USING GIST ("geom_z14");

-- transit_stops --------------------------------------------------------------
CREATE TABLE "transit_stops" (
  "id"       TEXT NOT NULL,
  "route_id" TEXT NOT NULL,
  "seq"      INTEGER NOT NULL,
  "name"     TEXT NOT NULL,
  "geom"     geometry(Point, 4326) NOT NULL,
  CONSTRAINT "transit_stops_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "transit_stops_route_id_idx" ON "transit_stops" ("route_id");
CREATE INDEX "transit_stops_geom_idx" ON "transit_stops" USING GIST ("geom");
ALTER TABLE "transit_stops"
  ADD CONSTRAINT "transit_stops_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "transit_routes" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- venues ---------------------------------------------------------------------
CREATE TABLE "venues" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "category"    "VenueCategory" NOT NULL,
  "price_range" INTEGER NOT NULL,
  "amenities"   JSONB,
  "hours"       JSONB,
  "description" TEXT NOT NULL,
  "geom"        geometry(Point, 4326) NOT NULL,
  "search_tsv"  tsvector GENERATED ALWAYS AS (
                  to_tsvector(
                    'english',
                    coalesce("name", '') || ' ' || coalesce("description", '')
                  )
                ) STORED,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "venues_slug_key" ON "venues" ("slug");
CREATE INDEX "venues_geom_idx" ON "venues" USING GIST ("geom");
CREATE INDEX "venues_search_tsv_idx" ON "venues" USING GIN ("search_tsv");

-- media_assets ---------------------------------------------------------------
CREATE TABLE "media_assets" (
  "id"             TEXT NOT NULL,
  "url"            TEXT NOT NULL,
  "kind"           TEXT NOT NULL,
  "alt"            TEXT NOT NULL,
  "destination_id" TEXT,
  "venue_id"       TEXT,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "media_assets_destination_id_idx" ON "media_assets" ("destination_id");
CREATE INDEX "media_assets_venue_id_idx" ON "media_assets" ("venue_id");
ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_destination_id_fkey"
  FOREIGN KEY ("destination_id") REFERENCES "destinations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_venue_id_fkey"
  FOREIGN KEY ("venue_id") REFERENCES "venues" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- districts ------------------------------------------------------------------
CREATE TABLE "districts" (
  "id"   TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "geom" geometry(Polygon, 4326) NOT NULL,
  CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "districts_geom_idx" ON "districts" USING GIST ("geom");
