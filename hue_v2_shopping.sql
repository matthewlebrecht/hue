-- ============================================================
-- HUE v2 — shopping list
-- Run in the Supabase SQL editor after the v1 files. Idempotent.
--
-- Why a table rather than deriving the list from inventory on the fly:
--   1. Check-off state has to be SHARED and live — Ashlee ticks milk, Matthew's
--      phone strikes it through. That state has to live somewhere both read.
--   2. A real grocery list holds things that aren't tracked staples ("birthday
--      candles"). Those rows have a null inventory_id.
--
-- Rows linked to inventory are kept in sync by the app: a low/out item gets a
-- row, and an item that goes back to ok loses its row unless it's been ticked.
-- ============================================================

create table if not exists shopping_list (
  id           uuid primary key default gen_random_uuid(),
  item         text not null,
  inventory_id uuid references inventory(id) on delete cascade,  -- null = ad-hoc
  checked      boolean not null default false,
  checked_by   text,
  checked_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- One list row per tracked item — this is what makes the auto-sync safe to run
-- from two devices at once: the second insert conflicts instead of duplicating.
create unique index if not exists shopping_list_inventory_uniq
  on shopping_list (inventory_id)
  where inventory_id is not null;

alter table shopping_list enable row level security;

drop policy if exists household_all on shopping_list;
create policy household_all on shopping_list
  for all to authenticated using (true) with check (true);

-- realtime: both phones at the store
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shopping_list'
  ) then
    alter publication supabase_realtime add table public.shopping_list;
  end if;
end $$;

-- Verify
select c.relname, c.relrowsecurity as rls, count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relname = 'shopping_list'
group by c.relname, c.relrowsecurity;
