# Pericope API

The single backend for Pericope ERM. It sits between the Next.js app and Oracle
Autonomous Database (ORDS REST) and is responsible for **who you are**, **what you
may do**, **what data is valid**, and **recording what happened**.

```
Browser ──(httpOnly session cookie)──▶ Pericope API ──(OAuth2 client credentials)──▶ Oracle ORDS
                                            │
                                            ├── data/users.json   (users, scrypt password hashes)
                                            └── data/audit.jsonl  (hash-chained audit log, mirrored to ERM_TRN_AUDIT_LOG)
```

## Run locally

```bash
cd api
cp .env.example .env        # then fill in JWT_SECRET, ORDS_* and BOOTSTRAP_ADMIN_*
npm install
npm run dev                 # http://localhost:5000
```

The first start creates the administrator from `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`
(only when no users exist). Remove the password from `.env` afterwards. More users can be added
from **Users** in the app, or with:

```bash
npm run user:create -- --email jane@example.com --name "Jane Doe" --role "Risk Manager"
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm run build && npm start` | Compile to `dist/` and run |
| `npm test` | Vitest + Supertest suite (uses an in-memory fake of ORDS; no database needed) |
| `npm run typecheck` | TypeScript strict check |
| `npm run openapi` | Regenerate `openapi.json` (also served live at `/api/openapi.json`) |
| `npm run check:ords-anon` | Checks whether your ORDS endpoints are readable **without** a token |

## Security model

- **Authentication**: email + password (scrypt). Sessions are signed JWTs in an `httpOnly`,
  `SameSite=Lax` cookie. Five wrong passwords lock the account for 15 minutes. Sign-in is rate-limited.
- **Authorisation**: the role comes from the server-side user record, never from request headers.
  Unknown roles get nothing (deny by default).

  | Role | Read | Create / update | Delete | Approve / reject | Audit trail | Users |
  |---|---|---|---|---|---|---|
  | Administrator | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
  | Risk Manager | ✔ | ✔ | ✔ | ✔ | ✔ | |
  | Assessor | ✔ | ✔ | | | | |
  | Auditor | ✔ | | | | ✔ | |
  | Viewer | ✔ | | | | | |

- **Sessions end immediately** on sign-out, password change, role change or deactivation.
- **CSRF**: state-changing requests need `X-Requested-With: XMLHttpRequest` and an allowed `Origin`.
- **CORS** only allows `CORS_ORIGINS`. `helmet` security headers. Global rate limit.
- **Tables**: only the tables in `src/tables/registry.ts` are reachable. Reference (`per_mst_*`) tables are
  read-only; identity tables are admin-only. Each writable table has a typed column allow-list;
  unknown fields are ignored **and reported** in the `X-Ignored-Fields` response header.
- **No fake success**: if Oracle is down or rejects a change, the API says so (503/504/422) and records
  a FAILURE audit entry. There is no in-memory fallback.
- **Audit log**: every sign-in, failed sign-in, data change and user change is appended to
  `data/audit.jsonl`. Each entry contains the SHA-256 of the previous entry, so edits or deletions are
  detected by `GET /api/audit/verify`. Entries are also mirrored to `ERM_TRN_AUDIT_LOG`.

## Deploy

**Docker**

```bash
docker build -t pericope-api ./api
docker run -d --name pericope-api -p 5000:5000 --env-file api/.env -v pericope-data:/data pericope-api
```

**VPS with pm2** (e.g. Hostinger)

```bash
cd api && npm ci && npm run build && npm prune --omit=dev
pm2 start ecosystem.config.cjs && pm2 save
```

Production settings: `NODE_ENV=production`, `COOKIE_SECURE=true`, `CORS_ORIGINS=https://your-app-domain`,
and if the app and API are on sibling subdomains, `COOKIE_DOMAIN=.your-domain.com`.
Back up the `DATA_DIR` folder (users and audit chain). Run a single instance.

## Known limits (next phases)

- Users and the audit chain live in files on the API server (simple and durable, but single-instance).
  Moving them into Oracle tables is planned for Phase 2.
- ORDS AutoREST cannot carry the end user into database sessions (`CLIENT_IDENTIFIER`), so database
  triggers still see the API's schema user. The API's own audit log records the real person.
- `APPROVED_BY` is not written automatically because its Oracle column type is not confirmed; the
  approver is recorded in the audit log.
