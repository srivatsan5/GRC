# Pericope ERM Frontend — Hostinger Deployment (datapulsefusion.com)

This is a **Next.js 15 standalone build** — everything needed to run in production is included. No `npm install` required.

## Files in this zip

- `server.js` — Next.js standalone server (entry point)
- `package.json`
- `.next/` — built application (includes `static/`)
- `node_modules/` — only the runtime deps Next.js needs (already minimized)
- `public/` — static assets
- `.env` — PORT and NEXT_PUBLIC_API_URL

## Deploy steps on Hostinger

1. Open **hPanel → Websites → datapulsefusion.com → Node.js**.
2. Upload this zip and **Extract**.
3. Set the Node.js app:
   - Application root: the extracted folder
   - Startup file: `server.js`
   - Node version: `18.x` or higher
4. **Skip `npm install`** — the standalone build already contains all required `node_modules`.
5. Click **Start App** (or `node server.js`).

## Verify

After starting, visit https://datapulsefusion.com — the app should load, and any data fetched should go to `https://api.datapulsefusion.com` (already baked in at build time).

## Environment variables

| Var | Default | Notes |
|-----|---------|-------|
| `PORT` | `3000` | Hostinger usually overrides this — that's fine |
| `NEXT_PUBLIC_API_URL` | `https://api.datapulsefusion.com` | Already baked in at build time |

## Notes

- The backend (`api.datapulsefusion.com`) must be running and reachable from the browser for data to load.
- CORS is enabled on the backend (`cors()` middleware), so cross-origin requests from `datapulsefusion.com` will work.
