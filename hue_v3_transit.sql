-- ============================================================
-- HUE v3 — commute (UTA GTFS static timetable)
-- Run in the Supabase SQL editor, then deploy + run transit-refresh.
--
-- Only the three legs of Matthew's commute are stored, not all of UTA:
--   300 East (S-Line)  ->  Central Pointe  ->  Gallivan Plaza / City Center
-- That's ~1000 rows instead of 600k, so "when's the next connection" is a
-- cheap indexed read instead of parsing a 4MB zip on every glance.
--
-- FrontRunner 2X construction runs 2026-2029 and will change schedules, so this
-- is refreshed from the feed rather than hardcoded — re-run transit-refresh
-- periodically (weekly is plenty).
-- ============================================================

-- ---------- which service patterns run on which days ----------
create table if not exists transit_service (
  service_id text primary key,
  monday     boolean not null default false,
  tuesday    boolean not null default false,
  wednesday  boolean not null default false,
  thursday   boolean not null default false,
  friday     boolean not null default false,
  saturday   boolean not null default false,
  sunday     boolean not null default false,
  start_date date not null,
  end_date   date not null
);

-- holidays and one-off additions/removals (GTFS calendar_dates)
create table if not exists transit_service_exception (
  service_id     text not null,
  exception_date date not null,
  added          boolean not null,   -- true = service added, false = removed
  primary key (service_id, exception_date)
);

-- ---------- one row per trip, per leg ----------
-- depart_s / arrive_s are seconds after midnight. GTFS legitimately exceeds
-- 86400 for after-midnight service (25:10:00 is a real time), so these are NOT
-- clock times and must not be stored as `time`.
create table if not exists transit_trip (
  leg         text not null,          -- 'sline' | 'trax'
  trip_id     text not null,
  service_id  text not null,
  route_short text,                   -- '720', '701', '704'
  headsign    text,
  depart_s    integer not null,       -- at 300 East (sline) / Central Pointe (trax)
  arrive_s    integer,                -- Central Pointe (sline) / Gallivan Plaza (trax)
  arrive_alt_s integer,               -- City Center — Ashlee's stop (trax only)
  primary key (leg, trip_id)
);

create index if not exists transit_trip_leg_depart on transit_trip (leg, depart_s);

create table if not exists transit_meta (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- ---------- RLS: household reads, service role writes ----------
alter table transit_service           enable row level security;
alter table transit_service_exception enable row level security;
alter table transit_trip              enable row level security;
alter table transit_meta              enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'transit_service', 'transit_service_exception', 'transit_trip', 'transit_meta'
  ]
  loop
    execute format('drop policy if exists household_read on %I', t);
    execute format('create policy household_read on %I for select to authenticated using (true)', t);
  end loop;
end $$;

select 'transit tables ready' as status;
