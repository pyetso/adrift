-- Adrift / run this entire file in the Supabase SQL Editor.
-- Supabase dashboard > Authentication > Providers > Anonymous Sign-Ins: ENABLE.
-- Enable RLS so browsers and API route requests cannot edit someone else's letters.
create extension if not exists pgcrypto;

create table if not exists public.bottles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 2 and 400),
  author_name text not null default 'A stranger' check (char_length(author_name) between 1 and 32),
  mood text not null default 'hope' check (mood in ('hope','memory','secret','wish')),
  start_x double precision not null check (start_x between -30 and 30),
  start_z double precision not null check (start_z between -100 and 20),
  drift_seed double precision not null,
  status text not null default 'floating' check (status in ('floating','hidden')),
  created_at timestamptz not null default now()
);

create index if not exists bottles_recent_idx on public.bottles(status,created_at desc);
create index if not exists bottles_owner_idx on public.bottles(owner_id,created_at desc);

alter table public.bottles enable row level security;

-- Public can read only floating letters; the author can still view their own hidden letters.
create policy "Public floating letters" on public.bottles
  for select to anon, authenticated using (status='floating' or owner_id=(select auth.uid()));
create policy "Authors create their letters" on public.bottles
  for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "Authors edit their letters" on public.bottles
  for update to authenticated using (owner_id=(select auth.uid()))
  with check (owner_id=(select auth.uid()));
create policy "Authors delete their letters" on public.bottles
  for delete to authenticated using (owner_id=(select auth.uid()));

-- Limit direct table privileges: public readers cannot write through anon key.
grant select on public.bottles to anon;
grant select, insert, update, delete on public.bottles to authenticated;

create table if not exists public.bottle_reports (
  id uuid primary key default gen_random_uuid(),
  bottle_id uuid not null references public.bottles(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (bottle_id, reporter_id)
);
alter table public.bottle_reports enable row level security;
create policy "Reporter submits own report" on public.bottle_reports
  for insert to authenticated with check (reporter_id=(select auth.uid()));
grant insert on public.bottle_reports to authenticated;
-- Reports are not readable by public. Review them in the Supabase dashboard.
