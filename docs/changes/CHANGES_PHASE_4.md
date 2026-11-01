# Phase 4: Production engineering

This follows [CHANGES_PHASE_3.md](CHANGES_PHASE_3.md) and completes the roadmap in [../AUDIT_REPORT.md](../AUDIT_REPORT.md) §10.

**In one line:** Pericope now ships as two Docker images, is checked end to end on every push,
logs in a form you can search, and has no known high-severity vulnerabilities.

## ⚠️ What you need to do

1. **Redeploy both the web app and the API.** There are no database changes in this phase.
2. **If you deploy with Docker**, follow [../DEPLOYMENT.md](../DEPLOYMENT.md).
3. **If you deploy on a VPS**, follow [../deployment/hostinger-vps.md](../deployment/hostinger-vps.md). It now lists `AUDIT_HMAC_KEY`.
4. Work through the **go-live checklist** at the end of [../DEPLOYMENT.md](../DEPLOYMENT.md). Two items only you can do:
   - rotate the Oracle OAuth secret
   - turn on branch protection

## Security updates

| Package | Change | Why |
|---|---|---|
| `next` | 16.3 → 16.4.3 | Critical advisory (cache leak across `use cache` parameters) |
| `axios` / `follow-redirects` | patched | Credential headers could follow cross-origin redirects |
| `zod` (API) | 3 → 4 | Memory exhaustion on oversized inputs. Validation messages are unchanged |
| `zod`, `react-hook-form`, `@hookform/resolvers` (web) | removed | Not used by the web app |

`npm audit --omit=dev` reports **0** high or critical issues for both packages. CI fails if one appears.
Two moderate advisories come with the Sentry SDK (glob and minimatch). They are only used with fixed patterns at start-up.

The production build now type-checks. It used to skip type errors (`ignoreBuildErrors`).

## Deployment

- **Web image** (root `Dockerfile`):
  - Built from Next.js standalone output.
  - Runs as the `node` user and has a health check.
- **Runtime API URL:** the web container writes `public/runtime-config.js` from `API_URL` when it starts.
  - One image now works for every environment.
  - `NEXT_PUBLIC_API_URL` still works for builds without Docker.
- **`docker-compose.yml`** runs the web app and the API together. The web app waits until the API is healthy.
- Both images use Docker's init (`init: true`) instead of installing `dumb-init`.
- **[docs/DEPLOYMENT.md](../DEPLOYMENT.md):**
  - database preparation, configuration, Compose, HTTPS with Caddy, operations, and a go-live checklist
- **Verified:** both images were built and run locally against the ORDS stand-in, and the real-data
  and security suites passed against the containers.

## Observability

- **Structured logs.** All API output is JSON, one object per line, with `level`, `msg` and context.
- **Request IDs.** Every request gets an `X-Request-Id`. A valid ID from the proxy is kept.
  - It appears in the request log line and in error logs.
  - It is returned in 500 responses, so a user's "Something went wrong" can be traced to the exact failure.
- **Sentry (optional).** Set `SENTRY_DSN` to report server errors.
  - Errors only: no tracing, no request bodies, no cookies.
  - The SDK is not loaded when no DSN is set.
- Unhandled promise rejections are logged, and error reports are flushed on shutdown.
- `/health` (process up) and `/ready` (database reachable) already existed and are used by the image health checks.

## Tests and CI

| Suite | What it covers | Count |
|---|---|---|
| `npm --prefix api test` | API: auth, roles, validation, paging, workflow, settings, audit chain, request IDs | 94 tests |
| `npm test` | Web: risk scoring and bands, `toRisk` mapping, heatmap cells, KRI lights and threshold rules, formatting | 18 tests |
| `npm run e2e -- core-flow` | **New.** The core journey in a real browser (details below) | 14 checks |
| `npm run e2e -- real-data` | All 31 routes on real data, settings, cycles, KRIs, maker-checker, read-only viewer, notification bell | 19 checks |
| `npm run e2e -- security` | Sessions, password rules, persisted approvals, audit chain, role limits, database outage shown to the user | 18 checks |

The core journey is:
1. An assessor adds a risk, rates it (4 × 5 = Critical) and applies a library control.
2. The assessor submits it, and can't approve it.
3. A risk manager approves it.
4. The risk then appears in the board report and the audit trail.

`npm run e2e` starts a fresh local stack for each suite: the ORDS stand-in, the API and the production web build.
Each suite therefore starts from a clean database.

CI now runs:
- **ESLint** (Next core-web-vitals + TypeScript, 0 errors)
- type checks, unit and API tests, and both builds
- the **audit**
- the **three end-to-end suites**
- **both Docker image builds**

## Bugs found and fixed along the way

- **Hook order.** Two pages called a React hook after an early return. Viewing a missing cycle,
  then a real one, could crash the page. ESLint found these.
- **Audit search.** Searching the audit trail for a record ID found nothing, so "View in audit trail"
  showed an empty list. The core-flow test found this. Search now covers every field of an entry.
- **Logged paths.** API request logs showed paths relative to their router (`/`) instead of the full path.

## Repository tidy-up

- **One [README.md](../../README.md)** replaces `FRONTEND_README.md` and `BACKEND_README.md`.
- **Moved into `docs/`:**
  - the audit report, change logs and deployment guide
  - the manuals and their PDFs (marked as written before the redesign)
  - the presentations and the research paper
- **Deleted:** the one-off PDF and colour scripts, `test.pdf`, and an unused Tailwind v3 config.
- **Sample data:** the sample risk data for the ORDS stand-in moved to `api/scripts/fixtures/`, without
  the links that contained the database hostname.

## Still open

- **Inherent assessment history** shows "—" for date and author. The API doesn't stamp
  `PER_TRN_INHERENT_RISK_ASSESSMENT` rows, and that table's columns aren't defined in this repo.
  To fix:
  1. Confirm whether `CREATED_ON` / `CREATED_BY` exist in Oracle, and add them with a migration if not.
  2. Add `serverColumns` for the table in `api/src/tables/registry.ts`.
- **Lint warnings:** 44 React Compiler advisories remain, mostly "setState inside an effect" used to
  reset paging when filters change. They are reported as warnings and are safe to tidy up over time.
- **Feature ideas** for after go-live are in [../AUDIT_REPORT.md](../AUDIT_REPORT.md) §11: frameworks
  mapping, evidence uploads, FAIR quantification, AI assistance, SSO and notifications.
