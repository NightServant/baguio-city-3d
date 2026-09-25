-- Correction reports from the public form. The app can add a report and count
-- the last hour's (for the rate cap) but can never read one back: reports are
-- reviewed in the Supabase dashboard. No IP addresses are stored.
create table public.corrections (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  page_path text not null check (char_length(page_path) between 1 and 200),
  message text not null check (char_length(message) between 10 and 2000),
  reply_email text check (reply_email is null or char_length(reply_email) <= 254),
  resolved_at timestamptz
);
create index corrections_created_at_idx on public.corrections (created_at);

alter table public.corrections enable row level security;
grant insert (page_path, message, reply_email) on public.corrections to baguio_app;
grant select (created_at) on public.corrections to baguio_app;
grant usage on sequence public.corrections_id_seq to baguio_app;
create policy app_insert on public.corrections for insert to baguio_app with check (true);
create policy app_count_recent on public.corrections for select to baguio_app
  using (created_at > now() - interval '1 hour');
