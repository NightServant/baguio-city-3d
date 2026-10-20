-- The corrections form asks for an email again, required, and keeps the optional name (owner, 2026-10-20: "for the
-- workflow to send response email to that user"). The check's result is emailed once (claim_correction_reply marks it
-- sent). The daily job clears the email and the name once the report is resolved and answered, or at 90 days. Neither
-- reaches the checker's model: correction_for_check returns the page and the message only.
ALTER TABLE public.corrections
  ADD COLUMN reply_email text CHECK (reply_email IS NULL OR char_length(reply_email) <= 254),
  ADD COLUMN replied_at timestamptz;
GRANT INSERT (reply_email) ON public.corrections TO baguio_app;

CREATE FUNCTION public.claim_correction_reply(p_id bigint)
RETURNS TABLE (email text, status text, status_note text, token uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE corrections c SET replied_at = now()
  WHERE c.id = p_id AND c.status IN ('applied', 'held') AND c.replied_at IS NULL AND c.reply_email IS NOT NULL
  RETURNING c.reply_email, c.status, c.status_note, c.token
$$;
REVOKE ALL ON FUNCTION public.claim_correction_reply(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_correction_reply(bigint) TO baguio_app;

SELECT cron.unschedule('expire-correction-names');
SELECT cron.schedule(
  'expire-correction-contact',
  '15 3 * * *',
  $$update public.corrections
       set reply_email = null, reporter_name = null
     where (reply_email is not null or reporter_name is not null)
       and ((resolved_at is not null and (replied_at is not null or reply_email is null))
            or created_at < now() - interval '90 days')$$
);
