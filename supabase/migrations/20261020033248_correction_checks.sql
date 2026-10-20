-- Automated corrections (owner decisions 2026-09-25; Vercel Functions as the checker, owner 2026-10-19): a status and
-- a private status link per report, attempts and the last error (the retry record), an audit log with undo, and one
-- gate that applies an allow-listed, sourced change. The app still can't list reports: it gets id and token on insert,
-- one report's text only while it holds that report's check, and status through the token.
ALTER TABLE public.corrections
  ADD COLUMN status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'checking', 'applied', 'held')),
  ADD COLUMN token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN status_note text CHECK (status_note IS NULL OR char_length(status_note) <= 300),
  ADD COLUMN checked_at timestamptz,
  ADD COLUMN attempts int NOT NULL DEFAULT 0,
  ADD COLUMN last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 300);
CREATE UNIQUE INDEX corrections_token_idx ON public.corrections (token);
CREATE INDEX corrections_status_idx ON public.corrections (status, created_at);
GRANT SELECT (id, token) ON public.corrections TO baguio_app;   -- INSERT ... RETURNING id, token

CREATE TABLE public.correction_changes (
  id bigserial PRIMARY KEY,
  correction_id bigint NOT NULL REFERENCES public.corrections (id),
  target_table text NOT NULL CHECK (target_table IN ('venues', 'destinations')),
  slug text NOT NULL,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb NOT NULL,
  source_url text NOT NULL,
  quote text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);
ALTER TABLE public.correction_changes ENABLE ROW LEVEL SECURITY;   -- no app access; the owner reads it in the dashboard

CREATE FUNCTION public.claim_correction(p_id bigint, p_daily_cap int) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE corrections SET status = 'checking', checked_at = now()
  WHERE id = p_id AND status = 'received'
    AND (SELECT count(*) FROM corrections WHERE checked_at > now() - interval '1 day') < p_daily_cap
  RETURNING true
$$;

CREATE FUNCTION public.correction_for_check(p_id bigint) RETURNS TABLE (page_path text, message text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.page_path, c.message FROM corrections c WHERE c.id = p_id AND c.status = 'checking'
$$;

CREATE FUNCTION public.correction_status(p_token uuid)
RETURNS TABLE (status text, status_note text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.status, c.status_note, c.created_at FROM corrections c WHERE c.token = p_token
$$;

CREATE FUNCTION public.hold_correction(p_id bigint, p_note text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE corrections SET status = 'held', status_note = left(p_note, 300) WHERE id = p_id AND status = 'checking'
$$;

CREATE FUNCTION public.fail_correction(p_id bigint, p_error text, p_max_attempts int) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE corrections SET attempts = attempts + 1, last_error = left(p_error, 300),
    status = CASE WHEN attempts + 1 >= p_max_attempts THEN 'held' ELSE 'received' END,
    status_note = CASE WHEN attempts + 1 >= p_max_attempts THEN 'The automatic check kept failing' ELSE status_note END
  WHERE id = p_id AND status = 'checking'
$$;

CREATE FUNCTION public.release_stuck_corrections(p_minutes int, p_max_attempts int) RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    UPDATE corrections SET attempts = attempts + 1, last_error = 'stuck in checking',
      status = CASE WHEN attempts + 1 >= p_max_attempts THEN 'held' ELSE 'received' END
    WHERE status = 'checking' AND checked_at < now() - make_interval(mins => p_minutes)
    RETURNING 1)
  SELECT count(*)::int FROM s
$$;

CREATE FUNCTION public.received_corrections(p_limit int) RETURNS SETOF bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM corrections WHERE status = 'received' ORDER BY created_at LIMIT p_limit
$$;

CREATE FUNCTION public.apply_correction(p_id bigint, p_table text, p_slug text, p_field text, p_value jsonb,
                                        p_source_url text, p_quote text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM corrections WHERE id = p_id AND status = 'checking') THEN RETURN 'held: not checking'; END IF;
  IF (p_table, p_field) NOT IN (('venues', 'hours'), ('venues', 'price_range'), ('destinations', 'hours')) THEN
    PERFORM hold_correction(p_id, 'Not a field the checker may change'); RETURN 'held: field';
  END IF;
  IF p_field = 'hours' AND NOT (p_value->>'open' ~ '^\d\d:\d\d$' AND p_value->>'close' ~ '^\d\d:\d\d$') THEN
    PERFORM hold_correction(p_id, 'Hours not in HH:MM'); RETURN 'held: value';
  END IF;
  IF p_field = 'price_range' AND NOT (jsonb_typeof(p_value) = 'number' AND p_value::int BETWEEN 1 AND 4) THEN
    PERFORM hold_correction(p_id, 'Price range not 1 to 4'); RETURN 'held: value';
  END IF;
  IF EXISTS (SELECT 1 FROM correction_changes WHERE target_table = p_table AND slug = p_slug AND field = p_field
             AND undone_at IS NULL AND applied_at > now() - interval '7 days') THEN
    PERFORM hold_correction(p_id, 'Changed in the last 7 days'); RETURN 'held: cooldown';
  END IF;
  IF p_table = 'venues' THEN
    IF NOT EXISTS (SELECT 1 FROM venues WHERE slug = p_slug) THEN PERFORM hold_correction(p_id, 'No such place'); RETURN 'held: place'; END IF;
    IF p_field = 'hours' THEN
      SELECT to_jsonb(hours) INTO old FROM venues WHERE slug = p_slug;
      UPDATE venues SET hours = p_value, updated_at = now() WHERE slug = p_slug;
    ELSE
      SELECT to_jsonb(price_range) INTO old FROM venues WHERE slug = p_slug;
      UPDATE venues SET price_range = p_value::int, updated_at = now() WHERE slug = p_slug;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM destinations WHERE slug = p_slug) THEN PERFORM hold_correction(p_id, 'No such place'); RETURN 'held: place'; END IF;
    SELECT to_jsonb(hours) INTO old FROM destinations WHERE slug = p_slug;
    UPDATE destinations SET hours = p_value, updated_at = now() WHERE slug = p_slug;
  END IF;
  INSERT INTO correction_changes (correction_id, target_table, slug, field, old_value, new_value, source_url, quote)
  VALUES (p_id, p_table, p_slug, p_field, old, p_value, left(p_source_url, 2000), left(p_quote, 1000));
  UPDATE corrections SET status = 'applied', status_note = left('Source: ' || p_source_url, 300), resolved_at = now() WHERE id = p_id;
  RETURN 'applied';
END $$;

CREATE FUNCTION public.undo_correction(p_change_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c correction_changes;
BEGIN
  SELECT * INTO c FROM correction_changes WHERE id = p_change_id AND undone_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'change % not found or already undone', p_change_id; END IF;
  IF c.target_table = 'venues' AND c.field = 'hours' THEN UPDATE venues SET hours = c.old_value, updated_at = now() WHERE slug = c.slug;
  ELSIF c.target_table = 'venues' THEN UPDATE venues SET price_range = c.old_value::int, updated_at = now() WHERE slug = c.slug;
  ELSE UPDATE destinations SET hours = c.old_value, updated_at = now() WHERE slug = c.slug;
  END IF;
  UPDATE correction_changes SET undone_at = now() WHERE id = p_change_id;
END $$;

REVOKE ALL ON FUNCTION public.claim_correction(bigint, int), public.correction_for_check(bigint), public.correction_status(uuid),
  public.hold_correction(bigint, text), public.fail_correction(bigint, text, int), public.release_stuck_corrections(int, int),
  public.received_corrections(int), public.apply_correction(bigint, text, text, text, jsonb, text, text),
  public.undo_correction(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_correction(bigint, int), public.correction_for_check(bigint), public.correction_status(uuid),
  public.hold_correction(bigint, text), public.fail_correction(bigint, text, int), public.release_stuck_corrections(int, int),
  public.received_corrections(int), public.apply_correction(bigint, text, text, text, jsonb, text, text) TO baguio_app;
-- undo_correction: the owner only, from the dashboard's SQL editor
