-- Report text is deleted 12 months after it was sent (owner, 2026-10-20; privacy self-review finding 4: the Data
-- Privacy Act's proportionality principle wants a retention period). The row stays, without the text: its page,
-- status and dates, and any change it made (correction_changes keeps the source and quote, which are public). The
-- placeholder satisfies corrections_message_check (10 to 2,000 characters).
SELECT cron.schedule(
  'expire-correction-text',
  '20 3 * * *',
  $$update public.corrections
       set message = '(deleted after 12 months)'
     where message <> '(deleted after 12 months)'
       and created_at < now() - interval '12 months'$$
);
