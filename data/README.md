# UApplyPal reference data

This folder holds the admissions **reference data**: universities, programs, intakes, deadlines,
tuition, requirements, scholarships and benefits. Personal data (profile, application progress,
documents) is not stored here. It lives in the runtime store (`data/runtime/`, not committed).

## Rules

1. **Program ≠ Intake.** A program (e.g. WU BSc Business and Economics) has one intake per
   academic year. Deadlines, tuition, requirements and windows belong to the intake.
2. **Every fact has a source and a verification status.**
   - `VERIFIED`: an official source explicitly confirms the value for this intake. Only set this
     after someone has read the official page.
   - `EXPECTED`: from a previous cycle, a search summary, or a typical pattern. It has not been confirmed on the official page.
   - `UNKNOWN`: no reliable value.
3. **Never copy a previous cycle's date into a new intake as if it were current.** Put it in
   `date_text` / `note` and keep `status: EXPECTED` (or leave `date` null).
4. Prefer official sources: admissions pages, regulations, scholarship pages, government sites.

## Files

- `universities/<id>.json`: one university with its programs, intakes, scholarships and benefits.
- `requirement-templates.json`: common requirement items that intakes reference by key.
- `exams.json`: exam catalog (SAT, IELTS, university tests…) with preparation resources.
- `living-costs.json`: rough monthly living-cost estimates per city.
- `sources.json`: shared sources (project brief, estimates, ranking sites).
- `national-schemes.json`: country-wide funding (e.g. Ukrainian state compensation of contract tuition
  for children of combatants and fallen defenders, the state grant, the Dutch temporary-protection fee).
  Each scheme is a `benefit` or `scholarship` for a `country`, optionally only `university_types`
  (`public`/`private`). `categories` (defined in the same file) limits it to students who ticked that
  family/residence status in their profile; scholarships and benefits in university files can use them too.
  Fact ids are `nat.<id>`.
- Tuition is stored in EUR per year. For UAH/PLN prices put the original in `detail` with the rate used.
- `rankings.json`: ranking systems (THE, U.S. News) and how many institutions each edition ranks.
  Each university lists its `rankings` (system, edition, `rank_text` like `107`, `=176`, `301–350` or
  `not ranked`). The app averages the ranks after normalising each to 0–100 by edition size.

Local ids (deadlines, requirements, tuition items) are expanded by `src/catalog.js` into global
fact ids such as `wu-bbe-2027.d.opens`. User verifications and edits are stored as overrides keyed
by these ids, so changing a local id loses its overrides.
