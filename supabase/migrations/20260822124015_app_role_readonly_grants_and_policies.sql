-- `baguio_app` is the application's login role: read-only, and unlike `postgres`
-- it is not a table owner, so RLS applies to it. The app only ever SELECTs, so
-- grant exactly that plus a permissive read policy per table. anon/authenticated
-- (the PostgREST roles) still have no policy and therefore still see nothing.
--
-- The role itself (and its password) is created by supabase/roles.sql, which is
-- gitignored. Recreate it with: supabase db push --include-roles

GRANT USAGE ON SCHEMA public TO baguio_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO baguio_app;

CREATE POLICY app_read ON "historical_eras"   FOR SELECT TO baguio_app USING (true);
CREATE POLICY app_read ON "destinations"      FOR SELECT TO baguio_app USING (true);
CREATE POLICY app_read ON "landmarks"         FOR SELECT TO baguio_app USING (true);
CREATE POLICY app_read ON "historical_events" FOR SELECT TO baguio_app USING (true);
CREATE POLICY app_read ON "transit_routes"    FOR SELECT TO baguio_app USING (true);
CREATE POLICY app_read ON "transit_stops"     FOR SELECT TO baguio_app USING (true);
CREATE POLICY app_read ON "venues"            FOR SELECT TO baguio_app USING (true);
CREATE POLICY app_read ON "media_assets"      FOR SELECT TO baguio_app USING (true);
CREATE POLICY app_read ON "districts"         FOR SELECT TO baguio_app USING (true);
