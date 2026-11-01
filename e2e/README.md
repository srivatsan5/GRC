# End-to-end checks (browser)

Two Playwright scripts that drive the real app in Chromium against a running stack.
They use the in-memory ORDS stand-in, so they need no Oracle access.

| Script | Checks |
|---|---|
| `security.cjs` | Sign-in, httpOnly session, role restrictions, spoofed headers, audit chain, DB-outage handling |
| `real-data.cjs` | Every page renders from database data, redirects, settings/currency, rating → heatmap, KRI readings, maker-checker approvals, viewer read-only, live notifications |

## Run

```bash
# 1. stand-in database (port 8181)
cd api && npm run dev:fake-db &
# 2. API on :5000 against it (fresh data dir; bootstrap admin from api/.env)
DATA_DIR=/tmp/pericope-e2e ORDS_BASE_URL=http://localhost:8181/ords/grc \
  ORDS_TOKEN_URL=http://localhost:8181/ords/grc/oauth/token ORDS_CLIENT_ID=local ORDS_CLIENT_SECRET=local \
  CORS_ORIGINS=http://localhost:3000 npm run dev &
# 3. web app on :3000
cd .. && NEXT_PUBLIC_API_URL=http://localhost:5000 npm run build && npx next start -p 3000 &
# 4. checks (expects BOOTSTRAP_ADMIN_EMAIL=admin@pericope.local / BOOTSTRAP_ADMIN_PASSWORD=Local-dev-admin-2026)
mkdir -p e2e/screenshots
node e2e/real-data.cjs
node e2e/security.cjs   # last: it stops the stand-in database to test the outage message
```

These are scripts, not yet a Playwright test suite; turning them into `@playwright/test` specs in CI is part of Phase 4.
