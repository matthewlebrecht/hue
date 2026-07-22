-- ============================================================
-- HUE v3 — all-day / multi-day calendar events
-- Run in the Supabase SQL editor, then redeploy calendar-sync and re-sync.
--
-- Date-valued events (DTSTART;VALUE=DATE) have no time and no timezone. Stored
-- as a plain timestamptz they get converted on read, so a Denver iPad renders
-- "Aug 6 all day" as "Aug 5, 6:00 PM" — off by a day. The flag lets the client
-- know to read those instants in UTC and skip the conversion entirely.
--
-- Note also that iCalendar DTEND is EXCLUSIVE for date values: Aug 6 -> Aug 10
-- means the event runs *through Aug 9*. The client subtracts the day.
-- ============================================================

alter table schedule
  add column if not exists all_day boolean not null default false;

-- Existing rows were written before the flag existed and have the UTC-shifted
-- times baked in; clearing the mirror forces a clean re-sync.
delete from schedule where source = 'ics';

select column_name, data_type, column_default
from information_schema.columns
where table_name = 'schedule' and column_name = 'all_day';
