-- An optional source link on the corrections form (owner, 2026-10-20, with the free OpenRouter checker): the page a
-- reader says shows the change. The checker reads only this page (it has no web search), so correction_for_check hands
-- it over with the page and the message, while the check holds the report.
ALTER TABLE public.corrections
  ADD COLUMN source_link text CHECK (source_link IS NULL OR (char_length(source_link) <= 2000 AND source_link LIKE 'https://%'));
GRANT INSERT (source_link) ON public.corrections TO baguio_app;

DROP FUNCTION public.correction_for_check(bigint);
CREATE FUNCTION public.correction_for_check(p_id bigint) RETURNS TABLE (page_path text, message text, source_link text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.page_path, c.message, c.source_link FROM corrections c WHERE c.id = p_id AND c.status = 'checking'
$$;
REVOKE ALL ON FUNCTION public.correction_for_check(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correction_for_check(bigint) TO baguio_app;
