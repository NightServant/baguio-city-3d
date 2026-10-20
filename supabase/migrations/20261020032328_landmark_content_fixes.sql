-- Landmark copy corrected against its sources (finishes plan Task 8, owner's instruction 2026-10-20): Wikipedia's
-- The Mansion (Baguio) and Baguio Botanical Garden, the OSM roads at Igorot Stone Kingdom, and BCDA's 14 May 2025
-- release on Mile Hi's redevelopment. Mile Hi moves from VIEWPOINT (no deck exists) to MARKET. Idempotent.
DO $$
DECLARE n integer;
BEGIN
  UPDATE "destinations" SET "description" = 'The official summer residence of the President of the Philippines, built in 1908 and guarded by an ornate wrought-iron gate. Its manicured lawns and reflecting fountain sit directly across from Wright Park. Visitors may photograph the grounds and view the small exhibit hall near the entrance.' WHERE "slug" = 'the-mansion';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'destinations: the-mansion description expected 1 row, updated %', n; END IF;
  UPDATE "destinations" SET "description" = 'A lush terraced garden along Leonard Wood Road showcasing native pine, ferns, and Cordillera flora amid stone huts and Igorot woodcarvings. Also known as the Igorot Village for those carvings and huts, and formerly as Imelda Park and the Botanical and Zoological Garden, it honors the highland communities who shaped the region''s culture. Its shaded paths and small waterfalls offer a quiet counterpoint to the busy parks nearby.' WHERE "slug" = 'botanical-garden';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'destinations: botanical-garden description expected 1 row, updated %', n; END IF;
  UPDATE "destinations" SET "description" = 'A hillside maze of dry-stone terraces, arches, and caves built to honor Cordillera stone-craft and highland mythology. Visitors climb through winding rock passages to viewpoints that celebrate Igorot heritage and engineering. The whimsical, castle-like complex has become a popular modern attraction off Longlong Road.' WHERE "slug" = 'igorot-stone-kingdom';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'destinations: igorot-stone-kingdom description expected 1 row, updated %', n; END IF;
  UPDATE "destinations" SET "description" = 'Named for its elevation of about a mile above sea level, the Mile Hi property in Camp John Hay was once an indoor recreation center with a bowling alley, billiard and ping-pong tables, arcade games and a snack bar. In May 2025 the Bases Conversion and Development Authority opened bidding for its redevelopment: a 25-year lease to restore the 6,647-square-meter site on Sheridan Drive as an eco-hostel with upscale shops and restaurants, keeping its historical character.' WHERE "slug" = 'mile-hi-cjh-viewdeck';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'destinations: mile-hi-cjh-viewdeck description expected 1 row, updated %', n; END IF;
  UPDATE "destinations" SET "category" = 'MARKET'::"Category" WHERE "slug" = 'mile-hi-cjh-viewdeck';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'destinations: mile-hi-cjh-viewdeck category expected 1 row, updated %', n; END IF;
END $$;
