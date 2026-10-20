-- The corrections form asks for an optional name instead of an email (owner, 2026-10-20). No reply was ever emailed,
-- so the email was personal data collected for no use (Data Privacy Act: proportionality). The table held no reports
-- when this ran. The name is seen only by the person who reads the report, never by the checker's model
-- (correction_for_check returns the page and the message only), and the daily job clears it as it cleared the email:
-- once the report is resolved, or at 90 days.
SELECT cron.unschedule('expire-correction-reply-emails');
ALTER TABLE public.corrections DROP COLUMN reply_email;
ALTER TABLE public.corrections
  ADD COLUMN reporter_name text CHECK (reporter_name IS NULL OR char_length(reporter_name) <= 80);
GRANT INSERT (reporter_name) ON public.corrections TO baguio_app;
SELECT cron.schedule(
  'expire-correction-names',
  '15 3 * * *',
  $$update public.corrections
       set reporter_name = null
     where reporter_name is not null
       and (resolved_at is not null or created_at < now() - interval '90 days')$$
);
