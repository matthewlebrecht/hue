# HUE — Project Knowledge Doc

*Household ambient dashboard + home system for Boss & Ashlee. A subset/sibling of IKE, scoped to shared home life. Runs on a kitchen iPad as an always-on ambient display, wakes to a full dashboard on tap.*

*Last updated: July 14, 2026 (rev. income + pipe decisions). This is the single source of truth — update it as decisions change.*

---

## 1. What HUE is

An ambient household dashboard displayed on a kitchen iPad (Google-Home style), backed by a lightweight cloud service. It does deep, HUE-native work on the things that are actually the household's — budget, inventory, schedule, packages — instead of shallow general-purpose features. It is **glance-first**: calm resting state, tap to drill into detail.

Design north star: *whisper, don't shout.* The budget is present but never prominent — a single quiet status indicator on the ambient surface, with real numbers only one tap away.

---

## 2. Decisions locked

**Stack**
- **Backend:** Supabase (Postgres + auth + realtime). Free tier is sufficient at two-person scale (500 MB DB, 50k MAU, 1 GB storage, 200 realtime connections). The constant iPad reads keep the project awake, so the 1-week auto-pause on free tier likely never triggers. Pro is $25/mo if ever needed, but not expected.
- **Frontend:** Single web app, iPad points a browser at it. Touch-designed (taps, not mouse).
- **AI runtime:** Claude API for the light LLM work (voice intent parsing, Gmail email parsing, morning briefing). Estimated ~$2–5/mo in tokens. Dev work happens on the Claude Max subscription (shared usage pool between chat and Claude Code — be deliberate during long build sessions).
- **Realtime multi-device:** Both phones write, iPad reads live. This is the whole point of using Supabase over local storage.

**Budget model — joint money, account-tracked (REDESIGNED)**
- **It's *our* money.** Matthew & Ashlee treat finances as one joint pool. No shared bank *accounts* is just a banking fact, not a philosophy — money is joint even though it lives in separate logins. HUE is a single household view of one pool, NOT a settle-up ledger between two people.
- **NO person attribution, NO split, NO reconciliation between people.** Dropped entirely: `paid_by`, `shared`, split ratio, `boss_income_ratio()`, "who owes whom." Spending is just household spending. (Note: user is **Matthew** — "Boss" is only Claude's assistant-address, never a data label.)
- **Accounts are the spine.** HUE tracks every account — checking, savings, credit cards, loans/debt. Assets hold positive balances; liabilities (cards/loans) hold negative. Net worth = sum of all balances.
- **Balances computed forward.** Each account has a starting balance; every transaction adjusts the account(s) it touches. HUE always shows a computed current balance.
- **Weekly recon = correction mechanism.** Matthew sanity-checks computed balances against real bank totals weekly. Drift → drop a `balance_adjustment` transaction to snap back to truth. Keeps HUE honest without hunting the missing transaction.
- **Credit cards are just negative-balance accounts (this inverts the old headache into a feature).** A purchase grows card debt; the autopay transfer moves money checking→card, reducing checking AND card debt. The card payment SHOULD appear — it's a real transfer between two tracked accounts, not a double-count to exclude.
- **Transaction kinds:** `spend` (draws down one account / grows a card), `income` (deposit into one account), `transfer` (moves between two accounts — paycheck→savings, autopay, card payment), `balance_adjustment` (weekly recon snap).
- **Goals = separate list, spans accounts.** Two kinds: `savings` (fill toward a target, e.g. emergency fund → $10k) and `debt_payoff` (drain toward zero, e.g. kill all card debt). A goal can watch several accounts; an account can feed several goals. Not welded to a single account.
- **Salary = static config, hand-patched.** No sliders, no live recompute. Answers "what's our monthly household income" for budgeting. Changes ~once a year → Matthew updates via a full code patch on a raise.

**Categories & goals — fluid, not frozen**
- Categories live in a table you can add to on the fly. Same table handles spending buckets AND savings goals (`type = expense | savings_goal`).
- Example: "save Ashlee's money for a trip" = one new row, `type=savings_goal`, `owner=Ashlee`, `target=$3000` → renders as a progress bar automatically.
- Starter categories: Food (groceries + DoorDash together), Rent, Utilities, Transport, Fun, Health, Subscriptions, Shopping, Misc.

**Inventory — voice-first, low-fidelity (+ optional loose quantity)**
- Core status: `ok` / `low` / `out`. Still the decision that keeps it alive — no mandatory quantity tracking.
- **NEW: optional loose quantity** (`plenty` / `some` / `little` or just free text like "half a bag") — never required, never servings/grams. Just enough for meal ideas to be smarter ("lots of chicken, some rice → stir-fry"). Absence is fine; suggestions fall back to presence/absence.
- Voice: Web Speech API (mic) → light LLM parse → structured status update. "We're out of pickles" → `{item: pickles, status: out}`. "Still plenty of pasta" → `{item: pasta, status: ok, qty: plenty}`.
- Anything `low`/`out` auto-generates a shopping list.
- **Manual editor (batch, LOCKED) — complements voice.** Voice = one-off flags mid-cooking ("out of pickles"); manual grid = post-grocery-run restock. Design:
  - **Direct status buttons** per item (ok / low / out) — one tap, no cycling/overshoot. Clutter accepted for speed.
  - **Add-item** affordance: type a name, set status, it joins the grid (grocery runs bring new items HUE doesn't know yet).
  - **"Just restocked" shortcut:** one button resets everything currently low/out → ok, then adjust exceptions. One tap instead of fifteen after a big run.
  - Optional `qty_loose` stays OPTIONAL — secondary tap/long-press, never mandatory friction. Default manual flow is status-only and fast.
  - Pure UI addition — inventory table already supports it (status, qty_loose, updated_by, updated_at). No schema change.
- **Meal suggestions (NEW):** LLM (same Claude API as the briefing) reads current inventory → suggests 2-3 dinner ideas that mostly use what's on hand. Ideas, not recipes — "taco night's doable," not "4 servings, 400g beef." One-line meal **headline** shows on the main dashboard; full ideas live in the Kitchen detail screen.

**Schedule — read-only mirror, BOTH APPLE (RESOLVED)**
- HUE displays the real calendar; no double-entry. **Boss & Ashlee both use Apple Calendar** (Ashlee's work calendar syncs into her Apple calendar), so this is the both-Apple path.
- **Decision: published `.ics` subscription = primary; CalDAV = documented upgrade.**
  - **`.ics` (chosen):** each makes the relevant calendar public in iCloud → copy the `webcal://`/`https://` feed URL → HUE fetches + parses on a schedule. No credentials, no Apple ID, read-only by nature. Only downside: refresh lag (Apple publishes on its own schedule, often hours apart). Fine for an ambient "what's next" glance surface.
  - **CalDAV (upgrade if lag bugs us):** reads current state on demand (no lag), but authenticates via Apple ID + a manual 16-char app-specific password per person, speaks XML/WebDAV (no JSON, no push → HUE polls), 1-year read window cap, and app-specific passwords can be revoked and silently break. Contained swap later — same `schedule` table, different fetch mechanism.
  - Rationale for `.ics` first: freshness is the ONLY thing it's worse at, and it's adequate for a kitchen glance. No credential to store/rotate/have revoked = better reliability for an always-on iPad. CalDAV effort now = paying upfront for a maybe-problem.
- **PRIVACY FLAG — Ashlee's work calendar:** a public `.ics` link is unauthenticated (anyone with the URL can subscribe; URLs are obscure but not password-protected). If her work events have sensitive titles, that tips toward CalDAV (authenticated) for her feed specifically. **Check with Ashlee what's in those events before publishing.** Mixed setup is fine — `.ics` for Boss, CalDAV for Ashlee, merged for display.

**Lights (Philips Hue) — BACK BURNER**
- Deprioritized for now. Notes retained below for when it's picked back up.

**Naming**
- User's name is **Matthew**. In HUE data and UI, always "Matthew" — never "Boss" as a label. "Boss" is only how Claude addresses him as his assistant, never a value stored anywhere.
- Home system = **HUE**. Personal system = **IKE**. When buying bulbs, say "Philips Hue" to disambiguate from HUE-the-project. Nickname TBD with Ashlee.

---

## 3. The three input pipes + one output pipe

HUE is fed by three inputs and (later) drives one output:

**INPUT — Plaid (bank truth) — CONFIRMED as single transaction source of truth**
- Auto-imports every transaction from both accounts, auto-categorized. Kills ~90% of manual entry.
- Plaid is the infrastructure Rocket Money is built on — the real programmatic pipe. (Rocket Money itself is a consumer app, not an API.)
- **Credit cards fully supported.** Transactions product covers depository (checking/savings) AND credit accounts (credit cards). Boss pays mostly by card → card connection alone captures ~all spending.
  - **Sign convention flips on cards:** card purchases arrive as POSITIVE, card payments/refunds as NEGATIVE (opposite of checking). HUE math must treat card purchases as spend and **filter out the card-payment transfer** (checking → card) so it doesn't double-count — that's money between Boss's own accounts, not an expense.
  - **History:** up to 24 months backfillable on connect + webhooks for live updates. Real data on day one, not a blank slate.
  - **Card-only wrinkle:** card captures spending but NOT salary deposits (those hit checking). Since income is now salary config, checking is optional — card alone covers the spending engine. Connect checking later only for the salary cross-check.
- **Pending accepted (LOCKED).** Ongoing lag is bank-dependent (swipe → pending → posted, ~1–3 days), not a Plaid limitation. Boss's bank is accurate on amounts; vendor name doesn't matter for HUE. Pending is fine for ambient "on track this month" use.
- **Income product NOT needed.** Plaid's dedicated Income/Bank-Income product is lender-oriented and now gated behind a sales contact for user-token access — enterprise friction not worth it for a 2-person dashboard. Salary config + optional deposit cross-check covers it.
- **`paid_by` DROPPED.** No person attribution — joint money. Card doesn't need to map to a person.

**Credit card handling (REDESIGNED — card = negative-balance account):**
- A card is just a liability account. A purchase grows its (negative) balance = debt up. The autopay is a `transfer` moving money checking→card: checking balance down, card debt down. Net worth unchanged by the payment (money moved between two owned accounts), correctly reduced by the purchase.
- **The card payment SHOULD appear** — it's a real transfer between two tracked accounts, not a double-count to filter. The old "exclude the autopay" logic is gone; under account-tracking it inverts into a correct, wanted transfer.
- Plaid still classifies transfers; HUE maps a checking→card payment to a `transfer` transaction touching both accounts. Autopay's predictability (same source/dest, ~monthly) still helps auto-detect it as a transfer vs. a spend.
- Caveats: free/dev tier limits, personal bank connections can be finicky. **Still deserves its own deep-dive before wiring (v1.5).**

**INPUT — Gmail API — DEMOTED to schedule/package pipe (LOCKED)**
- **No longer a transaction pipe.** Plaid posts everything within ~1–3 days anyway, and Boss doesn't care about the rarer email receipts. This dissolves the Plaid/Gmail transaction-dedupe problem entirely — Gmail stops competing with Plaid on money.
- **Primary job now = schedule.** Appointment/reservation extraction (flights, restaurants, doctor) → auto-add to schedule. The flight/big-reservation case is the one Boss actually wants.
- Package/delivery tracking (Amazon, UPS, FedEx, USPS) → "arriving today" on ambient screen. *This was the original idea.* (v3.)
- Optional keep-if-cheap: subscription detection, bill due-date reminders. Not load-bearing.
- Scope with Gmail labels/filters so the LLM only reads relevant emails (privacy + cheap parsing). Never point at the whole inbox.

**INPUT — Voice (Web Speech API) — commands AND conversational queries**
- Same front half always: Web Speech captures mic → speech-to-text. The back half branches by intent (LLM decides which):
  1. **Commands** (change HUE state): "we're out of pickles," "mark rent paid," "add milk to the list." → structured DB write. Basically free.
  2. **Questions about HUE's own data**: "what's our grocery budget at," "when's the next train," "what's low in the kitchen," "are we on track this month." → answered straight from the tables. Basically free.
  3. **Questions needing the outside world**: "how long to drive to Costco," "weather Saturday," "is my package here." → LLM calls a tool, then answers. Costs a small LLM+API call per query (same token pool as the briefing; accepted).
- **"Hue, how long to drive to Costco?"** = type 3. Needs location (has it — home address known), destination + live drive time (maps/traffic tool). Routes to maps tool → speaks ETA back. Same infra as the transit nudge, triggered by a question instead of a schedule.
- **Key design truth:** HUE can only answer questions it has a **tool or data** for. Each tool unlocks a category: maps → travel/traffic; calendar → schedule; inventory → kitchen; Plaid/accounts → money. "Did I leave the oven on" needs a sensor that doesn't exist → can't answer. So the real question isn't "can it answer" (yes) but "which tools do we wire," each unlocking a question class. This is the JARVIS-feel layer.
- Voice-first for inventory status flags remains; this just widens the same pipeline to Q&A.
- (Later) light control = another command intent type on the same pipeline.

**INPUT — UTA transit (commute "leave by" nudge) — DELAY-AWARE (chosen)**
- **Goal:** turn the train schedule into one calm line — "Leave by 7:44 to catch the 7:52 to work." Departure math = work start − train ride − walk to platform − buffer, anchored to the actual next train. When the train's late, the leave-by time shifts with it.
- **Sources — BOTH feeds (LOCKED delay-aware):**
  - **GTFS static** (`https://gtfsfeed.rideuta.com/gtfs.zip`; verify URL on build) = the plan. Timetables for TRAX + FrontRunner. Re-pull periodically (FrontRunner 2X construction 2026–2029 will change schedules; never hardcode).
  - **GTFS-Realtime** (UTA publishes trip-updates, vehicle positions, alerts; refreshed every few seconds) = the adjustment. Overlay RT trip-updates on the static schedule → real departure ("scheduled 7:52, actually 7:58").
- **Build pieces this adds (heads-up, all standard):**
  - GTFS-RT is **Protocol Buffer** data, not JSON → needs a protobuf decode step (gtfs-realtime-bindings lib or equivalent).
  - HUE **polls** the RT feed on the commute window (e.g. every ~60s from ~7:15–8:00) rather than computing once → one more scheduled job in the always-on runtime.
  - Leave-by math is unchanged; RT just feeds it a corrected train time instead of the scheduled one.
- **Nudge states:** on-time (amber/green, normal leave-by) and delayed (leave-by pushed later, "7:52 running 6 late"). Optional alert surfacing if UTA posts a service alert on the line.
- Route ref: FrontRunner = route 750; TRAX Blue 701 / Red 703 / Green 704. S-Line = streetcar.
- **Matthew's actual commute: S-Line → TRAX connection.** Home is 2255 S 300 E, right on the S-Line corridor → short walk to S-Line stop, ride to the TRAX interchange, transfer, TRAX to work. **This is a 2-train connection**, so the nudge must reason about the CONNECTION holding, not each train alone: an S-Line delay can blow the TRAX transfer, not just delay arrival. Leave-by should protect the transfer. (Delay-aware feed matters more here for exactly this reason.)
- **TBD when concrete:** which TRAX line + end station (S-Line meets Blue/Red/Green at different points) and the final walk to the office.
- **Placement:** TBD between ambient pill (A), Today-zone line (B), dedicated section (C). Leaning A+C.

**OUTPUT — Philips Hue local API (back burner)**
- Hue Bridge exposes a local REST API on your network → HTTP call, no cloud round-trip. Voice → parse → Hue API call, same pipeline as inventory.

**OUTPUT — Messaging / list sharing (grocery list to phones)**
- **iMessage: NO (deliberately).** Apple offers no public API to send iMessages programmatically. Only hack is an always-on Mac automating Messages via AppleScript — fragile, breaks on OS updates, unsupported, and Matthew's rig is Windows + iPad. iPad receiving iMessage ≠ a send pipe for HUE's backend. Avoid — build on pipes that don't rot.
- **Email: YES, easy, durable.** Backend sends the list in a few lines. Free (Gmail app password, or Resend/SendGrid free tier). Triggered by voice ("send me the grocery list"), a Kitchen-screen button, or a schedule (Saturday AM / when list hits N items).
- **Better fit — live shared list page (ideal):** HUE's already a web app on Supabase realtime. The shopping list can be a live page both phones open at the store, check items off together, updates in real time (Ashlee taps "milk," Matthew's view updates). This is the *pull* (list always right); email is the *push* (snapshot delivered). Not exclusive — offer both.
- **Lean:** email the list on demand. **Ideal:** live shared check-off page (leans on Supabase realtime, already in stack) + "send to email" button.

---

## 4. Automation roadmap (sequencing)

- **v1** — transactions + split reconciliation + categories/goals + manual entry. Prove the money engine.
- **v1.5** — Plaid auto-import (turns manual into automatic). *Own deep-dive first.*
- **v2** — calendar merge + inventory voice + shopping list + morning briefing.
- **v3** — nice-to-haves: package tracking (Gmail), meal suggestions from inventory, sports (Boss's teams), weather, idle photo frame, kitchen timers.

Full automation menu (for reference / future pulls):
- Money: Plaid import, split reconciliation, recurring bill detection, live balance sync
- Calendar/time: merged calendar feeds, weather "bring a jacket" line, commute/traffic
- Home/inventory: voice status flags, auto shopping list, optional barcode restock
- Life admin: package tracking, bill due-date reminders, meal suggestions
- Ambient/briefing: AI morning briefing (one paragraph: schedule + weather + budget status + kitchen low items + bills due — this is the main token spend and worth it), sports scores/schedule

---

## 5. Proposed schema (DRAFT — mark up before coding)

```
accounts                       -- the spine: every account HUE tracks
  id            uuid, pk
  name          text           -- "Ally checking", "Chase Sapphire"
  type          enum(checking, savings, credit_card, loan)
  starting_balance numeric      -- balance at the point HUE starts tracking
  -- current balance = starting_balance + sum(signed transaction effects)
  -- assets positive; credit_card/loan carry NEGATIVE balances (debt)

transactions                   -- account movement; no person, no split
  id            uuid, pk
  created_at    timestamp
  txn_date      date
  kind          enum(spend, income, transfer, balance_adjustment)
  amount        numeric        -- always positive; kind + accounts define direction
  account_id    fk -> accounts -- primary account (source for spend/transfer, dest for income)
  to_account_id fk -> accounts -- transfer destination only (null otherwise)
  category      fk -> categories  -- for spend (and optionally income)
  description   text
  source        enum(manual, plaid)

categories                     -- fluid: add rows anytime (unchanged in spirit)
  id            uuid, pk
  name          text
  type          enum(expense, savings_goal)  -- savings_goal legacy; goals table now primary
  target        numeric
  -- owner dropped (joint money)

budget                         -- monthly spend targets per category (unchanged)
  id            uuid, pk
  category      fk -> categories
  monthly_limit numeric
  month         date

goals                          -- separate list, spans accounts
  id            uuid, pk
  name          text           -- "Emergency fund", "Kill card debt"
  type          enum(savings, debt_payoff)
  target        numeric        -- savings: reach $X; debt_payoff: reach $0 (target=0)
  created_at    timestamp

goal_accounts                  -- many-to-many: which accounts a goal watches
  goal_id       fk -> goals
  account_id    fk -> accounts
  -- progress computed from summed current balances of linked accounts

salary_config                  -- static, hand-patched household income
  id            uuid, pk
  person        text           -- 'matthew' | 'ashlee' (label only, not a split)
  annual_gross  numeric
  takehome_pct  numeric        -- flat % for net
  -- monthly household net = sum over people of (annual_gross*takehome_pct)/12

inventory                      -- voice-driven; status required, qty optional
  id            uuid, pk
  item          text
  status        enum(ok, low, out)
  qty_loose     text           -- OPTIONAL: 'plenty'|'some'|'little' or free text; nullable
  updated_at    timestamp
  updated_by    text           -- optional label, nullable

-- Meal suggestions: computed, not stored. Same Claude API call as briefing.
-- Input = current inventory (items + status + qty_loose). Output = 2-3 dinner ideas
-- that mostly use what's on hand. Ideas only, no servings/quantities.
-- Main dashboard shows a one-line headline; Kitchen detail shows the full list.

schedule                       -- read-only mirror; both Apple, .ics primary
  id            uuid, pk
  title         text
  starts_at     timestamp
  ends_at       timestamp
  who           text           -- optional label (matthew/ashlee/joint), display only
  location      text
  source        enum(ics, caldav, gmail)
  ext_uid       text

packages                       -- Gmail-fed (v3)
  id            uuid, pk
  carrier       text
  tracking_no   text
  status        text
  eta           date
  description   text

-- Balance math (computed, not stored):
-- account current balance = starting_balance + sum of transaction effects:
--   spend      : account_id balance -= amount   (card: debt more negative)
--   income     : account_id balance += amount
--   transfer   : account_id -= amount ; to_account_id += amount
--                (checking→card autopay: checking down, card debt up toward 0)
--   balance_adjustment : account_id balance = starting + ... snapped to entered truth
-- net worth = sum(current balance of all accounts)
-- goal progress (savings)     = sum(linked account balances) / target
-- goal progress (debt_payoff) = how close sum(linked balances) is to 0 from start
```

Schema questions — status after redesign:
- ~~income-split ratio~~ → OBSOLETE. No split. Salary is static config for budgeting only.
- ~~Plaid/Gmail transaction dedupe~~ → still dissolved (Gmail off transaction pipe).
- ~~card double-count exclusion~~ → OBSOLETE. Card = negative-balance account; autopay is a real `transfer`. No exclusion logic.
- ~~separate vs. shared card / paid_by~~ → OBSOLETE. No person attribution.

Design notes for build:
- Balances computed forward from `starting_balance`; weekly `balance_adjustment` recon snaps to bank truth.
- Goals are a separate list (`goals` + `goal_accounts` M2M) spanning accounts; savings fill up, debt_payoff drains to zero.

Still open (later, non-blocking):
- Salary numbers + take-home % — Matthew patches into `salary_config` when ready (static).
- Starting balances for each real account — entered manually at setup.

---

## 6. Ambient UI concept (DRAFT — mark up before coding)

**Two states:**

**A) Resting state (ambient, default)** — calm, glanceable from 6 ft, looks intentional on the counter:
```
+-------------------------------------------------------+
|                                                       |
|                      2:47 PM                          |
|                   Tuesday, Jul 14                     |
|                                                       |
|        ☀  74°  Salt Lake City   ·   ● (green)         |
|                                                       |
|     Next: Dinner w/ Ashlee 6:30   ·   📦 1 arriving    |
|                                                       |
+-------------------------------------------------------+
```
- Big clock + date. Weather line. ONE small budget dot (green/amber, no numbers).
- One-line "next thing" from the calendar. Quiet package/kitchen flag if relevant.
- Optional: idle photo-frame mode (stolen from Nest Hub) when fully idle.

**B) Dashboard state (tap to wake)** — the glance layer opens into zones:
```
+-------------------------------------------------------+
|  HUE                                    2:47  74° ☀   |
+-------------------+-----------------+-----------------+
|  TODAY            |  KITCHEN        |  MONEY  ●green   |
|  6:30 Dinner      |  Low: milk      |  (tap for detail)|
|  8:00 Gym         |  Out: pickles   |  On track ✓      |
|  (calendar feed)  |  [Shopping list]|  goals: Trip 40% |
+-------------------+-----------------+-----------------+
|  PACKAGES         |  BRIEFING (AI, morning)            |
|  📦 Amazon today  |  "Good morning — 2 events today,   |
|  📦 UPS Thu       |   milk's low, rent due Fri..."     |
+-------------------+-----------------+-----------------+
```
- **Money zone** tapped → full picture: account balances (checking, savings, cards, loans), household net worth, per-category spend vs. limit, and goal progress bars (savings filling up, debt draining to zero). NO "who owes whom" — it's joint. This is where real numbers live.
- Calendar zone → full week. Kitchen zone → shopping list. Everything deep is *behind* a tap.

**Bases covered vs. Nest Hub / Echo Show:** clock+weather ✓, calendar ✓, light controls (later) ✓, voice ✓, timers/reminders/lists ✓, idle photo frame ✓. **Intentionally skipped:** media/streaming (not the point). **HUE-exclusive:** budget/split engine + Gmail package/receipt ingestion — the things the commercial devices don't do.

---

## 7. Working style (for chats in this Project)

- Address the user as **Boss** in conversation (he finds it fun) — but his name is **Matthew**, and any stored/displayed data uses Matthew, never Boss.
- Collaborative, optimistic, supportive. Run suggestions by Boss and talk through tasks before executing — review ideas together first, then code, especially when Boss shares pictures or data.
- Always offer a **lean/minimal** option and an **ideal/fully-loaded** option. Boss prefers ideal/fully-loaded for his own setup.
- Always include **prices** (best available) when discussing options to buy.
- Boss's rig (for local/dev work): Windows, RTX 5070 (12GB VRAM), Ryzen 7 7800X3D, Anaconda, `ml-env` Python 3.11, PyTorch nightly CUDA 12.8, full NLP/ML stack, VS Code + Positron with Jupyter kernel.

---

## 8. Philips Hue reference (back burner — for when lights resume)

- **Bridge is the non-negotiable** — it's what exposes the local REST API. Bulbs without it are just someone else's cloud.
- **Standard Bridge 2.0** (~$50–60, HomeKit-compatible) does everything HUE needs for local API control. **Bridge Pro** (~$399 in kits, AI features, 150+ lights) is overkill at apartment scale.
- Starter kits (Bridge + bulbs): 2-bulb color kit ~$99.99; 2–4 pack kits $130–220 full price, sometimes <$110 on sale. Individual bulbs ~$25–55.
- Accessories: Tap Dial Switch / Smart Button ~$37.99–54.99 (physical backup to voice).
- **Buy rec — Lean:** one 2-bulb color starter kit (~$100 on sale) for the Bridge + one zone. **Ideal:** 4-bulb color kit (~$150–220 on sale) for the whole living room.
- Flow when resumed: Web Speech (mic) → LLM parse → Hue local API HTTP call. Same voice pipeline as inventory, just a new intent type.

---

## 9. Next actions

- [ ] Matthew: create the Claude Project "HUE," paste this doc in as knowledge.
- [x] ~~Resolve schedule pipe~~ → both Apple; `.ics` primary, CalDAV upgrade. (Check Ashlee's work-calendar privacy before publishing.)
- [ ] Build v1 schema in Supabase — REDESIGNED around `accounts` + `goals`, no split. Tables: accounts, transactions (spend/income/transfer/adjustment), categories, budget, goals, goal_accounts, salary_config, inventory, schedule, packages.
- [ ] Deep-dive Plaid as its own conversation before wiring (v1.5).
- [x] ~~income-split ratio storage~~ → OBSOLETE (no split).
- [x] ~~separate vs. shared card~~ → OBSOLETE (card = negative-balance account, no attribution).
- [ ] Matthew: provide salary numbers (annual + take-home %) — patch into `salary_config`, static.
- [ ] Matthew: enter starting balances for each real account at setup.
