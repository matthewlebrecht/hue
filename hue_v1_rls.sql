-- ============================================================
-- HUE v1 — Row Level Security policies
-- Run in the Supabase SQL editor AFTER hue_v1_schema.sql.
-- Idempotent: safe to re-run.
--
-- Model: two-person household, one shared pool of data. Anyone who is
-- SIGNED IN (Matthew or Ashlee) can read and write everything. Anonymous
-- callers get nothing — the anon key alone is not a credential.
-- If HUE ever gains a third user, this is the file to narrow.
-- ============================================================

-- ---------- 1. RLS on every table (no-op where already enabled) ----------
alter table accounts      enable row level security;
alter table categories    enable row level security;
alter table transactions  enable row level security;
alter table budget        enable row level security;
alter table goals         enable row level security;
alter table goal_accounts enable row level security;
alter table salary_config enable row level security;
alter table inventory     enable row level security;
alter table schedule      enable row level security;
alter table packages      enable row level security;

-- ---------- 2. Household policy: signed-in = full access ----------
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'transactions', 'budget', 'goals',
    'goal_accounts', 'salary_config', 'inventory', 'schedule', 'packages'
  ]
  loop
    execute format('drop policy if exists household_all on %I', t);
    execute format(
      'create policy household_all on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ---------- 3. Views must respect RLS too ----------
-- Postgres views run as their OWNER by default, so a view over an RLS-protected
-- table happily hands data to anon. security_invoker makes the view run as the
-- CALLER, so the policies above actually apply. (Postgres 15+.)
alter view account_balances set (security_invoker = on);
alter view net_worth        set (security_invoker = on);
alter view goal_progress    set (security_invoker = on);
alter view monthly_income   set (security_invoker = on);

-- ---------- 4. Belt and braces: strip anon's grants ----------
-- RLS already blocks anon, but revoking means a future table created without
-- RLS doesn't silently become public.
revoke all on account_balances, net_worth, goal_progress, monthly_income from anon;
grant select on account_balances, net_worth, goal_progress, monthly_income to authenticated;

-- ---------- 5. Verify ----------
-- Expect: every table rowsecurity = true, each with one policy.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;
