-- Keeps the promise on the corrections form and in the privacy policy: a
-- reply email is kept only until the report is resolved, and never longer
-- than 90 days. Reply to the visitor first, then set resolved_at.
--
-- Runs daily at 03:15 UTC (11:15 Philippine time) as the role that applies
-- this migration, which owns the table, so RLS doesn't stop it.
-- ponytail: a paused free-tier project runs no jobs; the condition is by age,
-- not by event, so the first run after a restore catches up.
create extension if not exists pg_cron with schema pg_catalog;

-- Scheduling under a name replaces any earlier job with that name.
select cron.schedule(
  'expire-correction-reply-emails',
  '15 3 * * *',
  $$update public.corrections
       set reply_email = null
     where reply_email is not null
       and (resolved_at is not null or created_at < now() - interval '90 days')$$
);
