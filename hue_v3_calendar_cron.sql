-- ============================================================
-- HUE v3 — automatic calendar sync
-- Run in the Supabase SQL editor AFTER deploying the calendar-sync function.
--
-- Published .ics feeds only refresh on Apple's own schedule (often hours), so
-- polling faster than ~30 min buys nothing. The ambient screen is a glance
-- surface, not a scheduling tool — some lag is acceptable and was the explicit
-- tradeoff for not storing anyone's Apple credentials.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- 1. Store the service role key ONCE, in the vault ----------
-- Dashboard -> Settings -> API -> service_role key. This key bypasses RLS, so it
-- lives encrypted in the vault, never inline in a cron command (cron.job is
-- readable by anyone who can query it).
--
-- Paste the key, run this line, then DELETE the key from your editor buffer.
--
--   select vault.create_secret('PASTE_SERVICE_ROLE_KEY_HERE', 'hue_service_role_key');
--
-- Already stored it once? Rotate instead of creating a duplicate:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'hue_service_role_key'),
--     'NEW_KEY'
--   );

-- ---------- 2. Schedule the sync ----------
select cron.unschedule('hue-calendar-sync')
where exists (select 1 from cron.job where jobname = 'hue-calendar-sync');

select cron.schedule(
  'hue-calendar-sync',
  '*/30 * * * *',                      -- every 30 minutes
  $$
  select net.http_post(
    url     := 'https://mhwclalhjgrwjmsilguz.supabase.co/functions/v1/calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'hue_service_role_key'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ---------- 3. Verify ----------
select jobid, jobname, schedule, active from cron.job where jobname = 'hue-calendar-sync';

-- Recent runs (after the first firing):
--   select status, return_message, start_time
--   from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'hue-calendar-sync')
--   order by start_time desc limit 5;

-- To stop it:  select cron.unschedule('hue-calendar-sync');
