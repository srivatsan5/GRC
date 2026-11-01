# Backend

The backend now lives in **[`api/`](api/README.md)**: a single TypeScript service with real sign-in,
role-based permissions, validated writes and a tamper-evident audit log.

The old copies (`server.js`, `backend/`, `production/backend/`, `dist-deploy/backend/`) and the
deployment zips have been removed. See [`api/README.md`](api/README.md) for setup, security model and
deployment, and [`HOSTINGER_DEPLOYMENT_GUIDE.md`](HOSTINGER_DEPLOYMENT_GUIDE.md) for the hosting steps.
