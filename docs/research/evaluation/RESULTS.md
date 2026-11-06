# Results of the pre-registered evaluation

**Registered:** 6 November 2026, 17:48:40 UTC (commit `fe021fe`, file `SCENARIOS.md`).
**Executed:** 6 November 2026, 17:57–18:24 UTC.

**Systems:**
- **Baseline (B):** commit `52766fa`. Its own `server.js` and Next.js build.
- **Artifact (E):** ERMA-GRC at `fe021fe`, with no application code changed during the evaluation. The API ran from source; the web app was its existing production build. No web source has changed since that build.

**Data:**
- Both systems ran against one shared in-memory ORDS stand-in (`harness/stand-in.ts`), seeded with the same demo rows.
- Raw evidence for every run is in `evidence/`: requests, responses, stored rows, screen text and screenshots.
- Machine-readable outcomes are in `results.json`.

## Headline

| Group | Baseline: PREVENTED / runnable | ERMA-GRC: PREVENTED / runnable |
|---|---|---|
| F1 Fabricated values (S1.1–S1.4) | 3 / 4 | 4 / 4 |
| F2 Decisions overwritten (S2.1–S2.2) | 0 / 2 | 2 / 2 |
| F3 Enforcement (S3.1–S3.4) | 0 / 4 | 4 / 4 |
| F4 Evidence trail (S4.1–S4.3) | 1 / 3 | 3 / 3 |
| F5 Silent failure (S5.1–S5.3) | 0 / 3 | 3 / 3 |
| F6 Fragmented record (S6.1) | 0 / 1 | 1 / 1 |
| F7 Destructive actions on fabricated rows (S7.1) | 0 / 1 | 1 / 1 |
| **Audit-derived scenarios (18)** | **4 / 18** | **18 / 18** |
| Generalisation scenarios G1–G4 | 0 / 4 | 3 / 4 |
| Boundary scenario L1 (expected to fail) | 0 / 1 | 0 / 1 |
| **All 23 scenarios** | **4 / 23** | **21 / 23** |

No scenario was N/A: every scenario could be run on both systems.

## Where ERMA-GRC failed

### G4: computed KRI status is not enforced by the server

- **Through the user interface,** a reading of 14 on an indicator with red threshold 15 ("lower is worse") was given RED and a breach flag, both computed from the rule and stored. The form has no status field.
- **Through the API,** an authenticated client can send its own `TRAFFIC_LIGHT: "GREEN"` for the same value of 14. The API stores it.
- So DP7 ("computed, not declared") holds only in the browser. The baseline behaves the same way on both paths (browser rule; API stores a declared value).
- Coding G4 as OCCURRED for both systems uses the stricter of the two path outcomes. This coding rule was decided before the browser run but was **not** part of the registration. Under the lenient coding (user interface only), both systems are PREVENTED. G4 does not separate the two systems under either coding.
- The fix is to compute `TRAFFIC_LIGHT` and `IS_BREACH` on the server. It is not part of the evaluated artifact.

### L1: an insider who holds the audit key can rewrite history (boundary, expected)

Rewriting one entry and re-chaining the file with the HMAC key:

| Condition | Verification result | What it means |
|---|---|---|
| (a) The API process that wrote the log was still running | Detected | It keeps the last chain hash in memory, so the rewrite showed as "entry missing or reordered" |
| (b) Re-chained with the API stopped, then restarted | Not detected (`valid: true`) | No outside record of the chain exists |

- Outcome (b) is the scenario as registered. Restarting the service is within the insider's assumed powers.
- This confirms the documented limit of DP4: without external anchoring of chain commitments (Crosby & Wallach, 2009), the key holder can rewrite the log.
- **The rewrite also changes what segregation of duties enforces.** The rewritten entry was the creation record of a risk; ERMA-GRC reads "who created this" from the audit log. Moving the creation to another person changes who is barred from approving that risk.

## Per-scenario outcomes

| ID | Baseline | ERMA-GRC | Baseline evidence | ERMA-GRC evidence |
|---|---|---|---|---|
| S1.1 | OCCURRED | PREVENTED | Register shows "$30,000 · Moderate" for a risk with no SLE or rating. Detail page shows "1/5 × 4/5 (Score: 4)" and "$40,000". The heatmap places all 43 risks in scored cells. | "Not rated" for inherent and residual; SLE "—". Heatmap: "0 of 37 risks placed · 37 not rated". |
| S1.2 | PREVENTED | PREVENTED | Statement and SLE shown as stored ("Test statement X", "$123,456"). | Same. |
| S1.3 | PREVENTED | PREVENTED | Empty approval status shown as "Draft". | Shown as "Draft". |
| S1.4 | PREVENTED | PREVENTED | Only the actual sign-in is listed. | The bootstrap-admin creation (by System, from configuration) and the sign-in. |
| S2.1 | OCCURRED | PREVENTED | Approver's update answered 200; stored status DRAFT. | Stored status APPROVED. |
| S2.2 | OCCURRED | PREVENTED | Owner edit answered 200; stored status DRAFT. | Stored status still APPROVED. |
| S3.1 | OCCURRED | PREVENTED | 201; row created. | 401; no row. |
| S3.2 | OCCURRED | PREVENTED | 201 with `X-User-Role: Administrator`. | 401; no row. |
| S3.3 | OCCURRED | PREVENTED | Self-approval accepted (200). | 403 "You cannot approve or reject a record you created"; status unchanged. |
| S3.4 | OCCURRED | PREVENTED | User-table writes accepted as Assessor and unauthenticated (201, 201). | 403 / 401 / 405. |
| S4.1 | OCCURRED | PREVENTED | Entry recorded as "CEO / Administrator", action APPROVE. | Unauthenticated: 401. Signed-in: recorded under the session user as "Browser: Risk". Forged APPROVE: 400. |
| S4.2 | OCCURRED | PREVENTED | No verification exists; the altered entry is displayed with no warning. | `valid: false`, broken at entry 3, "entry was modified". |
| S4.3 | PREVENTED | PREVENTED | Entry names the acting persona. | Entry names the signed-in account. |
| S5.1 | OCCURRED | PREVENTED | 201 "shadow" while the database was down (run 2). | 503 (run 2). |
| S5.2 | OCCURRED | PREVENTED | ORDS 400 (ORA-02291) became 201 "shadow". | 422 DB_REJECTED. |
| S5.3 | OCCURRED | PREVENTED | 200 `{"deleted":"987654"}`. | 404. |
| S6.1 | OCCURRED | PREVENTED | Control and incident lost after clearing browser storage; 0 database rows. | Both still present; 2 database rows. |
| S7.1 | OCCURRED | PREVENTED | Two invented risks (scores 16 and 12; $160,000 and $120,000) with two delete buttons. | "No risks in this cycle yet"; no rows. |
| G1 | OCCURRED | PREVENTED | Both concurrent decisions answered 200; stored DRAFT, so neither was kept. | 200 / 409; one decision stored, one decision logged. |
| G2 | OCCURRED | PREVENTED | 201. | 401 after deactivation; no row. |
| G3 | OCCURRED | PREVENTED | 404, after the request reached the database as `GET /ords/per_mst_roles`. | 400 VALIDATION_FAILED; no database request. |
| G4 | OCCURRED | OCCURRED | See above. | See above. |
| L1 | OCCURRED | OCCURRED | No chain, no verification. | Not detected after re-chaining and restart. |

**Notes on four baseline results:**
- **S4.3 (baseline PREVENTED).** The criterion is met, but the actor comes from a header the client chooses (see S4.1), and the entry lives only in server memory.
- **S1.2, S1.3 (baseline PREVENTED).** The displayed statement, SLE and status matched the stored values. In the same views, the likelihood × impact values were invented from the SLE. That is recorded under S1.1, not here.
- **S1.4 (baseline PREVENTED).** This **contradicts** the audit report, which says the baseline's audit trail is "seeded with fake entries". The seeding code exists (`lib/auditLog.ts`, lines 107–119). On a fresh installation it never runs: the component that calls it mounts only after sign-in, and by then the sign-in entry has made the log non-empty. The audit finding describes code, not observed behaviour on this path. The paper should say so.

## Supplementary observations (not counted)

| ID | System | Outcome | Observation |
|---|---|---|---|
| S2.2v | E | OCCURRED | An owner edit by a user **without** approval rights sends an approved risk back to SUBMITTED. This is deliberate (signed-off content cannot change silently), but under the S2.2 criterion it reads as OCCURRED. |
| G1v | E | PREVENTED | The same race on a register record's approval status: 200 / 409, one decision stored. |
| S5.1 | E | (note) | The error status is correct, but the message ("could not authenticate to the database") names the wrong cause. After a restart, the first database contact is the token request. |

## Deviations from the registered protocol

All deviations are reported.

1. **Stand-in.** The registration names `api/scripts/fake-ords.ts`. The runs used `harness/stand-in.ts`, which wraps the same `FakeOrds` class with the same seed rows. It adds:
   - control endpoints to read and insert rows directly (ground truth and identical set-up) and to make the stand-in reject writes (S5.2);
   - a request log;
   - header-name normalisation, so `If-Match` reaches the stand-in as it reaches ORDS.
2. **Harness pilot.**
   - Both scripts were first run on a separate, throwaway copy of the stack (other ports, fresh data) to remove script errors.
   - The API pilot ran once. Its outcomes were identical to the recorded run.
   - The browser pilot needed three iterations to fix selectors. In the process it found the baseline register's search problem described under item 3.
   - Pilot runs are not counted.
3. **Clarifications where the registration was silent.** Each was fixed before the recorded run of that scenario:
   - **S2.2:** the editor is a Risk Manager (an approver). The non-approver variant is reported as S2.2v.
   - **S3.4:** PREVENTED requires that both the non-administrator and the unauthenticated write are rejected.
   - **S4.2 (baseline):** the baseline has no verification function. Its server audit is in memory only, so the tampering targeted its browser audit store, which its audit-trail page displays.
   - **S6.1:** browser storage, session storage **and** cookies were cleared. This is stricter than the registered wording, and both systems then signed in again.
   - **S7.1:** both systems opened the same URL (`/rcsa/provisioning/92001`) over the same stored cycle, which has no risks.
   - **G1:** ERMA-GRC used its server-side approval step. The baseline has none, so the race used its only approval mechanism, the record's approval status. The equivalent race on ERMA-GRC is reported as G1v.
   - **G2 (baseline):** the baseline keeps accounts and their "active" flag only in the browser, so the server cannot know of a deactivation. The write was sent as that user, the way its frontend sends identity.
   - **L1:** run while the API was running (reported as L1a) and after an offline re-chain plus restart (coded).
   - **S1.1–S1.3 (baseline):** the register's search ignores the statement column, because its first row has an empty statement. It shows 10 rows with no pager. The rows were found by ID, and the baseline's per-risk detail page was captured as well.
4. **G4 coding rule:** not registered; see above.
5. **S5.1, environmental failure.**
   - Run 1: stopping the stand-in by port also terminated both APIs, which held connections to it. Both systems were unreachable, and the run is invalid (`evidence/api-outage-run1-environmental-failure.json`).
   - Run 2: both APIs were restarted with the database still down, and the scenario was re-run once (`evidence/api-outage.json`).

## Supporting evidence (not counted as scenarios)

| Check | Result |
|---|---|
| ERMA-GRC API test suite | 94 tests passed (7 files) |
| ERMA-GRC web unit tests | 18 tests passed (3 files) |
| ERMA-GRC browser end-to-end suites | 3 suites, 49 checks passed (core-flow 14, real-data 17, security 18) |
| `npm audit --omit=dev`, baseline | 19 advisories: 2 critical, 8 high, 9 moderate |
| `npm audit --omit=dev`, ERMA-GRC web | 0 |
| `npm audit --omit=dev`, ERMA-GRC API | 4 moderate (`@sentry/node`, `@sentry/bundler-plugins`, `glob`, `minimatch`) |
| Oracle Database 23ai Free install (recorded in `docs/changes/CHANGES_NEW_DATABASE.md`) | 216 tables, 1,379 rows, 247 enabled foreign keys, 0 invalid objects |

## Reproduce

```bash
npx --prefix api tsx docs/research/evaluation/harness/stand-in.ts            # :8181
# baseline: git worktree add ../baseline 52766fa && (cd ../baseline && npm ci && NEXT_PUBLIC_API_URL=http://localhost:5001 npx next build)
# then start: baseline server.js on :5001, baseline web on :3001, ERMA-GRC API on :5000, ERMA-GRC web on :3000
node docs/research/evaluation/harness/ui-s1_4.cjs                            # S1.4 first, on fresh systems
ERMA_DATA_DIR=<api data dir> node docs/research/evaluation/harness/run-api.mjs main
node docs/research/evaluation/harness/ui-scenarios.cjs
ERMA_DATA_DIR=<api data dir> node docs/research/evaluation/harness/run-api.mjs final
# stop the stand-in by its own PID, then:
ERMA_DATA_DIR=<api data dir> node docs/research/evaluation/harness/run-api.mjs outage
# L1: l1-insider.mjs rewrite → stop the API → l1-insider.mjs rechain → start the API → l1-insider.mjs verify
```

The evaluation accounts and passwords in the harness are throwaway values for the local in-memory stack only.
