# Pericope ERM

Enterprise risk management for the full **RCSA lifecycle**: assessment cycles → risk register →
inherent assessment → controls and mitigation → monitoring. It also covers KRIs, risk appetite,
maker-checker approvals, policies, vendors, incidents, business continuity, scenarios, board reports
and a tamper-evident audit trail.

```
Browser ── Next.js web app (app/, components/, lib/)
   │  httpOnly session cookie + CSRF header
   ▼
Pericope API (api/) ── sign-in, roles, validation, approvals, audit log
   │  OAuth2 client credentials
   ▼
Oracle Autonomous Database via ORDS (schema changes in db/migrations)
```

Every number and list on screen comes from the database through the API. Nothing is invented, and
nothing is kept only in the browser.

## Quick start (no database needed)

Needs Node.js 22.

```bash
npm install && npm --prefix api install

# 1. In-memory stand-in for Oracle ORDS, with sample data (http://localhost:8181)
npm --prefix api run dev:fake-db

# 2. The API (http://localhost:5000), in a second terminal
cp api/.env.example api/.env
#    set JWT_SECRET (32+ chars), BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD, and
#    ORDS_BASE_URL=http://localhost:8181/ords/grc  ORDS_TOKEN_URL=http://localhost:8181/ords/grc/oauth/token
#    ORDS_CLIENT_ID=local  ORDS_CLIENT_SECRET=local
npm --prefix api run dev

# 3. The web app (http://localhost:3000), in a third terminal
cp .env.example .env.local
npm run dev
```

Sign in with the bootstrap administrator, then add colleagues under **Administration → Users**.
The fake database forgets everything when it stops. Point `ORDS_*` at your Autonomous Database to
keep data.

## Run it with Docker

```bash
cp api/.env.example api/.env     # fill in ORDS_*, JWT_SECRET, AUDIT_HMAC_KEY, BOOTSTRAP_ADMIN_*
docker compose up -d --build     # web on :3000, API on :5000
```

The web image reads `API_URL` when it starts, so one image works in every environment. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production (HTTPS, domains, backups, go-live checklist).

## Roles

| Role | Can |
|---|---|
| Administrator | Everything, including users, settings and the audit trail |
| Risk Manager | Create, edit, delete and **approve** (never their own submissions); read the audit trail |
| Assessor | Create and edit risks, assessments, controls and plans, and submit them for approval |
| Auditor | Read everything, including the audit trail |
| Viewer | Read only |

The API enforces these rules. The UI also hides actions a user can't take.

## Project layout

| Path | What |
|---|---|
| `app/` | Next.js routes (App Router). Each page is a thin wrapper around `components/pages/*` |
| `components/` | Screens (`pages/`), the app shell (`shell/`), the Charter design kit (`charter/`, `ui/`) and feature parts |
| `lib/` | API client, data hooks (`data.ts`), risk scoring (`risk.ts`), KRI logic (`kri.ts`), formatting, settings |
| `app/globals.css` | Charter design tokens: colours (light and dark), type scale, risk bands, density |
| `api/` | The API: Express 5, zod validation, JWT sessions, RBAC, workflow engine, audit chain. See [api/README.md](api/README.md) |
| `db/` | Oracle migrations (Flyway naming), seed data and scripts. See [db/README.md](db/README.md) |
| `e2e/` | Browser end-to-end suites and their runner |
| `tests/unit/` | Unit tests for the web app's scoring, KRI and formatting logic |
| `docs/` | Audit report, change logs, deployment, design hand-off, manuals, presentations |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Web app in development mode |
| `npm run build` / `npm start` | Production build (standalone) / serve it |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Web unit tests (vitest) |
| `npm run e2e` | Browser suites (core flow, real data, security), each against a fresh local stack. Build the web app and API first |
| `npm run api:types` | Regenerate `lib/api-types.ts` from `api/openapi.json` |
| `npm --prefix api test` | API tests (supertest + vitest) |
| `npm --prefix api run user:create` | Create a user from the command line |

CI (`.github/workflows/ci.yml`) runs on every push and pull request:
- lint, type checks, unit and API tests
- both builds
- `npm audit` (fails on high or critical)
- all three end-to-end suites
- both Docker image builds

## Configuration

| Where | Variable | Meaning |
|---|---|---|
| Web | `NEXT_PUBLIC_API_URL` | The API's URL, used at build time (default `http://localhost:5000`) |
| Web (Docker) | `API_URL` | The API's URL, read at container start. Overrides the build-time value |
| API | see [`api/.env.example`](api/.env.example) | Database (ORDS OAuth), secrets, cookies, CORS, rate limits, optional `SENTRY_DSN` |

The web app's URL must be listed in the API's `CORS_ORIGINS`.

## Further reading

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): production deployment and go-live checklist
- [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md): the original audit and roadmap
- [docs/changes/](docs/changes/): what changed in each phase (0–4)
- [docs/design/phase3/DESIGN_HANDOFF.md](docs/design/phase3/DESIGN_HANDOFF.md): the Charter design system
- [docs/manuals/](docs/manuals/): demo runbooks and feature guides (written before the Phase 3 redesign, so the screenshots and some labels are out of date)
