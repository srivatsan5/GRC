# Deploying Pericope (Hostinger / any VPS)

Two parts are deployed separately:

| Part | Folder | Example domain |
|---|---|---|
| API | `api/` | `https://api.datapulsefusion.com` |
| Web app (Next.js) | repo root | `https://datapulsefusion.com` |

> **Never upload a `.env` file inside a zip, and never commit one.** Enter environment variables in
> hPanel (or in a `.env` created directly on the server).

## 1. API

On the server (Node.js 20.9+; 22 recommended):

```bash
cd api
npm ci
npm run build
npm prune --omit=dev
```

Create `api/.env` on the server from `api/.env.example`. Production values:

```
NODE_ENV=production
PORT=5000
CORS_ORIGINS=https://datapulsefusion.com
COOKIE_SECURE=true
COOKIE_DOMAIN=.datapulsefusion.com
JWT_SECRET=<48+ random characters>
DATA_DIR=/home/<user>/pericope-data
ORDS_BASE_URL=https://<adb-host>/ords/<schema>
ORDS_TOKEN_URL=https://<adb-host>/ords/<schema>/oauth/token
ORDS_CLIENT_ID=<new, rotated client id>
ORDS_CLIENT_SECRET=<new, rotated secret>
BOOTSTRAP_ADMIN_EMAIL=you@yourcompany.com
BOOTSTRAP_ADMIN_PASSWORD=<12+ chars, used once>
TRUST_PROXY=1
```

Start it:

- **hPanel Node.js app**: application root `api`, startup file `dist/server.js`.
- **or pm2**: `pm2 start ecosystem.config.cjs && pm2 save`.

After the first start, sign in with the bootstrap admin, then **delete `BOOTSTRAP_ADMIN_PASSWORD`**
from the environment and restart. Back up `DATA_DIR` (users and audit chain) regularly.

Check: `https://api.datapulsefusion.com/health` → `{"status":"ok"}` and `/ready` → `"database":"ok"`.

## 2. Web app

`NEXT_PUBLIC_API_URL` is compiled into the browser bundle, so set it **before building**:

```bash
npm ci
NEXT_PUBLIC_API_URL=https://api.datapulsefusion.com npm run build
```

The build produces a self-contained server in `.next/standalone`. Copy the static files next to it:

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

Upload the contents of `.next/standalone` (on Windows you can zip it with
`tar -a -c -f web.zip -C .next/standalone .`) and set the Node.js app's startup file to `server.js`.

## 3. Security checklist

- [ ] Rotate the Oracle OAuth client secret (the old one was committed to git).
- [ ] Run `cd api && npm run check:ords-anon` — every table must answer **401** without a token.
- [ ] `COOKIE_SECURE=true` and HTTPS on both domains.
- [ ] `CORS_ORIGINS` lists only the web app's URL.
- [ ] Bootstrap password removed from the environment after first sign-in.
