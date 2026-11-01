# Database (Oracle Autonomous Database + ORDS)

```
db/
  migrations/   versioned schema changes (Flyway naming: V<n>__<name>.sql) — run in order, once
  seed/         optional demo content for the new modules (demo_data.sql) and its source
  scripts/      one-off, review-first helpers (orphan finder, legacy assessment migration, old fix script)
```

## Migrations

| Version | What it does |
|---|---|
| V1 | `PERICOPE_DDL` helper package (idempotent add-column / index / constraint / REST-enable) |
| V2 | Likelihood & impact (inherent and residual, 1–5) on the risk register; CHECKs; indexes on join columns; foreign keys `ENABLE NOVALIDATE`; KRI owner and direction |
| V3 | Tables for controls, policies, incidents, vendors, BCP, scenarios, risk appetite, approval workflow, settings (+ link tables), REST-enabled with authentication |
| V4 | Correctly spelled read-only views over `…_CLASIFICATION` / `…_COMPUATION_…` |

Every migration is safe to re-run (objects that already exist are skipped and reported).

### Run them

**Flyway** (recommended — it records what has run):

```bash
flyway -url="jdbc:oracle:thin:@<tns_alias>?TNS_ADMIN=/path/to/wallet" \
       -user=<SCHEMA> -password=*** \
       -locations=filesystem:db/migrations \
       -baselineOnMigrate=true -baselineVersion=0 migrate
```

**SQLcl / SQL Developer** (manual): connect as the schema owner and run the files in order:

```sql
@db/migrations/V1__pericope_ddl_helpers.sql
@db/migrations/V2__risk_scoring_and_integrity.sql
@db/migrations/V3__erm_module_tables.sql
@db/migrations/V4__correctly_spelled_views.sql
```

(In SQLcl/SQL Developer run `SET SERVEROUTPUT ON` first to see progress.)

**Check for warnings** — every step is also logged to a table, because Flyway doesn't show `DBMS_OUTPUT`:

```sql
SELECT logged_on, message FROM pericope_migration_log WHERE log_level = 'WARNING' ORDER BY logged_on;
```

Typical warnings: a foreign key skipped because existing rows point at a missing parent (fix those rows
with `db/scripts/find_orphans.sql`, then simply re-run the migration), or a REST endpoint that couldn't be
enabled. Foreign keys are only ever added fully validated, so editing old rows through the API never breaks.

### After migrating

1. Grant the API's OAuth client access to the new REST endpoints (they are created with
   authentication required, like the existing ones).
2. `cd api && npm run check:ords-anon` — every table must answer 401 without a token.
3. Optional: `@db/seed/demo_data.sql` (SQLcl / SQL Developer — it uses `SET DEFINE OFF` because the text contains `&`) to load sample content on a **demo** schema
   (remove later with `DELETE … WHERE CREATED_BY = 'demo-seed'`).
4. Optional: `db/scripts/find_orphans.sql` lists old rows that break the new foreign keys;
   `db/scripts/migrate_legacy_assessments.sql` moves assessment cycles that the old web app
   stored as risk rows into `ERM_TRN_ASSESSMENT_CYCLE` (preview first, nothing is deleted).

If the API is running before V3 is applied, the new modules show "not set up yet" instead of failing.
