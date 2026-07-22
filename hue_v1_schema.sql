-- ============================================================
-- HUE v1 schema — Supabase / Postgres  (REDESIGN: joint money, account-tracked)
-- Household ambient dashboard for Matthew & Ashlee
-- Paste into Supabase SQL editor (or run as a migration).
--
-- Model:
--   * It's OUR money — no split, no person attribution, no "who owes whom"
--   * accounts are the spine; balances computed forward from a starting balance
--   * credit cards / loans = negative-balance accounts (debt)
--   * transactions move money: spend / income / transfer / balance_adjustment
--   * weekly recon uses balance_adjustment to snap computed balance to bank truth
--   * goals = separate list spanning accounts (savings fill up, debt drains to 0)
--   * salary = static config for budgeting, hand-patched on a raise
-- ============================================================

-- ---------- enums ----------
create type account_type as enum ('checking', 'savings', 'credit_card', 'loan');
create type txn_kind     as enum ('spend', 'income', 'transfer', 'balance_adjustment');
create type txn_source   as enum ('manual', 'plaid');
create type cat_type     as enum ('expense', 'savings_goal');
create type goal_type    as enum ('savings', 'debt_payoff');
create type inv_status   as enum ('ok', 'low', 'out');
create type sched_source as enum ('ics', 'caldav', 'gmail');

-- ---------- accounts (the spine) ----------
create table accounts (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,              -- "Ally checking", "Chase Sapphire"
  type             account_type not null,
  starting_balance numeric not null default 0, -- balance when HUE starts tracking
  -- assets positive; credit_card / loan carry NEGATIVE balances (debt)
  created_at       timestamptz not null default now()
);

-- ---------- categories (fluid; no owner — joint) ----------
create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       cat_type not null default 'expense',
  target     numeric,
  created_at timestamptz not null default now()
);

-- ---------- transactions (account movement; no person, no split) ----------
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  txn_date      date not null default current_date,
  kind          txn_kind not null,
  amount        numeric not null,           -- >=0 for spend/income/transfer; signed for balance_adjustment
  account_id    uuid not null references accounts(id) on delete cascade,
  to_account_id uuid references accounts(id) on delete cascade,  -- transfer dest only
  category_id   uuid references categories(id) on delete set null,
  description   text,
  source        txn_source not null default 'manual',
  plaid_txn_id  text unique,
  -- a transfer needs a destination; non-transfers must not have one
  constraint transfer_has_dest check (
    (kind = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (kind <> 'transfer' and to_account_id is null)
  ),
  -- amount must be non-negative EXCEPT for balance_adjustment (which is signed)
  constraint amount_sign check (
    kind = 'balance_adjustment' or amount >= 0
  )
);

create index on transactions (txn_date);
create index on transactions (account_id);
create index on transactions (category_id);
create index on transactions (kind);

-- ---------- budget (monthly spend targets per category) ----------
create table budget (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references categories(id) on delete cascade,
  monthly_limit numeric not null,
  month         date not null,
  unique (category_id, month)
);

-- ---------- goals (separate list, spans accounts) ----------
create table goals (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,             -- "Emergency fund", "Kill card debt"
  type           goal_type not null,
  target         numeric not null,          -- savings: reach $X ; debt_payoff: 0
  starting_amount numeric,                  -- debt_payoff: the debt level at goal start
                                            -- (negative), so progress % is computable.
                                            -- savings: optional baseline (default 0).
  created_at     timestamptz not null default now()
);

create table goal_accounts (
  goal_id    uuid not null references goals(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  primary key (goal_id, account_id)
);

-- ---------- salary_config (static, hand-patched household income) ----------
create table salary_config (
  id           uuid primary key default gen_random_uuid(),
  person       text not null unique,        -- 'matthew' | 'ashlee' (label only)
  annual_gross numeric not null,
  takehome_pct numeric not null default 1.0,
  updated_at   timestamptz not null default now()
);

-- ---------- inventory (voice-driven, status only) ----------
create table inventory (
  id         uuid primary key default gen_random_uuid(),
  item       text not null,
  status     inv_status not null default 'ok',
  qty_loose  text,                           -- OPTIONAL loose amount, nullable (no servings)
  updated_at timestamptz not null default now(),
  updated_by text                            -- optional label, nullable
);

-- ---------- schedule (read-only mirror; both Apple, .ics primary) ----------
create table schedule (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  starts_at timestamptz not null,
  ends_at   timestamptz,
  who       text,                            -- optional display label
  location  text,
  source    sched_source not null,
  ext_uid   text,
  synced_at timestamptz not null default now()
);

create index on schedule (starts_at);
create unique index on schedule (source, ext_uid) where ext_uid is not null;

-- ---------- packages (Gmail-fed, v3) ----------
create table packages (
  id          uuid primary key default gen_random_uuid(),
  carrier     text,
  tracking_no text,
  status      text,
  eta         date,
  description text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Computed current balance per account.
-- starting_balance + effects:
--   spend               : -amount on account_id
--   income              : +amount on account_id
--   transfer            : -amount on account_id, +amount on to_account_id
--   balance_adjustment  : +/- amount on account_id (signed correction; see note)
-- balance_adjustment is a SIGNED correction on account_id (can be + or -),
-- used in the weekly recon to snap a computed balance to bank truth without
-- logging a fake spend. It carries no category and does not pollute spending.
-- ============================================================
create or replace view account_balances as
with effects as (
  -- outgoing / primary-account effects
  select account_id as acct,
         case kind
           when 'spend'    then -amount
           when 'income'   then  amount
           when 'transfer' then -amount
           when 'balance_adjustment' then amount
         end as delta
  from transactions
  union all
  -- transfer destination effects
  select to_account_id as acct, amount as delta
  from transactions
  where kind = 'transfer'
)
select a.id,
       a.name,
       a.type,
       a.starting_balance
         + coalesce((select sum(delta) from effects where acct = a.id), 0) as current_balance
from accounts a;

-- ============================================================
-- Household net worth = sum of all current balances
-- (liabilities are already negative, so a plain sum is correct).
-- ============================================================
create or replace view net_worth as
select coalesce(sum(current_balance), 0) as net_worth
from account_balances;

-- ============================================================
-- Goal progress: sums linked-account balances vs. target.
--   savings     : progress = summed balance / target  (fills toward 1.0)
--   debt_payoff : summed balance is negative (debt). progress = how close to 0.
-- ============================================================
create or replace view goal_progress as
select g.id,
       g.name,
       g.type,
       g.target,
       g.starting_amount,
       coalesce(sum(ab.current_balance), 0) as linked_balance,
       case
         when g.type = 'savings' and g.target <> coalesce(g.starting_amount, 0)
           then round(
             (coalesce(sum(ab.current_balance), 0) - coalesce(g.starting_amount, 0))
             / (g.target - coalesce(g.starting_amount, 0)), 4)
         when g.type = 'debt_payoff' and g.starting_amount is not null
              and g.starting_amount <> 0
           -- starting_amount is the (negative) debt at start; target is 0.
           -- progress = how far balance has climbed from starting debt toward 0.
           then round(
             (coalesce(sum(ab.current_balance), 0) - g.starting_amount)
             / (0 - g.starting_amount), 4)
         else null
       end as progress
from goals g
left join goal_accounts ga on ga.goal_id = g.id
left join account_balances ab on ab.id = ga.account_id
group by g.id, g.name, g.type, g.target, g.starting_amount;

-- ============================================================
-- Household monthly net income (budgeting reference; static).
-- ============================================================
create or replace view monthly_income as
select round(coalesce(sum(annual_gross * takehome_pct) / 12.0, 0), 2) as monthly_net
from salary_config;

-- ============================================================
-- Seed: starter spend categories. Accounts/goals/salary entered at setup.
-- ============================================================
insert into categories (name, type) values
  ('Food',          'expense'),
  ('Rent',          'expense'),
  ('Utilities',     'expense'),
  ('Transport',     'expense'),
  ('Fun',           'expense'),
  ('Health',        'expense'),
  ('Subscriptions', 'expense'),
  ('Shopping',      'expense'),
  ('Misc',          'expense');
