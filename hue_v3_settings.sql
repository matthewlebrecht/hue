-- ============================================================
-- HUE v3 — household settings
-- Run in the Supabase SQL editor.
--
-- A tiny key/value store for preferences that must agree across devices. The
-- iPad, both phones, and any future surface read the same row — putting these
-- in localStorage would mean the kitchen display and Matthew's phone disagreeing
-- about what time he has to leave.
-- ============================================================

create table if not exists hue_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table hue_settings enable row level security;

drop policy if exists household_all on hue_settings;
create policy household_all on hue_settings
  for all to authenticated using (true) with check (true);

-- realtime: change the arrival time on a phone, the iPad's nudge follows
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hue_settings'
  ) then
    alter publication supabase_realtime add table public.hue_settings;
  end if;
end $$;

-- Seed the commute riders. Adjust in the app, not here.
insert into hue_settings (key, value)
values (
  'commute',
  '{"riders":[
      {"id":"matthew","name":"Matthew","destination":"gallivan","arrive_by":"08:00","enabled":true},
      {"id":"ashlee","name":"Ashlee","destination":"city_center","arrive_by":"08:00","enabled":false}
   ]}'::jsonb
)
on conflict (key) do nothing;

select key, value from hue_settings where key = 'commute';
