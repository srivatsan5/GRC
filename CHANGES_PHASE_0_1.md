# Phase 0 + Phase 1: what changed

This follows [AUDIT_REPORT.md](AUDIT_REPORT.md), §10 Phase 0 ("Lock it down") and Phase 1 ("Real backend foundation").

## ⚠️ Actions only you can take

1. **Rotate the Oracle OAuth client secret now.** It was committed to git in `.env` from the very first commit.
   `.env` is no longer tracked, but it is still in the git history. After rotating, the old value is useless.
   (Rewriting history to remove it needs a force-push to the branch; not done without your go-ahead.)
2. **Check whether ORDS answers without a token:** `cd api && npm run check:ords-anon`. If any table says
   `EXPOSED`, follow the printed steps. That check can't run from the sandbox this was built in, because its
   network blocks the Oracle host.
3. Create `api/.env` from `api/.env.example` on each server (the new names are `ORDS_CLIENT_ID` /
   `ORDS_CLIENT_SECRET`; the old `CLIENT_ID` / `CLIENT_SECRET` names still work).

## Phase 0: lock it down

| Problem (from the audit) | Fix |
|---|---|
| `.env` with real Oracle credentials committed | Untracked; `.gitignore` now blocks `.env*`, zips, build output and runtime data; `.env.example` files added |
| Zip scripts packed `.env` into deploy zips | All 9 zip scripts and 8 committed zips (~40 MB) removed; deployment documented instead |
| Approvals / "Complete" reset to `DRAFT` / `N` on every save | Defaults now fill only **missing** fields, and only on create |
| Database errors turned into fake "success" (in-memory shadow store) | Shadow store removed. Failures return 503/504/422 with a readable message and a FAILURE audit entry |
| One 404 disabled a whole table until restart; one token failure switched to anonymous mode forever | Removed; token failures retry after 5 s; anonymous ORDS needs explicit `ORDS_ALLOW_ANONYMOUS=true` (refused in production) |
| Delete buttons on invented rows could delete real records | Invented risks/controls removed from the assessment-details and applied-controls pages; the assessment row itself is no longer listed (and deletable) as its own risk |
| Inactive user's sign-in fell back to the Administrator | Real authentication; inactive accounts are refused |

## Phase 1: one real backend (`api/`)

**One backend.** `server.js`, `backend/`, `production/backend/` and `dist-deploy/` are deleted. The new
`api/` is TypeScript + Express 5 + zod, with its own `package.json`. Backend dependencies were removed from
the web app's `package.json`.

**Authentication**
- Email + password (scrypt hashes, 12+ characters with letters and numbers).
- Signed session in an `httpOnly`, `SameSite=Lax` cookie.
- Lockout after 5 wrong passwords; sign-in rate limit.
- Sessions end immediately on sign-out, password change, role change or deactivation.
- The first administrator is created from `BOOTSTRAP_ADMIN_*` or `npm run user:create`.

**Authorisation**
- The role comes from the server-side account. `X-User-Role` headers are ignored, and there is no default "System" role.
- Deny by default. Only Risk Managers and Administrators can set `APPROVED` / `REJECTED`.
- The web app hides admin-only pages and links, and the API enforces the same rules.

**Data safety**
- Only the tables listed in `api/src/tables/registry.ts` are reachable.
- 11 writable tables, each with a typed column allow-list. Reference tables are read-only; identity tables are admin-only.
- Ids must be numeric, and query parameters are validated.
- Unknown fields are reported (`X-Ignored-Fields`), not silently dropped.
- Real columns that used to be dropped (e.g. `IDENTIFY_RISK_UUID`, which links a risk to its assessment) are now saved.
- Updates read the row, merge, then write, because ORDS AutoREST PUT would blank every column that wasn't sent.

**Transport**
- CORS only allows `CORS_ORIGINS`. CSRF guard on writes.
- `helmet` headers, global rate limit, generic error bodies.
- `/health` and `/ready` no longer reveal the database host.

**Audit**
- Every sign-in, failed sign-in, data change and user change goes to a hash-chained log (`data/audit.jsonl`) and is mirrored to `ERM_TRN_AUDIT_LOG`.
- `GET /api/audit/verify` detects edits or deletions.
- The Audit Trail page reads this log and shows the verification status.
- Browser-only modules send their events to the API, which attributes them to the signed-in user.

**OpenAPI and typed client**
- Generated from the same registry as the validation (`api/openapi.json`, served at `/api/openapi.json`).
- The web app's `lib/api-types.ts` is generated from it, and `lib/apiClient.ts` uses those types. CI fails if either is stale.

**Web app**
- Real sign-in page with no pre-filled admin credentials and no "sign in as anyone" buttons.
- The navbar role switcher is replaced by **Change password**.
- **Users** is now real account management: create, change role, deactivate, reset password.
- Failed loads show an error instead of an empty page.
- A retried POST could create duplicate records; writes are no longer retried.
- The inherent-assessment page loads the right risk.

**Tooling**
- 43 API tests (Vitest + Supertest, with an in-memory fake of ORDS).
- CI on Node 22: API typecheck, tests, build and OpenAPI drift check; web typecheck, generated-types check and build.
- `api/Dockerfile` with a working healthcheck; simplified `docker-compose.yml`.
- `npm run dev:fake-db` runs the app without Oracle.

## Verified

- API: `npm run typecheck` ✔, `npm test` ✔ (43/43), `npm run build` ✔.
- Web: `tsc --noEmit` ✔, `next build` ✔ (42 routes).
- End-to-end in a real browser against the local ORDS stand-in (seeded from the real `probe_risks.json` rows), 17 checks passing:
  - sign-in errors; httpOnly cookie not readable from JavaScript
  - dashboard loads all 25 risks
  - user creation, with weak passwords rejected
  - an approval persists as `APPROVED`
  - audit chain verified
  - sign-out
  - an Assessor is blocked from Users and from approve/delete, and a spoofed role header is rejected
  - a database outage shows an error screen and a toast
- Not verified against the real Oracle database (blocked by the sandbox network).

## Still open (Phase 2+)

- Many pages still show hardcoded or derived numbers (dashboard coverage, report KPIs, heatmap residual/trend, KRI matrix, `parseRiskRecord` defaults), as listed in the audit.
- 11 modules (controls library, KRIs, appetite, workflow, vendors, incidents, BCP, scenarios, policies, settings) still keep data in the browser.
- Users and the audit chain are stored in files on the API server (single instance). Moving them into Oracle is Phase 2.
- `CONTROL_OWNER` is a numeric id in Oracle. The applied-controls form keeps free-text owners in the notes until an owner picker exists.
- The demo manuals (PDF/MD) still describe persona sign-in. A note at the top of each says so; they should be rewritten in Phase 4.
- `.claude/settings.json` still pre-approves some commands that target the old server and the production ORDS host. Review it.
