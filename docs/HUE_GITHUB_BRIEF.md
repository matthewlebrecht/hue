# HUE — GitHub Publish & README Brief (for Claude Code)

Hand this to Claude Code once `gh` (GitHub CLI) is installed and I've run `gh auth login`. Work through it in order. Pause and tell me if anything needs my input (like confirming the repo name or my GitHub username).

---

## 0. Pre-flight — protect secrets FIRST (do this before anything is pushed)

This project will be public eventually, so before any push:

1. Confirm `.env` (and any file holding the Supabase URL/anon key or other secrets) is listed in `.gitignore`.
2. Check it was **never committed** in earlier commits — run `git log --all --full-history -- .env` and if anything shows up, tell me before pushing; we'll scrub history rather than leak a key.
3. Confirm no keys are hardcoded anywhere in `src/`. Supabase URL + anon key should come from env vars only.
4. Report back: "secrets clean" or a list of what you found. Do not push until this is confirmed.

---

## 1. Create the repository (PRIVATE to start)

- Use the `gh` CLI to create a **private** repo named `hue-household-dashboard` (or suggest a better name and let me pick).
- Description: "HUE — a household ambient dashboard: joint-money tracking, kitchen inventory, and transit-aware commute nudges. React + Supabase."
- Push the existing local commit history up to it — preserve all commits, don't squash. The commit history is part of the portfolio story.
- After pushing, give me the repo URL.

Keep it private for now; I'll flip it public when it's polished.

---

## 2. Write a portfolio-grade README.md

This is the first thing a reviewer reads — make it strong. Use `HUE_BUILD_BRIEF.md` and `HUE_Project_Knowledge.md` in the repo as source material. Structure:

- **Title + one-line pitch.** What HUE is in a sentence.
- **Short overview.** The problem (a shared household needs one calm surface for money, kitchen, and schedule) and the approach (glance-first ambient iPad dashboard, "whisper don't shout").
- **Key features**, framed around the interesting design decisions, not just a list:
  - Joint-money model — accounts as the spine, balances computed forward, no person-splitting (a deliberate product choice, explain briefly why).
  - Credit cards as negative-balance accounts; autopay as a transfer, not a double-count.
  - Goals that span accounts (savings fill up, debt drains to zero).
  - Kitchen inventory with voice + batch manual editing; meal ideas from what's on hand.
  - Transit-aware commute nudge (UTA GTFS, S-Line→TRAX connection, delay-aware).
  - Row-Level Security with a security_invoker fix that closed a real view-leak (worth calling out — shows security awareness).
- **Tech stack.** React + Vite, Supabase (Postgres + auth + realtime), Claude API for AI features. Note it's built to run on a kitchen iPad + phones.
- **Architecture.** A short section: the three-level UI hierarchy (ambient → dashboard → detail), the data model spine, the input/output pipes (Plaid, Gmail, voice, transit, calendar). A simple diagram or bullet map is fine.
- **Screenshots.** Leave clearly-marked placeholders like `![Dashboard](docs/screenshots/dashboard.png)` — I'll add real screenshots once the UI's running.
- **Status.** Honest "work in progress — v1 money engine complete, kitchen/commute in progress" with a short roadmap.
- **A brief note on how it was built.** One or two sentences: designed and architected by me, built with AI-assisted development (Claude Code). Own it — directing AI tooling to ship real software is a current, demonstrable skill.

Keep the tone clear and confident, not padded. Aim for something a hiring manager skims in 60 seconds and comes away knowing what it is, why the design is thoughtful, and what I can do.

---

## 3. Add supporting docs to the repo

- Create a `docs/` folder and move `HUE_BUILD_BRIEF.md` and `HUE_Project_Knowledge.md` into it (or copy), so the design thinking is browsable in the repo.
- Create `docs/screenshots/` as the home for images I'll add later.
- If the mockup HTML files are in the project, put them in `docs/mockups/` too — they're nice visual artifacts.

---

## 4. Commit and push

- Commit the README and docs with a clear message ("Add portfolio README and design docs").
- Push to the repo.
- Give me the final repo URL and confirm everything's up.

---

## 5. Ongoing habit (just note this for me)

From here, when you finish a meaningful chunk, commit with a descriptive message and push to GitHub so the repo stays current and the history keeps telling the build story. Descriptive commit messages > "wip" — they're part of what a reviewer sees.

---

**Start with section 0 (secrets) and do not push anything until you've confirmed secrets are clean.** Then work through 1→4, checking in with me on the repo name and anything ambiguous.
