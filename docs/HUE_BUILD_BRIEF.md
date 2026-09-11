# HUE — Build Brief for Claude Code

**Read this first, then HUE_Project_Knowledge.md for deeper context and rationale.**

You are building **HUE**, a household ambient dashboard for Matthew & Ashlee, displayed on a kitchen iPad (always-on, glance-first) and openable from their phones. Design north star: *whisper, don't shout* — calm resting state, tap to drill into detail.

Address the user as **Boss** in conversation. His name in any data/UI is **Matthew**.

---

## Stack (locked)

- **Frontend:** React + Vite (single web app; the iPad points a browser at it). Touch-designed.
- **Backend:** Supabase (hosted Postgres + auth + realtime). Free tier is fine at two-person scale.
- **Client lib:** `@supabase/supabase-js`.
- **AI (later phases):** Claude API for voice intent parsing, meal suggestions, morning briefing. Not needed for v1.
- **Realtime:** both phones write, iPad reads live via Supabase realtime subscriptions.

Environment note: user is on Windows, Node 24 LTS installed, npm working.

---

## Core data model (the important part)

**It's JOINT money.** No person attribution, no splitting, no "who owes whom." One household pool that happens to live in separate accounts. The spine is **accounts**; every transaction moves money between/out of them; balances compute forward from a starting balance.

- **accounts**: checking / savings / credit_card / loan. Assets positive; cards & loans carry NEGATIVE balances (debt). Net worth = sum of all balances.
- **transactions**: kind = spend | income | transfer | balance_adjustment. `spend` draws down an account; `income` adds; `transfer` moves between two accounts (this is how autopay & paychecks work — a credit card payment is just a transfer, NOT a double-count to exclude); `balance_adjustment` is a signed weekly-recon correction to snap a computed balance to bank truth.
- **categories**: spend buckets (fluid, add anytime).
- **budget**: monthly spend limit per category.
- **goals** + **goal_accounts**: separate goals list that spans accounts. type = savings (fill toward target) or debt_payoff (drain toward 0). `starting_amount` on debt goals gives an accurate % (how far from original debt toward zero).
- **salary_config**: static, hand-patched household income (annual_gross + takehome_pct). Budgeting reference only. No sliders.
- **inventory**: item + status (ok/low/out) + optional loose qty (nullable — never required). Voice AND manual editing.
- **schedule**: read-only calendar mirror (both use Apple Calendar → `.ics` subscription feed to start).
- **packages**: Gmail-fed delivery tracking (later phase).

**The full SQL schema is in `hue_v1_schema.sql` — paste it into the Supabase SQL editor to create everything, including the computed views (`account_balances`, `net_worth`, `goal_progress`, `monthly_income`).**

---

## Screens (mockups exist as reference HTML — match their look & flow)

Design language: dark, calm, cool palette. Cyan (#4dd0e1) as the accent, amber (#e0a458) for time-sensitive/commute, rose (#e07a7a) for debt/over-budget, green (#5fc9a0) for ok/positive. Surfaces #111823 on bg #0a0e14, hairline borders #1f2b3a. Rounded cards, generous spacing, small arc-reactor ring on net worth. Reference files: `hue_screen_flow.html`, `hue_kitchen_screen.html`, `hue_commute_nudge.html`, `hue_inventory_editor.html`.

Three-level hierarchy:
1. **Ambient (resting):** big clock, date, weather, ONE small green money dot (no numbers), one "next thing" line, weekday-morning commute pill. Calm, glanceable from across the kitchen.
2. **Dashboard (tap to wake):** zones — Today (calendar), Kitchen (low/out + meal headline), Money (calm dot + "on track" + one goal line), Packages, Morning Briefing.
3. **Detail screens (tap a zone):**
   - **Money:** net worth + arc ring, account tiles (cards/loans in red/negative), spending vs budget bars, goal bars (savings fill, debt drain).
   - **Kitchen:** meal ideas (have/grab framing), inventory grid with status + loose qty, auto shopping list.
   - **Commute:** big "leave by" time, on-time/delayed status, door-to-door legs.

---

## Build order (v1 → later)

**v1 — the money engine + shell (build this first):**
1. Vite + React app scaffold, Supabase client wired to env vars (URL + anon key in `.env`, never committed).
2. Run the schema in Supabase; confirm tables + views exist.
3. Accounts: add/edit accounts with starting balances; show computed current balances.
4. Transactions: add spend/income/transfer/adjustment; balances update live.
5. Money detail screen: net worth, account tiles, spending vs budget, goal bars.
6. The three-level shell (ambient → dashboard → detail) with navigation, even if some zones are placeholders.

**v2 — kitchen + lists:**
7. Inventory: manual editor (direct ok/low/out buttons, add-item, "restock all" shortcut) + status grid.
8. Auto shopping list from low/out items; live shared check-off (Supabase realtime); "email us the list" button.
9. Meal ideas (Claude API reads inventory → 2-3 dinner suggestions).

**v3 — pipes:**
10. Schedule: `.ics` calendar feed → schedule table → Today zone.
11. Commute: UTA GTFS (static + realtime) → "leave by" nudge. NOTE: Matthew's commute is **S-Line streetcar → TRAX connection** from 2255 S 300 E; the nudge must protect the *transfer*, not just each train. Delay-aware (GTFS-Realtime, protobuf) chosen.
12. Voice: Web Speech API → Claude API intent parse (commands / data questions / tool questions). Morning briefing.
13. Plaid auto-import (own deep-dive first). Gmail packages.

**Back burner:** Philips Hue lights (local API).

---

## Working style

- Talk through the plan before big moves; build incrementally; keep commits/steps reviewable.
- Two options when there's a real choice — a lean version and an ideal/fully-loaded version. Matthew prefers ideal for his own setup, but v1 should still be shippable before piling on.
- Don't hardcode secrets. Supabase keys in `.env`.
- Start with v1 step 1 and go in order unless Boss redirects.

**First action:** scaffold the Vite + React project, set up the Supabase client, and confirm the dev server runs. Then we'll run the schema and build the money engine.
