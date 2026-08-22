-- The app reaches Postgres directly through Prisma (which bypasses RLS), so no
-- policies are needed for it to work. Enabling RLS with zero policies closes the
-- auto-generated PostgREST surface, which would otherwise serve every row to
-- anyone holding the public anon key.
ALTER TABLE "historical_eras"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "destinations"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "landmarks"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "historical_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transit_routes"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transit_stops"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "venues"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_assets"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "districts"         ENABLE ROW LEVEL SECURITY;
