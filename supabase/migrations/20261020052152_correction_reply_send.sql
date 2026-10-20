-- Sending the reply from the owner's Gmail (owner, 2026-10-20): the claim also returns the report's page for the email,
-- a failed send gives the claim back, and the sweep lists the replies still waiting (a report held after its third
-- failed check, or one whose send failed).
DROP FUNCTION public.claim_correction_reply(bigint);
CREATE FUNCTION public.claim_correction_reply(p_id bigint)
RETURNS TABLE (email text, status text, status_note text, token uuid, page_path text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE corrections c SET replied_at = now()
  WHERE c.id = p_id AND c.status IN ('applied', 'held') AND c.replied_at IS NULL AND c.reply_email IS NOT NULL
  RETURNING c.reply_email, c.status, c.status_note, c.token, c.page_path
$$;

CREATE FUNCTION public.release_correction_reply(p_id bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE corrections SET replied_at = NULL WHERE id = p_id
$$;

CREATE FUNCTION public.pending_correction_replies(p_limit int) RETURNS SETOF bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM corrections
  WHERE status IN ('applied', 'held') AND replied_at IS NULL AND reply_email IS NOT NULL
  ORDER BY created_at LIMIT p_limit
$$;

REVOKE ALL ON FUNCTION public.claim_correction_reply(bigint), public.release_correction_reply(bigint),
  public.pending_correction_replies(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_correction_reply(bigint), public.release_correction_reply(bigint),
  public.pending_correction_replies(int) TO baguio_app;
