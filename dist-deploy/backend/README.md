# Pericope ERM Backend — Hostinger Deployment (api.datapulsefusion.com)

## Files in this zip

- `server.js` — Express server (Oracle ORDS proxy + shadow + audit)
- `package.json` — production dependencies only
- `.env` — Oracle ORDS URL and PORT
- `README.md` — this file

## Deploy steps on Hostinger

1. Open **hPanel → Websites → api.datapulsefusion.com → Node.js**.
2. Upload this zip and **Extract**.
3. Set the Node.js app:
   - Application root: the extracted folder
   - Startup file: `server.js`
   - Node version: `18.x` or higher
4. Click **Run NPM Install** (or SSH: `npm install --omit=dev`).
5. Click **Start App** (or `npm start`).

## Verify

```
curl https://api.datapulsefusion.com/health
```

Should return JSON: `{"status":"OK","upstream":"https://ga8231f10084da5-...","timeoutMs":8000,...}`

## Environment variables

| Var | Default | Notes |
|-----|---------|-------|
| `PORT` | `5000` | Hostinger usually overrides this — that's fine |
| `ORDS_BASE_URL` | Production Oracle ORDS URL | Already set in `.env` |
| `UPSTREAM_TIMEOUT_MS` | `8000` | Oracle request timeout |

## Endpoints

- `GET /health` — health check
- `GET /api/<table>` — list (auto-paginated, returns up to 10000 rows)
- `GET /api/<table>/:id` — read one
- `POST /api/<table>` — create (with junk-input validation + NOT-NULL defaults)
- `PUT /api/<table>/:id` — update
- `DELETE /api/<table>/:id` — delete
- `GET /api/erm_trn_audit_log` — server audit log

Registered tables: `per_trn_identify_risk`, `per_trn_risk_monitoring`, `per_trn_control_implementation`, `per_mst_business_process`, `per_mst_control_type`, `per_mst_risk_category`, `per_trn_inherent_risk_assessment`, `per_trn_mitigation_plans`, `erm_mst_kri_definition`, `erm_trn_kri_readings`, `erm_trn_assessment_cycle`, `erm_mst_kpi_definition`, `erm_trn_kpi_actuals`.

## User attribution

Every write should include these HTTP headers from the frontend:

- `X-User-Id`
- `X-User-Name`
- `X-User-Role`

These flow into the server audit log and the Oracle audit trigger.
