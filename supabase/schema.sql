-- ============================================================================
--  QUBA ROOM BOARD — Supabase schema
--  Run this once in the Supabase SQL Editor (Project → SQL → New query → Run).
--  Safe to re-run: uses IF NOT EXISTS / idempotent guards where possible.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type role           as enum ('admin','staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type room_override  as enum ('cleaning','maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_source as enum ('direct','airbnb','booking','gathern');
exception when duplicate_object then null; end $$;

-- ============================================================================
--  TABLES
-- ============================================================================

-- profiles — one row per auth user (role lives here)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'User',
  role        role not null default 'staff',
  created_at  timestamptz not null default now()
);

-- rooms — 20 rooms, business key = no (1..20)
create table if not exists public.rooms (
  no              integer primary key,
  floor           integer not null default 1,
  override        room_override,                 -- null = derive status from bookings
  issue           text not null default '',      -- required when override = 'maintenance'
  photo_url       text,                          -- Supabase Storage public URL
  description     text not null default '',      -- original text (admin language)
  description_tr  jsonb not null default '{}'::jsonb,  -- cached translations { "en": "...", "ar": "..." }
  updated_at      timestamptz not null default now()
);

-- bookings — the source of truth for occupancy & revenue
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  room_no         integer not null references public.rooms(no) on delete cascade,
  guest_name      text not null default '',
  cc              text not null default '+966',
  phone           text not null default '',
  check_in        date not null,
  check_out       date not null,
  check_in_time   time not null default '15:00',
  check_out_time  time not null default '12:00',
  source          booking_source not null default 'direct',
  amount          numeric(10,2) not null default 0,
  rate            numeric(10,2) not null default 0,   -- nightly rate snapshot
  reason          text not null default '',
  checked_out     boolean not null default false,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint chk_dates check (check_out > check_in)
);
create index if not exists idx_bookings_room on public.bookings(room_no);
create index if not exists idx_bookings_dates on public.bookings(check_in, check_out);

-- app_settings — singleton row (id = 1)
create table if not exists public.app_settings (
  id          integer primary key default 1,
  daily_rate  numeric(10,2) not null default 350,
  currency    text not null default 'SAR',
  constraint chk_singleton check (id = 1)
);

-- room_status_history — optional audit log ("status from forever")
create table if not exists public.room_status_history (
  id          uuid primary key default gen_random_uuid(),
  room_no     integer not null references public.rooms(no) on delete cascade,
  status      text not null,
  note        text not null default '',
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now()
);
create index if not exists idx_history_room on public.room_status_history(room_no, changed_at desc);

-- ============================================================================
--  ROW LEVEL SECURITY
--  Small trusted team: any authenticated user can read; staff can run the desk;
--  admin-only actions (settings, managing staff) are gated by role.
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.rooms               enable row level security;
alter table public.bookings            enable row level security;
alter table public.app_settings        enable row level security;
alter table public.room_status_history enable row level security;

-- helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- profiles
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_self   on public.profiles;
drop policy if exists profiles_admin  on public.profiles;
create policy profiles_read  on public.profiles for select using (auth.role() = 'authenticated');
create policy profiles_self  on public.profiles for update using (id = auth.uid());
create policy profiles_admin on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- rooms — authenticated read + write (desk sets status/issue; photo/desc gated in app UI)
drop policy if exists rooms_read  on public.rooms;
drop policy if exists rooms_write on public.rooms;
create policy rooms_read  on public.rooms for select using (auth.role() = 'authenticated');
create policy rooms_write on public.rooms for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- bookings — full desk management for any authenticated user
drop policy if exists bookings_read on public.bookings;
drop policy if exists bookings_cud  on public.bookings;
create policy bookings_read on public.bookings for select using (auth.role() = 'authenticated');
create policy bookings_cud  on public.bookings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- app_settings — everyone reads, admin writes
drop policy if exists settings_read  on public.app_settings;
drop policy if exists settings_admin on public.app_settings;
create policy settings_read  on public.app_settings for select using (auth.role() = 'authenticated');
create policy settings_admin on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- history — read + insert for authenticated
drop policy if exists history_read   on public.room_status_history;
drop policy if exists history_insert on public.room_status_history;
create policy history_read   on public.room_status_history for select using (auth.role() = 'authenticated');
create policy history_insert on public.room_status_history for insert with check (auth.role() = 'authenticated');

-- ============================================================================
--  REALTIME  (cross-device live sync)
-- ============================================================================
do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.app_settings;
exception when duplicate_object then null; end $$;

-- ============================================================================
--  STORAGE  (room photos)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', true)
on conflict (id) do nothing;

drop policy if exists "room photos public read" on storage.objects;
drop policy if exists "room photos auth write"  on storage.objects;
create policy "room photos public read" on storage.objects
  for select using (bucket_id = 'room-photos');
create policy "room photos auth write" on storage.objects
  for insert with check (bucket_id = 'room-photos' and auth.role() = 'authenticated');

-- ============================================================================
--  SEED
-- ============================================================================
-- 20 rooms: 1–10 on floor 1, 11–20 on floor 2
insert into public.rooms (no, floor)
select g, case when g <= 10 then 1 else 2 end
from generate_series(1, 20) as g
on conflict (no) do nothing;

-- singleton settings
insert into public.app_settings (id, daily_rate, currency)
values (1, 350, 'SAR')
on conflict (id) do nothing;

-- ── After running this file ────────────────────────────────────────────────
-- 1) Authentication → Users → Add user  (create two):
--      admin@aurion.local  /  (a password)   → this is Malsor (admin)
--      reception@aurion.local / (a password)  → front desk (staff)
-- 2) Copy each user's UUID, then insert profiles:
--      insert into public.profiles (id, name, role) values
--        ('<ADMIN-UUID>',     'Malsor',    'admin'),
--        ('<RECEPTION-UUID>', 'Reception', 'staff');
-- 3) Authentication → URL Configuration: set Site URL + redirect URLs
--    to your local (http://localhost:3000) and Vercel URLs.
-- ============================================================================
