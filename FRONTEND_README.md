# Pericope ERM — Web app (Next.js)

## Run locally

```bash
# 1. API (see api/README.md)
cd api && cp .env.example .env   # fill in JWT_SECRET, ORDS_*, BOOTSTRAP_ADMIN_*
npm install && npm run dev       # http://localhost:5000

# 2. Web app, in another terminal at the repo root
cp .env.example .env.local       # NEXT_PUBLIC_API_URL=http://localhost:5000
npm install && npm run dev       # http://localhost:3000
```

Sign in with the bootstrap administrator from `api/.env`, then add other users under **Users**.

**No database access?** Run `cd api && npm run dev:fake-db` for an in-memory stand-in for Oracle ORDS
(seeded from `probe_risks.json`) and point `ORDS_BASE_URL` / `ORDS_TOKEN_URL` at `http://localhost:8181/ords/grc`
(any client id/secret). Nothing is saved when it stops.

## Environment

| Variable | Where | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `.env.local` or build environment | URL of the Pericope API. **Compiled into the bundle at build time**: rebuild after changing it. |

The app's URL must be listed in the API's `CORS_ORIGINS`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build (standalone output) / serve it |
| `npm run typecheck` | TypeScript check |
| `npm run api:types` | Regenerate `lib/api-types.ts` from `api/openapi.json` |

## How the app talks to the API

- `lib/apiClient.ts`: shared axios client (session cookie + `X-Requested-With`), typed calls for
  auth, users and audit, and `apiErrorMessage()` for readable errors.
- `lib/oracleService.ts`: table data for the risk / control / monitoring modules. Failures throw and are
  shown to the user; nothing is silently replaced with empty data.
- `components/providers/auth-provider.tsx`: session state; any 401 returns to the sign-in screen.

Deployment: see [HOSTINGER_DEPLOYMENT_GUIDE.md](HOSTINGER_DEPLOYMENT_GUIDE.md).
