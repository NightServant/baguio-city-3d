-- The app reads through baguio_app over the pooler and never calls the Data
-- API (PostgREST), so anon and authenticated need nothing in public. RLS
-- already blocks them on app tables; this removes the grants underneath,
-- including the INSERT/UPDATE/DELETE they held on PostGIS's spatial_ref_sys.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Intentionally not revoking EXECUTE on functions/from PUBLIC here:
-- baguio_app calls PostGIS functions (e.g. ST_MakePoint, ST_Simplify) through
-- that grant, and PUBLIC's default EXECUTE isn't part of the Data API attack
-- surface this migration is closing — it's an authenticated, direct-Postgres
-- role's own permission to call ordinary functions, not a PostgREST exposure.
