# Phase 2: Make the data real

This follows [AUDIT_REPORT.md](AUDIT_REPORT.md) §10, Phase 2. Phase 0 and 1 are in [CHANGES_PHASE_0_1.md](CHANGES_PHASE_0_1.md).

**In one line:** every number, chart and list in the app now comes from the database through the API. Nothing is invented, and nothing is stored only in the browser.

## ⚠️ What you need to do

1. **Run the database migrations** on your Autonomous Database as the schema owner, in order. See [db/README.md](db/README.md) (Flyway command or SQLcl `@` files):
   - `V1` helper package
   - `V2` likelihood/impact columns, indexes and foreign keys
   - `V3` the new module tables
   - `V4` correctly spelled views

   Each one is safe to re-run. Read the `DBMS_OUTPUT`: any `WARNING:` line needs a manual look.
2. **Give the API's OAuth client access** to the new REST endpoints (they are created with authentication required), then run `cd api && npm run check:ords-anon`.
3. **Optional:**
   - Run `db/seed/demo_data.sql` on a demo schema for sample content. Remove it later with `DELETE … WHERE CREATED_BY = 'demo-seed'`.
   - Run `db/scripts/migrate_legacy_assessments.sql` to move assessment cycles that the old app stored as risk rows. It shows a preview first and deletes nothing.

Until the migrations have run, the new modules show **"This module isn't set up in the database yet"** instead of failing.

## Database (`db/`)

| Change | Why |
|---|---|
| Inherent and residual likelihood and impact (1–5) on the risk register, with CHECKs | Scores are stored instead of guessed from row IDs or money values |
| 13 new tables: controls, policies, incidents, vendors, BCP plans, scenarios, risk appetite, approval requests and steps, settings, plus 3 link tables | These modules previously lived only in the user's browser |
| Unique keys, CHECK constraints matching the app's choices, `RPO ≤ RTO`, "a rejection needs a comment" | The database rejects invalid data, not just the UI |
| Indexes on every join column; foreign keys added `ENABLE NOVALIDATE` | Faster joins. New rows are checked, and existing orphans can be listed with `db/scripts/find_orphans.sql` |
| KRI owner and direction on the existing KRI table | KRI status depends on whether a high value is good or bad |
| Correctly spelled read-only views over `…CLASIFICATION` / `…COMPUATION…` | Clean names without breaking the APEX app |

## API (`api/`)

- **New tables in the registry**, with stricter column types:
  - allowed-value lists that accept any letter case and store the standard spelling
  - number ranges (risk score 1–100, tolerance 1–25)
  - 1–5 ratings
  - e-mail addresses

  Only approvers can change risk appetite.
- **Server-side listing.** `page`, `pageSize`, `sort`, `order`, `search` (ignores letter case) and `filter` return exact totals. Empty values always sort last.
- **Approval workflow engine** (`/api/workflow`):
  - The submitter is taken from the sign-in session.
  - Nobody can approve their own request, and one person can't sign two steps.
  - Steps are decided in order, by the step's role.
  - A rejection needs a comment.
  - Two people deciding at once is detected, and only one decision is kept (409).
  - Requests can be withdrawn by the submitter.
- **Organisation settings** (`/api/settings`) are validated and admin-only. Only settings that change behaviour are kept: organisation name, industry, currency, idle sign-out time, and the score bands.
- **"Not set up yet" answers** (`503 NOT_PROVISIONED`) when a module's tables are missing.
- Rate limits apply per signed-in user, not per IP, so colleagues behind one office IP don't slow each other down.
- 91 API tests, up from 56.

## Web app

**Foundation**
- **`lib/risk.ts`**
  - A risk without ratings is "Not rated". It is never given a score derived from its ID or money value.
  - Score = likelihood × impact.
  - Bands come from Settings.
- **`lib/data.ts`**
  - One set of React Query hooks for reading and writing any table, with server paging and search.
  - The second (hidden) request cache is gone.
- **`lib/settings.tsx`**
  - Every money amount uses the organisation's currency, and every score colour uses its bands.
  - Users are signed out after the configured idle time.
- **Shared loading, error, empty and "not set up" states**, a pager, and a score badge.
- **Removed**
  - The browser-only data stores (`lib/localStore`).
  - The legacy `oracleService`, including its invented scores, made-up risk statements, default "APPROVED" status and fake money values.
  - Unused layouts and hooks.

**Modules now stored in Oracle**

| Module | What changed |
|---|---|
| Controls | Full register with search and filters. Controls can be linked to real risks. Effectiveness ratings, last tested date, CSV export. |
| Policies | Review due/overdue is worked out from dates. Policies can be linked to controls. |
| KRIs | Real definitions and readings. The current value is the latest reading. History charts use real dates. Recording a reading computes its colour from the direction and thresholds. The matrix and threshold editor are real too. |
| Vendors, incidents, BCP, scenarios | Full registers with validation. Overdue states come from dates. An incident's closed date is set and cleared automatically. Incidents can be linked to risks. Expected loss and loss uplift are real calculations. |
| Risk appetite | Current exposure is **computed** from rated risks in each category. It is no longer typed in by hand. |
| Workflow | Built on the server engine. Tabs: "Waiting for me", "My requests", "All". Each request shows why you can't decide it, when you can't. |
| Settings | Only settings that work, plus a live preview of the score bands. |

**RCSA flow**
- Assessment cycles are real records in `ERM_TRN_ASSESSMENT_CYCLE`, no longer disguised as risk rows. Each shows its count of risks, rated risks and approved risks.
- **Risk register**
  - Paged, searchable, sortable and filterable on the server.
  - Create and edit include likelihood and impact.
  - CSV import reports each failed row instead of claiming success; CSV export is real.
- **Inherent assessment**
  - Updates the existing risk's ratings and saves an assessment record.
  - It no longer creates junk risk rows.
- **Applied controls**
  - Picked from the control library.
  - Residual rating is recorded on the risk, and the real reduction is shown.
  - Fixed: residual impact was being written into inherent likelihood.
- **Action plans and plan hierarchy** use their real columns.
  - Overdue comes from dates.
  - "Finalize cycle" closes the cycle record.

**Dashboards and reports**
- **Dashboard**
  - Every tile is computed from the database.
  - Control coverage is now "% of risks with at least one control"; it used to be "2500%".
  - Figures include risks by band, recorded loss expectancy, overdue action plans, KRIs in red or amber, open incidents, and approvals waiting for you.
  - Risk trend comes from real creation dates.
- **Heatmaps** show real inherent and residual ratings; clicking a cell lists its risks. The fake "trend" view is gone.
- **Reports** are generated on demand from live data, with CSV and print. The fake "last generated" dates and hardcoded KPIs are gone.
- **Assessment analytics and residual pages** use the correct ratings and show "not yet assessed" counts.

**Routes**
- `/` now goes to `/dashboard`; the old second dashboard of about 1,000 lines with fallbacks is removed.
- Duplicate pages redirect to their canonical page: two appetite pages, two old risk-planning pages, and one monitoring page.
- Several pages that rendered without the sidebar now have it.

## Verified

- **API:** typecheck ✔, 91/91 tests ✔, build ✔.
- **Web:** typecheck ✔, production build ✔ (42 routes).
- **Browser tests** (saved in `e2e/`): 17 data checks and 18 security checks, all passing, run against the local ORDS stand-in seeded with the real risk rows and the demo module data, as each role:
  - All 31 pages render with real data and no errors, and the 5 redirects work.
  - Data survives clearing browser storage, because it's in the database.
  - The dashboard has no fake figures, and legacy risks show as not rated.
  - Changing the currency to EUR changes money values across the app.
  - A rated risk in a new cycle shows inherent 20 · Critical and residual 6 · Low.
  - A recorded KRI reading appears in the matrix.
  - An Assessor can't approve; a Risk Manager approves in the UI.
  - A Viewer sees no add buttons.
- **Not run against the real Oracle database.** This sandbox can't reach it. Run the migrations and smoke-test on a test schema first.

## Independent review: findings fixed

A separate review crawled every route as each role and ran the main flows. Everything worked; these issues were fixed:

| Finding | Fix |
|---|---|
| The notification bell showed invented events to everyone | It now lists real items needing your attention: approvals waiting for you, KRIs in red or amber, overdue action plans. Its count badge only appears when there is something to show. |
| The RCSA hub claimed "Real-time DB synchronization", "SOX & ISO 27001", and the footer showed a hardcoded "Version 3.0" | The hub shows live counts for each lifecycle stage. The version comes from `package.json`. |
| Deleting a risk would fail on Oracle (child rows) or leave orphans | Foreign keys now cascade to applied controls, action plans and assessment records. The delete dialog says what will be removed. A library control that is applied to risks can't be deleted; retire it instead. |
| `NOVALIDATE` foreign keys combined with whole-row updates would have blocked edits to the 25 legacy risks | Foreign keys are only ever added fully validated. If old rows point at missing parents, the key is skipped and a warning says how many rows to fix. |
| Migration warnings were invisible under Flyway, and `SET` commands broke Flyway Community | Every message goes to a `PERICOPE_MIGRATION_LOG` table. The `SET` lines are removed from the migrations. |
| One demo seed row broke a CHECK constraint | Fixed. A test now checks every seed row against the API's rules. |
| Dates showed a day early for users west of UTC | Calendar dates are displayed in UTC. |
| An idle background tab signed the user out everywhere | Tabs share the last-activity time. An idle sign-out ends only this browser's session. |
| A Risk Manager could approve a risk they created | The API refuses self-approval; the creator comes from the audit log. |
| "Load all rows" requests grew quadratically and silently stopped at the cap | A single request (`all=1`) loads everything, and truncation is reported. |
| Small inconsistencies | Control coverage now uses the same rule on every page. The residual reduction is labelled correctly. The vendor report excludes Exited vendors. CSV exports keep negative numbers as numbers. Settings warn that changing currency doesn't convert amounts. Link pickers work beyond 50 links. |

## Still open (Phase 3+)

- **Visual redesign:** design system, persistent sidebar, merged navigation, dark mode, mobile.
- **Data model gaps:**
  - The 25 existing risks have no likelihood or impact ratings. Rate them under **Inherent Analysis**.
  - `PER_TRN_INHERENT_RISK_ASSESSMENT` has no rating columns, so assessment history keeps the reasoning, not past scores.
  - Mitigation plans have no column linking them to a risk.
  - Users and the audit chain are still stored in files on the API server.
- **Scale:** "overdue" and "due soon" can't be server filters yet (the filter only does exact matches). Listings over 20,000 rows are capped and say so.
