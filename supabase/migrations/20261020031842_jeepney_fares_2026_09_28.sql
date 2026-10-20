-- Traditional jeepney fares from the LTFRB PUJ General Fare Guide, effective 2026-09-28 (owner-supplied image,
-- 2026-10-20): P14.00 for the first 4 km, P2.00 a km after. Was P13.00 / P1.80. Idempotent.
DO $$
DECLARE n integer;
BEGIN
  UPDATE "transit_routes" SET "fare_base" = 14.00, "fare_per_km" = 2.00 WHERE "kind" = 'JEEPNEY'::"TransitKind";
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN RAISE EXCEPTION 'transit_routes: expected 6 jeepney routes, updated %', n; END IF;
END $$;
