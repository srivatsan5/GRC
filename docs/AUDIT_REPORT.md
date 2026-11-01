# Pericope ERM / GRC: Full Project Audit

**Branch:** `feature/production-grade-refactor` · **Date:** 2026-11-01 · **Scope:** the whole repo (317 tracked files). That covers the frontend, the backend (BFF), the database script, the frontend↔backend↔database wiring, deployment, CI, tests and repo hygiene.

---

## 1. Verdict in one paragraph

The app **builds and looks clean**. Next.js compiles all 42 routes, TypeScript reports 0 errors, the browser console is clean and pages load in about 1.5 s. But it is **a polished demo, not a working GRC system yet.** Most numbers on screen are hardcoded or computed from fake fallbacks. 11 modules save only to the user's browser (localStorage), not to the database. The backend has no real authentication, so anyone can read, write or delete any of the 48 tables. A backend bug means **approvals and "Complete" status can never be saved to Oracle**. When the database is unreachable, the backend silently "succeeds" into memory and loses the data on restart. Finally, the Oracle credentials are committed to git.

### Scorecard

| Area | Score | Why |
|---|---|---|
| Visual design (look and feel) | 6/10 | Clean, consistent "enterprise slate" look on most pages, but 3 visual styles are mixed, many pages are sparse, 8 routes render without the app shell, and the result doesn't match `.stitch/DESIGN.md` |
| Frontend correctness | 3/10 | Fake or hardcoded metrics, dead buttons, broken search and pagination, duplicate pages |
| Frontend ↔ Backend | 3/10 | Errors are swallowed into `[]`, fields are silently dropped, the API URL is baked in at build time |
| Backend ↔ Database | 2/10 | Default values overwrite user data, a silent in-memory fallback, no schema DDL in the repo |
| Security | 1/10 | Committed secrets, no authentication, a role taken from a request header, CORS `*`, open audit log |
| Deploy / CI / Tests | 2/10 | 4 diverging backends, CI fails (Node 18), Docker healthcheck is wrong, zero automated tests |

---

## 2. What I verified, and how

| Check | Result |
|---|---|
| `npm ci` | ✅ installs |
| `tsc --noEmit` (strict) | ✅ 0 errors |
| `next build` | ✅ 42 routes compiled. The build skips type checking anyway because `ignoreBuildErrors: true` |
| `npm run lint` | ❌ ESLint isn't installed and there is no config |
| Automated tests | ❌ none exist. The `*.mjs` "tests" are ad-hoc scripts with no assertions |
| `npm audit` (prod) | ❌ 20 vulnerabilities (2 critical, 8 high). All fixable with `npm audit fix` |
| Ran BFF and app, opened pages in a headless browser | ✅ no console errors once the BFF runs on port 5000 |
| Live calls BFF → Oracle ORDS | ⚠️ **Not verifiable from my sandbox.** Its network policy blocks `*.oraclecloudapps.com`. I did not fake this result. To let me test against the real DB, add that host under *Allowed domains* in the environment's network settings (https://code.claude.com/docs/en/cloud-environments#network-access) |
| Backend behaviour with the DB unreachable | Tested live. See §4 (several bugs reproduced) |

---

## 3. 🔴 Critical: fix these first

1. **Oracle OAuth `CLIENT_ID` / `CLIENT_SECRET` are committed in `.env`** (since the first commit). Rotate them in Oracle now, then remove `.env` from git and its history. Also, 3 zip scripts (`zip-frontend.cjs:24`, `zip-source.cjs:14`, `create-backend-zip.cjs:22`) would pack `.env` into the next deploy zip.
2. **No authentication on the API.** The role is read from the client's `X-User-Role` header. A request with **no header defaults to `System`, which has every permission** (`server.js:261,268`). I confirmed it: `curl` with no headers created, updated and deleted rows. The login screen accepts any password of 6+ characters, and **an inactive user's login falls back to the Administrator account** (`auth-provider.tsx:84-87`).
3. **Approvals and completion can never be saved.** `coerceTablePayload` spreads its defaults *after* the user data (`server.js:183`), so every POST and PUT forces `APPROVAL_STATUS='DRAFT'`, `IS_STAGE_COMPLTED='N'`, `STATUS='Y'` and `COMPLETION_PCT=0`. I reproduced it: sending `APPROVED` came back as `DRAFT`. The same bug is in `production/backend/server.js`.
4. **Silent data loss.** When Oracle returns *any* error (including a 400 validation error), the BFF answers 200/201 and stores the row in an in-memory "shadow" map. That data is never synced and disappears on restart. DELETE reports success even when nothing was deleted. A PUT to a non-existent id creates a ghost row (reproduced).
5. **Delete buttons on fabricated rows can delete real records.** When an assessment has no risks, the details pages invent rows with IDs like `assessmentId*10+1` and `riskId*100+n`, and their Delete buttons send real DELETEs for those IDs (`provisioning-assessment-details.tsx:100-131,424`, `provisioning-applied-controls.tsx:68-91,382`).
6. **Any of the 48 tables can be written**, including `per_mst_user_details`, `per_mst_roles` and `per_mst_user_roles_mapping`. Only 12 tables have column whitelists. `:id` goes into the upstream URL unvalidated (path-traversal risk on the same ORDS host, using the BFF's token).

---

## 4. Backend (BFF) audit

**Canonical file:** root `server.js` (Express 5, ESM, 609 lines). Three other copies have drifted apart:

| File | What it is | Shipped by |
|---|---|---|
| `server.js` | Newest; has RBAC, shadow store, sanitizer | Dockerfile only |
| `production/backend/server.js` (860 lines) | helmet, morgan, FK auto-enrichment, **no RBAC at all**; Express 4 | `zip-production.cjs` → Hostinger zips |
| `dist-deploy/backend/server.js` (313 lines) | 13 tables, no OAuth, no RBAC | the zip its README says is live on `api.datapulsefusion.com` |
| `backend/server.js` + `backend/src/*` | Old skeleton plus dead "clean architecture" code; needs deps it doesn't declare | nothing |

**Bugs reproduced or confirmed in `server.js`:**
- Defaults overwrite user values (see §3.3). They are also applied twice, and are even sent as a JSON body on DELETE.
- A single OAuth failure sets `authDisabled = true` **forever** and silently drops to unauthenticated calls (`:330`). The health endpoint showed `authMode: "Direct-ORDS"`.
- One 404 marks the whole table "unavailable" until restart (`UNAVAILABLE_CACHE`).
- Shadow rows end up holding both `approval_status` and `APPROVAL_STATUS`. After the frontend lowercases keys, the last one wins.
- The "junk filter" rejects real words: `"rhythms"` → *"keyboard-mash junk"*. Any name or title under 3 characters is rejected.
- `POST /api/erm_trn_audit_log` lets anyone forge audit entries (reproduced: an entry as "CEO / Administrator"). The audit log lives only in memory and is capped at 5,000 entries.
- CORS `origin: '*'`. helmet, rate-limit and compression are installed but **not used**. Error messages leak `err.message`, and `/health` exposes the upstream URL.
- The shadow store is unbounded and accepts 5 MB bodies. `Math.max(...rows)` can overflow the stack. Shadow IDs start at 10000 and will collide with real UUIDs (currently around 1500).
- `CONTROL_OWNER` is coerced to a number, so "IT Security" is saved as `1`.

---

## 5. Frontend ↔ Backend connection

- **Errors are turned into empty data.** `oracleService.fetch` catches everything and returns `[]` (`lib/oracleService.ts:249`). A backend outage looks like "no risks yet", and no page can show an error state. Every payload is also `console.log`ged.
- **The API URL is baked in at build time** (`NEXT_PUBLIC_API_URL`, default `http://localhost:5000`). A build without it calls localhost in production. I hit this during testing.
- **Fields are silently dropped by the backend whitelist:** `assessment_reference_number(_uuid)`, `identify_risk_uuid`, `assessment_registered_date`, `hierarchy_level`, `business_process_name`, `justification`. As a result, **risks can never be linked to their assessment.**
- **The data parser invents values** (`oracleService.parseRiskRecord`, `:869-930`):
  - Missing likelihood/impact are derived from the row ID: `(id*7)%5+1`.
  - Canned statements ("SWIFT payment gateway latency…") replace real ones.
  - Status defaults to **APPROVED**.
  - It drops `inherent_sle`, so the SLE shows $40,000 on every row.
  - So **every heatmap, score and "Approved" badge is fiction.**
- **Wrong tables:**
  - Assessment cycles are saved as *risk* rows, which pollutes the register and every chart. `erm_trn_assessment_cycle` is never used.
  - The Inherent Assessment form creates a new risk row instead of writing to `per_trn_inherent_risk_assessment`.
  - The action hierarchy ignores `per_trn_mitigation_plans.PARENT_PLAN_UUID`.
- **Two caches stacked:** an axios cache (5 min) plus React Query (1 min stale). Mutations clear the axios cache but don't invalidate React Query in most pages.
- **Split persistence:**

| Saves to Oracle (via BFF) | Saves only to the browser (localStorage) |
|---|---|
| Risk identification, provisioning, controls, monitoring, KRI-definition delete | Control Library, KRI Intelligence, Risk Appetite, Workflow, Vendor Risk, Incidents, BCP, Scenario, Policy, **Users**, **Settings**, **Audit Trail** |

  The "immutable audit ledger" is editable localStorage seeded with fake entries. Settings (MFA, session timeout, currency, retention) are **read by nothing**.

---

## 6. Backend ↔ Database

- **No schema DDL in the repo.** `db/fix_pericope_erm.sql` is a remediation patch, not a schema. Foreign keys are only implied by `*_UUID` naming.
- **Typos are baked into the schema:** `IS_STAGE_COMPLTED`, `CONTROL_CLASIFICATION`, `per_mst_control_clasification`, `per_mst_risk_compuation_logic`. Both spellings are registered and aliased in the BFF, and the frontend calls the typo names.
- **The audit trigger is not tamper-evident.** Errors are swallowed (`WHEN OTHERS THEN NULL`). The actor is always the ORDS schema user, because the BFF never sets `CLIENT_IDENTIFIER`. The smoke test commits a phantom audit row.
- **The audit column names in the SQL don't match the BFF whitelist**, so the production audit POST sends an empty row.
- **The "non-destructive" DQ-02 step overwrites `RISK_STATEMENT` with no backup.**
- **Indexes and constraints are thin.** CHECKs exist only on one table (`NOVALIDATE`), and there are no indexes on the FK columns (`CONTROL_ID`, `RISK_UUID`, `KRI_UUID`, …).
- **Real data quality** (from `probe_risks.json`): duplicate reference numbers, and `risk_type` / `inherent_sle` null on all 25 rows.
- `deploy.sh` curls ORDS with no token and expects 200. **Check whether ORDS AutoREST is publicly readable without auth.** If it is, the database is open regardless of the BFF.

---

## 7. Frontend page-by-page highlights

**Fake or hardcoded numbers shown as real:**
- **Dashboard:**
  - "Control coverage **2500%**": the control count falls back to a fake `|| 25`, and coverage is computed as controls ÷ risks.
  - The trend chart and the department breakdown are hardcoded.
  - It shows "0 active risks" next to a table of fake demo rows.
- **Reports:** 78.4%, 93, 96.8%, the departmental table and the "last generated" dates are all hardcoded.
- **KRI Matrix:** every value is fixed (65, 50, 80).
- **Heatmap:** the "Residual" and "Trend" views are just likelihood ±1.
- **Asset library:** type, size and date are hardcoded, and every category shows 0.
- Other hardcoded values:
  - Residual = inherent × 0.35 or × 0.25.
  - "75% reduction".
  - "Coverage 100%".
  - "All actions on track", even when items are overdue.

**Broken functionality:**
- **The risk register shows only 10 rows and has no pager** (identification, provisioning, assessments list).
- **Search does nothing** on 6 pages (no filtered row model).
- **About 20 buttons do nothing:**
  - Export (×4) and Snapshot.
  - Filters and Advanced Filters.
  - Import Controls and Finalize Workflow (a fake toast).
  - Add Tolerance, Create/Edit KRI, Ingest Resource and Download.
  - Grid/List and the "eye" view button.
- **Action Plan** reads field names the table doesn't have, so every row says "Unnamed Control / Unassigned / 2026-12-31". The **Actions Hierarchy** can never nest.
- **Workflow maker-checker is broken.** An approver's name gets overwritten by whoever clicks, an admin can approve their own submission, and the approvers are hardcoded.
- **The KRI configuration delete is a real DB delete** with no confirmation, no role check and no audit entry. Its toasts are invisible because the sonner `<Toaster/>` is never mounted.
- **Validation is missing** almost everywhere: negative values, RPO > RTO, acknowledgement > 100%, duplicate user IDs, admins able to demote the last admin.
- Statuses don't follow their dates: BCP, policy and vendor seeds dated before today still say "Current".

**Structure:**
- **RBAC is enforced in the UI on only about 9 of 42 routes.** `/users` and `/settings` open for every role by URL.
- **8 routes render without the navbar/sidebar:** `/assessments/*`, `/monitoring/*` subpages, `/risk-planning/identify` and `/risk-assessments/list`.
- **11 orphan routes** aren't reachable from the navigation. Breadcrumb middle links lead to 404s.
- **Duplicates:**
  - 2 dashboards (`/` with 1,031 lines and `/dashboard`).
  - 3 appetite pages with 3 different data models.
  - 5 views of the monitoring table.
  - 6 different "create risk" forms that each map fields differently.
  - 4 inherent-analytics pages, including a "Residual" page that shows inherent data.
- **Mixed currency:** ₹ on some pages, $ on others.

**Accessibility:**
- Clickable `<div>`s and `<span>`s.
- `opacity-0` hover-only action buttons, invisible to keyboard users.
- Labels without `htmlFor`, and icon buttons without `aria-label`.
- A `<Link>` nested inside a `<button>`.
- Modals with no focus trap or Escape handling.
- Low-contrast emerald and amber text.

---

## 8. Look & feel

- **Mixed visual styles:**
  - Clean slate enterprise on most pages.
  - "Glass card" pages: `.glass-card` is defined only in the *unused* `app/globals.css`, so it renders unstyled.
  - Loud `font-black`, italic, `rounded-[40px]` pages.
- **The design spec isn't implemented.** `.stitch/DESIGN.md` specifies indigo `#4f46e5`, Manrope headings, 12px radius, gradient primary buttons and no-line tables. The code uses blue `#1e40af`, Inter only, 8px radius and bordered tables.
- **Dark mode is unreachable:** `forcedTheme="light"`, the theme toggle isn't used, and colours are hardcoded.
- **Animation and loading classes don't work:** `tw-animate-css` isn't imported, so shadcn animations don't run. `tailwind.config.ts` is ignored under Tailwind v4.
- **No error, not-found or loading screens.** The app is fully client-rendered (a blank page until sessionStorage is read).
- **The sidebar is an overlay that is closed by default.** A desktop app should have a persistent, collapsible sidebar.
- **Unused code:** 43 unused `components/ui/*` files, 7 unused shell components, 2 orphan page components, `lib/hooks.ts` and `lib/database-manager.js`.

---

## 9. Deploy, CI, tests, repo hygiene

- **CI fails.** `.github/workflows/ci.yml` uses Node 18, but Next 16 needs Node 20.9 or later. No lint or tests run.
- **Dockerfile:**
  - No `.dockerignore`, so `.env`, the zips and the PDFs are baked into the image.
  - It installs the full frontend dependency tree for the API.
  - The healthcheck hits `/api/health`, which doesn't exist, so the container is never healthy.
- **docker-compose** mounts `nginx.conf`, `prometheus.yml`, `grafana/` and `ssl/`, none of which exist. `nginx:latest-alpine` is not a valid tag. Grafana's password is `admin`.
- **Hostinger guide:** the "static export" option can't work with `output: 'standalone'` plus dynamic routes, and `deploy.sh` copies a `.env.example` that doesn't exist.
- **Test scripts:** `test-post.mjs` POSTs junk **directly to production ORDS**. `qa_test_suite.mjs` re-implements the functions it claims to test instead of importing them.
- **About 33 MB of committed binaries:**
  - 8 zips, one of them 18 MB and duplicated.
  - 7 PDFs, 2 pptx and research-paper docx/pdf versions.
  - `tsconfig.tsbuildinfo` and `test.pdf`.
  - Seven Python PDF builders sit in the app root.
  - There are 3 near-identical "feature guide" docs and 3 runbooks.
- **`package.json`:**
  - The name is `my-project`.
  - Backend dependencies (express 5, helmet, archiver…) sit in the frontend manifest, while the backend copies use Express 4.
  - The `lint` script calls an ESLint that isn't installed.
- **`.gitignore`** misses `.env`, `*.zip`, `*.tsbuildinfo` and `dist-deploy/`.
- **`.claude/settings.json`** pre-approves a curl to production ORDS and calls that spoof the Administrator role.

---

## 10. Roadmap: what to build, in order

Each phase is a self-contained request you can give me ("Do Phase 1").

### Phase 0: Lock it down (½ day)
- Rotate the Oracle credentials, untrack `.env`, purge it from history, fix `.gitignore` and the zip scripts.
- Check and close anonymous ORDS access.
- Fix `coerceTablePayload`: apply defaults only when a field is missing, and only on create.
- Stop the silent shadow fallback: return real errors, remove `UNAVAILABLE_CACHE` and the permanent `authDisabled`.
- Remove the fabricated-row delete buttons and the inactive-user → admin login fallback.

### Phase 1: Real backend foundation (2–3 days)
- **One backend**: move it to `/api` with its own `package.json`, TypeScript, Express 5 and `zod` validation per table. Delete the other 3 copies and the stale zips.
- **Real authentication:**
  - Email + password (argon2) or SSO (Azure AD / Google / Okta via OIDC).
  - httpOnly session/JWT cookies.
  - The role comes from the token, never from a header; deny by default.
- Per-table allow-list with read-only master tables, a numeric `:id` check, locked-down CORS, helmet, rate limiting and generic error bodies.
- **Server-side audit log** written to `erm_trn_audit_log` with a hash chain (tamper-evident), with the BFF setting `CLIENT_IDENTIFIER` so DB triggers know the real user.
- An OpenAPI/Swagger spec and a typed API client generated from it.

### Phase 2: Make the data real (3–5 days)
- New Oracle tables plus API for the 11 localStorage modules: controls library, KRIs and readings, appetite, workflow, vendors, incidents, BCP, scenarios, policies, users, settings.
- Use the proper tables: `erm_trn_assessment_cycle` for cycles, `per_trn_inherent_risk_assessment`, `per_trn_mitigation_plans` (hierarchy), and add LIKELIHOOD/IMPACT columns.
- Delete `parseRiskRecord`'s invented values and every hardcoded KPI. Compute everything from data, and show honest empty states.
- Server-side pagination, sorting and search. React Query everywhere, with proper invalidation and a single cache.
- A versioned **schema in the repo** (Liquibase or Flyway for Oracle) with FKs, indexes and CHECKs; fix the typo columns through views.

### Phase 3: Make it look the best (3–4 days)
- **A design system:**
  - Finish `.stitch/DESIGN.md`: indigo palette, Manrope + Inter via `next/font`, tokens in one CSS file, working dark mode.
  - Delete the 3 mixed styles and the dead CSS.
- **A new app shell:**
  - A persistent, collapsible sidebar grouped by the lifecycle (Identify → Assess → Treat → Monitor → Report).
  - Working breadcrumbs and a ⌘K command palette.
  - A notifications drawer and a role-aware navigation.
- **Consolidate the duplicate pages:**
  - 1 dashboard, 1 risk register with one create/edit drawer, 1 appetite module, 1 monitoring module with tabs.
  - Remove the orphans or add them to the navigation.
- **A redesigned dashboard:**
  - Real KPIs with sparklines and an interactive 5×5 heatmap (click a cell to filter the register).
  - Inherent vs residual side by side, plus top risks, overdue actions and KRI breaches.
- **Polish:**
  - Skeleton loaders, error boundaries, toasts from a single system, confirm dialogs.
  - Form validation with inline errors, keyboard and screen-reader accessibility (WCAG AA), and responsive / mobile layouts.

### Phase 4: Production engineering (2 days)
- Tests:
  - Vitest unit tests for the scoring and validation logic.
  - Supertest API tests.
  - Playwright end-to-end tests for the core flows: login → create a risk → add a control → approve → report.
- CI on Node 22 with lint, typecheck, test, build and `npm audit`; branch protection.
- A working Dockerfile (multi-stage, separate frontend and API images), a fixed compose file, and a runtime API URL.
- Error tracking (Sentry), structured logs (pino), and `/health` plus `/ready` endpoints.
- Clean up the repo: move the PDFs, decks and the research paper to `docs/` or a release, delete the scripts, and write one good README.

---

## 11. Future enhancements (to make it stand out)

**Core GRC depth**
- **Compliance frameworks module:** map controls to ISO 27001, SOC 2, NIST CSF 2.0, ISO 31000, COSO, DORA, GDPR and RBI/SEBI. Show coverage % per framework and a gap analysis.
- **Control testing workflow:** test plans, sampling, evidence upload (S3 / OCI Object Storage), tester → reviewer sign-off, and auto-computed effectiveness feeding residual risk.
- **A real maker-checker / approval engine:** configurable multi-level approvals, segregation of duties (no self-approval), delegation, SLA timers and escalations.
- **Issues & findings management:** audit findings, owners, due dates, remediation plans and closure verification.
- **Policy lifecycle:** versioned documents, review reminders, employee attestation campaigns with tracking, and exceptions/waivers.
- **Third-party risk portal:** send vendor questionnaires (SIG Lite / CAIQ) by link, auto-score the answers, tier vendors, and track contracts and SOC 2 report expiry.
- **Incident → risk feedback loop:** incidents automatically update the likelihood of linked risks, with loss-event data collection (Basel-style).

**Quantification and insight**
- **FAIR / Monte Carlo risk quantification:** a loss-exceedance curve, P50/P90 annual loss, and a "what-if" on control investment ROI.
- **KRI automation:** scheduled ingestion from APIs, CSV or SQL; threshold breach alerts; trend forecasting.
- **Risk appetite dashboard:** appetite vs actual by category, with automatic breach escalation to the board view.
- **Board-ready reporting:** one-click PDF/PowerPoint packs (risk profile, top 10, heatmap movement, KRI breaches) and scheduled email delivery.

**AI features (Claude API)**
- **AI risk assistant:** draft risk statements, suggest causes, controls and KRIs from a process description, and flag duplicates in the register.
- **Control-to-framework auto-mapping** and **policy gap analysis** from uploaded documents.
- **Natural-language queries:** "show high risks in Finance with no tested controls".
- **Auto-generated executive summaries** for reports, and **evidence review** (check that an uploaded document actually supports a control).

**Platform**
- SSO (SAML/OIDC) with SCIM user provisioning, MFA, and session timeout enforcement.
- Email, Slack and Teams notifications; an in-app inbox; "My tasks" for each user.
- Multi-entity / multi-tenant support with an org hierarchy, multi-currency and i18n.
- Immutable, hash-chained audit trail with export for auditors; data retention policies.
- Public REST API and webhooks for integrations (Jira / ServiceNow for remediation tickets).
- Mobile-friendly approvals (a PWA).

---

## 12. Suggested next request

> "Do Phase 0 and Phase 1."

That fixes everything that is unsafe or loses data, and gives a solid backend to build the redesign on. After that, **Phase 2 + Phase 3** gets you the "best version": real data everywhere and a polished, consistent UI.
