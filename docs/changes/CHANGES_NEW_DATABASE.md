# Moving to a new Autonomous Database

This follows [CHANGES_PHASE_4.md](CHANGES_PHASE_4.md).

**In one line:** the old `PERICOPE_ERM` schema can now be installed on a new, empty Autonomous
Database with one script. The script creates the tables, keys, migrations, demo data in every
table, the REST endpoints and the API's OAuth client.

## ⚠️ What you need to do

Follow [db/install/README.md](../../db/install/README.md):
1. As ADMIN, run `00_create_schema.sql` once, after setting a password in it.
2. Sign in to Database Actions as `PERICOPE_ERM` and run `install_all.sql`.
3. Put the printed OAuth client id and secret in `api/.env`, together with the new database's ORDS URLs.
4. Restart the API.

If you keep using an existing database instead, run migration **V5**.

## What's new

- **`db/install/`** has numbered steps 00–08 and `install_all.sql`, which joins steps 01–08.
- **The tables come from the DDL exported from the old database** (`source/pericope_erm_ddl.tsv`, 211 tables).
  - The schema prefix and storage clauses are removed.
  - Foreign keys are added after all tables exist.
  - Nine scratch/test tables are left out.
- **Demo data in every table:**
  - Hand-written rows for everything the app shows: a fictional multi-department enterprise running an ERP, with 17 risks and their assessments, controls, monitoring actions, plans, cycles and KPIs.
  - Generated rows for the other ~160 tables. They respect each table's types, CHECK rules, unique keys and foreign keys.
- **Fixes so the old tables accept what the app writes.** These are applied by step 04 on a new database and by migration V5 on an existing one:
  - **Monitoring items:** gain their risk link columns, and `ROOT_CAUSE` becomes text. Saving an action plan's root cause used to fail on a number column.
  - **Approval states:** the risk register's approval check allows `IN_REVIEW` and `PENDING`.
  - **Inherent assessments:** gain `CREATED_ON` / `CREATED_BY`, and the API now fills them. The assessment history shows the date and author instead of "—".
  - **Control keys:** applied controls and monitoring items now point at the control library (`ERM_MST_CONTROL`), which is what the app stores there.
  - **Parent keys:** the parent org-unit and parent-plan keys default to "none" instead of 0.
- **Migration V1:** a foreign key that already exists under another name is reported as info, not as a warning.
- **CI** fails if the generated install files are out of date. Rebuild them with `npm run db:install`.

## How it was checked

- The whole install was run on **Oracle Database 23ai Free**, twice:
  - 216 tables, 1,379 rows and 247 enabled foreign keys, with 0 invalid objects and no errors.
  - New rows get fresh ids.
- Migration V5 was run on a schema built the old way, then run again.
- API tests and type checks pass.
- **Not tested here:** the ORDS steps (REST-enabling and the OAuth client), because ORDS only exists on Autonomous Database. If step 08 can't create the client, the README explains how to create it in Database Actions.
