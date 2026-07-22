-- ============================================================
-- HUE v1 — enable realtime on the tables both phones write to.
-- Run in the Supabase SQL editor. Idempotent.
--
-- Supabase streams changes from the `supabase_realtime` publication. Tables
-- created via the SQL editor are NOT added to it automatically, so without
-- this the iPad would never see a phone's write until a manual refresh.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'transactions', 'categories', 'budget',
    'goals', 'goal_accounts', 'inventory', 'schedule', 'packages'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Verify: expect one row per table above.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
