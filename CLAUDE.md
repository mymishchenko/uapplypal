# UApplyPal

Personal university-admissions agent: structured, source-verified admissions data turned into a
personal action plan. First user: one Ukrainian student applying to European business bachelors
for September 2027. Keep models generic (other students, countries, years).

## Architecture: DATA / LOGIC / UI are separate

- `data/`: reference data (committed). One file per university in `data/universities/`.
  Read `data/README.md` before editing. **Program ≠ Intake**: deadlines, tuition and
  requirements belong to the intake (academic year).
- `src/catalog.js`: loads and validates data, assigns global fact ids (`<intake>.d.<id>`,
  `<intake>.r.<id>`, `<intake>.t.sticker`, `<uni>.s.<id>`, `<uni>.b.<id>`), applies user overrides.
- `src/store.js`: personal data (profile, application progress, documents, exam plans,
  verifications) in `data/runtime/store.json` (gitignored, never deployed over).
- `src/logic/`: all business rules. `windows.js` (Can I apply now?), `cost.js` (real cost),
  `match.js` (fit + Reach/Target/Safe estimate), `rankings.js` (combined ranking score: THE and
  U.S. News ranks each normalised to 0–100 by edition size, then averaged), `views.js` (dashboard, actions, exam planner,
  documents). The client never re-implements these.
- `src/api.js`: JSON API; every mutation returns the full recomputed view.
- `src/notify/`: the tracking agent (no AI, no web access). `emails.js` decides which deadline
  alerts are due (30/14/7/3/1 days, missed final deadlines) and renders alert + weekly summary emails
  from the computed view; `scheduler.js` checks hourly (from 08:00 Kyiv, weekly on Mondays) and records
  sent keys in the store so nothing is sent twice; `mailer.js` sends via Gmail SMTP (`GMAIL_USER`,
  `GMAIL_APP_PASSWORD`, optional `NOTIFY_TO`). Tests use a fake mailer.
- `client/`: React + Vite UI (`client/src/pages/*`). No admissions data hardcoded in components.

## Data rules (critical)

- Every fact has `source` + `status` (`VERIFIED` / `EXPECTED` / `UNKNOWN`).
- Only mark `VERIFIED` after reading an official page that confirms the value for that intake.
  Search-engine summaries are `EXPECTED`.
- Never copy a previous cycle's date into `date` for a new intake; put it in `date_text`.
- OPEN / NOT YET OPEN / CLOSED are only computed from verified dates; otherwise UNKNOWN.
- Ukrainian benefits are per academic year; never assume continuation.
- No admission probabilities. Reach/Target/Safe are labelled estimates.

## Commands

- `npm test`: logic + API tests (Node test runner).
- `npm run build`: build client to `client/dist`.
- Dev: `npm run dev:server` (port 3000) and `npm run dev:client` (Vite, proxies /api).

## Deploy

Push to `main` → GitHub Actions tests, builds, rsyncs to Hosting Ukraine over SSH, runs
`npm ci --omit=dev`. See `docs/DEPLOY.md`. The app is public (no login, by the owner's choice):
anyone with the URL can view and edit. Don't commit secrets, `.env` or `data/runtime/`.
