-- ============================================================
-- HUE v3 — Coming Up: bills and flights
-- Run in the Supabase SQL editor.
--
-- Coming Up stops mirroring the calendar. It answers a different question —
-- "what's arriving, departing, or coming due" — which the Today zone doesn't
-- and shouldn't. Packages already had a table; these are the other two.
--
-- Both are shaped for Gmail to fill later: ext_uid holds the source message id
-- so re-parsing an inbox updates rows instead of duplicating them.
-- ============================================================

-- ---------- bills ----------
create table if not exists bills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  amount      numeric,
  due_date    date not null,
  autopay     boolean not null default false,
  recurrence  text not null default 'monthly',   -- 'monthly' | 'yearly' | 'once'
  paid_on     date,
  account_id  uuid references accounts(id) on delete set null,
  ext_uid     text unique,                        -- gmail message id, later
  created_at  timestamptz not null default now()
);

create index if not exists bills_due on bills (due_date);

-- ---------- flights ----------
create table if not exists flights (
  id           uuid primary key default gen_random_uuid(),
  airline      text,
  flight_no    text,
  origin       text,
  destination  text,
  depart_at    timestamptz not null,
  arrive_at    timestamptz,
  confirmation text,
  who          text,
  ext_uid      text unique,                       -- gmail message id, later
  created_at   timestamptz not null default now()
);

create index if not exists flights_depart on flights (depart_at);

-- ---------- RLS ----------
alter table bills   enable row level security;
alter table flights enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bills', 'flights']
  loop
    execute format('drop policy if exists household_all on %I', t);
    execute format(
      'create policy household_all on %I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- ---------- realtime ----------
do $$
declare t text;
begin
  foreach t in array array['bills', 'flights']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select 'bills + flights ready' as status;
