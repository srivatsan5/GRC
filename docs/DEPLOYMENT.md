# Deploying Pericope

There are two parts to run: the **web app** (repo root) and the **API** (`api/`). Data lives in
your **Oracle Autonomous Database**, reached through ORDS.

- **Docker (recommended):** below.
- **A plain Node.js host or VPS (Hostinger hPanel, pm2):** see [deployment/hostinger-vps.md](deployment/hostinger-vps.md).

## 1. Prepare the database (once)

1. Run the migrations in `db/migrations` in order, as the schema owner. See [db/README.md](../db/README.md).
2. Give the API's ORDS OAuth client access to the REST endpoints.
3. Check that nothing is readable without a token:

   ```bash
   cd api && npm run check:ords-anon
   ```

   Every table must answer **401**.

## 2. Configure

Create `api/.env` from [`api/.env.example`](../api/.env.example). At minimum:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 48+ random characters (`openssl rand -hex 32`) |
| `AUDIT_HMAC_KEY` | 32+ random characters. **Set it once and never change it**, or older audit entries stop verifying |
| `ORDS_BASE_URL`, `ORDS_TOKEN_URL`, `ORDS_CLIENT_ID`, `ORDS_CLIENT_SECRET` | Your Autonomous Database's ORDS endpoint and OAuth client |
| `COOKIE_SECURE` | `true` (required in production) |
| `COOKIE_DOMAIN` | The shared parent domain, e.g. `.example.com`, when web and API are on sibling hostnames |
| `TRUST_PROXY` | `1` behind one reverse proxy |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | The first administrator. Remove the password after the first sign-in |
| `SENTRY_DSN` | Optional: report server errors to Sentry |

`CORS_ORIGINS` is set from `WEB_URL` in `docker-compose.yml`.

## 3. Run with Docker Compose

```bash
WEB_URL=https://erm.example.com API_URL=https://api.example.com docker compose up -d --build
```

- **`api`** (port 5000) keeps users and the audit chain in the `pericope-data` volume.
- **`web`** (port 3000) serves the app. `API_URL` is the address the *browser* uses to reach the API.
  It is read when the container starts, so you can move the API without rebuilding.

Both images run as the unprivileged `node` user and have health checks. Compose starts the web app
once the API is healthy.

### HTTPS in front

Put a reverse proxy in front of both containers. With [Caddy](https://caddyserver.com), certificates
are automatic:

```
erm.example.com {
  reverse_proxy localhost:3000
}
api.example.com {
  reverse_proxy localhost:5000
}
```

nginx, Traefik or a cloud load balancer work just as well. Forward `X-Forwarded-For` and `X-Request-Id`.

## 4. Check it

```bash
curl https://api.example.com/health   # {"status":"ok"}
curl https://api.example.com/ready    # {"status":"ready","database":"ok"}
```

Then sign in at `https://erm.example.com`. Next:
- remove `BOOTSTRAP_ADMIN_PASSWORD` from `api/.env`
- `docker compose up -d` to restart
- add your colleagues under **Users**

## 5. Operate

- **Logs:** both services write to stdout and stderr. The API writes one JSON object per line with
  `level`, `msg` and `requestId`, so you can ship them to any log platform and alert on `level=error`.
  A user who sees "Something went wrong" can be matched to the exact failure through the
  `X-Request-Id` response header.
- **Errors:** set `SENTRY_DSN` to receive server errors in Sentry. Only errors are sent: no tracing,
  request bodies or cookies.
- **Back up** the `pericope-data` volume (users, password hashes, the audit chain). The audit log
  is also mirrored to `ERM_TRN_AUDIT_LOG` in Oracle.
- **Audit integrity:** **Administration → Audit trail** re-verifies the hash chain on load.
  `GET /api/audit/verify` does the same for monitoring.
- **Upgrades:**
  - `git pull && docker compose up -d --build`
  - Run any new `db/migrations` first.
  - Read the latest file in [changes/](changes/).

## Go-live checklist

- [ ] Oracle OAuth client secret rotated. The old one was committed to git before Phase 0.
- [ ] Migrations V1–V4 run; `npm run check:ords-anon` shows 401 for every table.
- [ ] `JWT_SECRET` and `AUDIT_HMAC_KEY` are long, random and stored in a password manager.
- [ ] HTTPS on both hostnames; `COOKIE_SECURE=true`; `CORS_ORIGINS` lists only the web app.
- [ ] Bootstrap password removed after the first sign-in; real users created with the right roles.
- [ ] `pericope-data` volume is backed up.
- [ ] Optional: `SENTRY_DSN` set, and logs shipped somewhere you will see them.
- [ ] Branch protection on `main` requires the CI checks (API, web app, end-to-end, Docker).
