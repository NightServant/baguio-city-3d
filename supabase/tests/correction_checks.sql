-- The automated-corrections gate (finishes plan Task 13). Runs in a transaction that is rolled back.
-- A fresh local stack can't be built here (the older data migrations expect the seed's rows, which load after them),
-- so it runs against the linked project with the migration in the same aborted transaction:
--   W=.superpowers/sdd/2026-10-09-baguio-3d-finishes; { echo 'BEGIN;'; cat supabase/migrations/*_correction_checks.sql;
--     sed -e '/^BEGIN;$/d' -e '/^ROLLBACK;$/d' -e "s/RAISE NOTICE 'correction_checks: all passed'/RAISE EXCEPTION 'correction_checks: all passed'/" \
--     supabase/tests/correction_checks.sql; echo 'ROLLBACK;'; } > $W/cc-run.sql && supabase db query --linked -f $W/cc-run.sql
-- Passing shows as the error "correction_checks: all passed": the deliberate error aborts the transaction, so nothing,
-- the migration included, is kept whatever transaction the API wraps it in.
BEGIN;
DO $$
DECLARE rid bigint; rid2 bigint; tok uuid; out text; chg bigint; n int;
BEGIN
  -- Supabase grants EXECUTE on new public functions to the Data API's roles; these definer functions are the app's only.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
             WHERE s.nspname = 'public' AND p.proname LIKE '%correction%'
               AND (has_function_privilege('anon', p.oid, 'execute') OR has_function_privilege('authenticated', p.oid, 'execute'))) THEN
    RAISE EXCEPTION 'anon or authenticated can run a correction function';
  END IF;
  -- The form asks for an email (required) and a name (optional) (owner, 2026-10-20); the daily job clears both.
  IF NOT has_column_privilege('baguio_app', 'public.corrections', 'reply_email', 'INSERT')
     OR NOT has_column_privilege('baguio_app', 'public.corrections', 'reporter_name', 'INSERT') THEN
    RAISE EXCEPTION 'the app cannot store an email and a name';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-correction-contact'
                 AND command LIKE '%reply_email = null%' AND command LIKE '%reporter_name = null%') THEN
    RAISE EXCEPTION 'no daily job clears emails and names';
  END IF;
  INSERT INTO corrections (page_path, message, reply_email) VALUES ('/eat-stay', 'Cafe by the Ruins now opens at 8 and closes at 9 pm.', 'reader@example.test') RETURNING id, token INTO rid, tok;
  IF claim_correction(rid, 60) IS NOT TRUE THEN RAISE EXCEPTION 'claim failed'; END IF;
  IF claim_correction(rid, 60) IS TRUE THEN RAISE EXCEPTION 'claimed twice'; END IF;
  IF (SELECT message FROM correction_for_check(rid)) IS NULL THEN RAISE EXCEPTION 'report not readable while checking'; END IF;
  out := apply_correction(rid, 'venues', 'cafe-by-the-ruins', 'hours', '{"open":"08:00","close":"21:00"}', 'https://example.org/cafe', 'We are open daily from 8:00 am to 9:00 pm.');
  IF out <> 'applied' THEN RAISE EXCEPTION 'expected applied, got %', out; END IF;
  IF (SELECT hours->>'open' FROM venues WHERE slug = 'cafe-by-the-ruins') <> '08:00' THEN RAISE EXCEPTION 'venue not updated'; END IF;
  IF (SELECT status FROM correction_status(tok)) <> 'applied' THEN RAISE EXCEPTION 'status not applied'; END IF;
  IF (SELECT count(*) FROM correction_for_check(rid)) <> 0 THEN RAISE EXCEPTION 'report readable after the check'; END IF;
  -- the reply: claimed once, with the address and the outcome; never again
  IF (SELECT email FROM claim_correction_reply(rid)) IS DISTINCT FROM 'reader@example.test' THEN RAISE EXCEPTION 'reply not claimable'; END IF;
  IF (SELECT count(*) FROM claim_correction_reply(rid)) <> 0 THEN RAISE EXCEPTION 'reply claimed twice'; END IF;
  SELECT id INTO chg FROM correction_changes WHERE correction_id = rid;
  -- the same field again within 7 days: held
  INSERT INTO corrections (page_path, message) VALUES ('/eat-stay', 'Cafe by the Ruins closes at 10 pm on weekends.') RETURNING id INTO rid2;
  PERFORM claim_correction(rid2, 60);
  out := apply_correction(rid2, 'venues', 'cafe-by-the-ruins', 'hours', '{"open":"08:00","close":"22:00"}', 'https://example.org/cafe', 'Weekend hours are 8:00 am to 10:00 pm.');
  IF out <> 'held: cooldown' THEN RAISE EXCEPTION 'expected cooldown, got %', out; END IF;
  -- a field off the allow-list: held
  INSERT INTO corrections (page_path, message) VALUES ('/destinations/the-mansion', 'The description is wrong about the gate.') RETURNING id INTO rid2;
  PERFORM claim_correction(rid2, 60);
  out := apply_correction(rid2, 'destinations', 'the-mansion', 'description', '"x"', 'https://example.org/m', 'Some quote of twenty characters.');
  IF out <> 'held: field' THEN RAISE EXCEPTION 'expected field, got %', out; END IF;
  -- failures: back to received twice, held on the third
  INSERT INTO corrections (page_path, message) VALUES ('/eat-stay', 'Another report that keeps failing to check.') RETURNING id INTO rid2;
  FOR n IN 1..3 LOOP
    PERFORM claim_correction(rid2, 60);
    PERFORM fail_correction(rid2, 'model timeout', 3);
  END LOOP;
  IF (SELECT status FROM corrections WHERE id = rid2) <> 'held' THEN RAISE EXCEPTION 'not held after 3 failures'; END IF;
  -- undo puts the old value back
  PERFORM undo_correction(chg);
  IF (SELECT hours->>'open' FROM venues WHERE slug = 'cafe-by-the-ruins') = '08:00' THEN RAISE EXCEPTION 'undo did not restore'; END IF;
  -- Report text is deleted 12 months after it was sent (owner, 2026-10-20); the row keeps its page, status and dates.
  INSERT INTO corrections (page_path, message, created_at)
    VALUES ('/eat-stay', 'An old report whose text should be gone.', now() - interval '13 months') RETURNING id INTO rid2;
  EXECUTE (SELECT command FROM cron.job WHERE jobname = 'expire-correction-text');
  IF (SELECT message FROM corrections WHERE id = rid2) <> '(deleted after 12 months)' THEN RAISE EXCEPTION 'old report text kept'; END IF;
  IF (SELECT message FROM corrections WHERE id = rid) = '(deleted after 12 months)' THEN RAISE EXCEPTION 'a recent report lost its text'; END IF;
  RAISE NOTICE 'correction_checks: all passed';
END $$;
ROLLBACK;
