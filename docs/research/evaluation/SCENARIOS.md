# Pre-registered evaluation scenarios

**Registered:** 6 November 2026, **before any scenario was executed.** The git commit that adds this file is the registration record.

**Systems under test:**
- **Baseline (B):** the original system at commit `c371526^` (`52766fa`, 1 November 2026). It was in deployment before this study, and its faults were documented in `docs/AUDIT_REPORT.md` before any redesign.
- **Artifact (E):** ERMA-GRC at the commit that records the results.

**Common setup:**
- Both systems run against the same in-memory Oracle ORDS stand-in (`api/scripts/fake-ords.ts`), seeded with identical rows.
- No real customer data is used.

**Outcome per scenario (decided in advance):**
- **PREVENTED:** the failure mode did not occur.
- **OCCURRED:** it did.
- **N/A:** the scenario cannot be run on that system. The reason is recorded and does not count as a pass.

Evidence (HTTP status, stored row, screen text or screenshot) is captured for every run. Each scenario is run once per system, with no re-runs to change an outcome. If a run fails for an environmental reason, the reason is recorded, the scenario is re-run once, and both runs are reported.

**Analysis (decided in advance):** for each failure mode, count PREVENTED scenarios out of the runnable total for each system. Report every scenario individually. Report scenarios where the artifact fails with the same prominence as those where it succeeds. No statistical test is applied: the outcomes are deterministic, and n is small.

## Scenarios derived from the audited failure modes

| ID | Failure mode | Scenario | PREVENTED when |
|---|---|---|---|
| S1.1 | F1 Fabricated values | A risk is stored with no likelihood or impact. View it in the register and the heatmap. | It is shown as unrated; no numeric score is displayed |
| S1.2 | F1 | A risk is stored with statement "Test statement X" and SLE 123456. View it. | The displayed statement and SLE equal the stored values |
| S1.3 | F1 | A risk is stored with no approval status. View it. | It is not shown as Approved |
| S1.4 | F1 | Fresh installation, before any user action. Open the audit trail. | It contains no entries that no one performed |
| S2.1 | F2 Decisions overwritten | An authorised approver sets `APPROVAL_STATUS=APPROVED` on a submitted risk created by someone else. Re-read the row. | The stored value is APPROVED |
| S2.2 | F2 | Edit an unrelated field (owner) of an approved risk. Re-read the row. | APPROVAL_STATUS is still APPROVED |
| S3.1 | F3 Enforcement | Send a create request with no session or credentials. | Rejected (no row created) |
| S3.2 | F3 | Send a create request with no session and header `X-User-Role: Administrator`. | Rejected (no row created) |
| S3.3 | F3 | A Risk Manager submits a risk and then tries to approve that same risk. | Rejected; status unchanged |
| S3.4 | F3 | A non-administrator (or an unauthenticated client) writes to the user/identity table. | Rejected |
| S4.1 | F4 Evidence trail | Post an audit entry claiming actor "CEO / Administrator" through the API. | Rejected, or not recorded under the claimed actor |
| S4.2 | F4 | Change one character of one stored audit entry, then run the system's integrity verification. | Verification reports the chain as broken |
| S4.3 | F4 | An authenticated user creates a record. | An audit entry exists, naming that authenticated user as actor |
| S5.1 | F5 Silent failure | Stop the database stand-in, then send a create request. | The client receives an error status; no success is reported |
| S5.2 | F5 | The database rejects a payload (HTTP 400 from ORDS). | The client receives an error status, not 200/201 |
| S5.3 | F5 | Delete a record id that does not exist. | Not reported as a successful deletion |
| S6.1 | F6 Fragmented record | Create a control-library entry and an incident through the UI, then clear browser storage and reload. | Both records are still present (stored in the database) |
| S7.1 | F7 Destructive actions on fabricated rows | Open an assessment cycle that has no risks. | No invented risk rows (with delete actions) are displayed |

## Generalisation scenarios (not derived from the audit)

These test whether the principles hold beyond the specific defects that motivated them. **This guards against the bias of testing only for the faults we already knew about.**

| ID | Principle | Scenario | PREVENTED when |
|---|---|---|---|
| G1 | DP3 | Two different authorised approvers decide the same approval step at the same moment (concurrent requests). | Exactly one decision is recorded |
| G2 | DP3 | A user is deactivated by an administrator while holding a valid session, then sends a write request. | Rejected |
| G3 | DP3/DP5 | Request a record with a path-traversal id (`/api/<table>/..%2F..%2Fper_mst_roles`). | Rejected as invalid |
| G4 | DP1/DP7 | Record a KRI reading of 14 on an indicator whose red threshold is 15 and whose direction is "lower is worse". | Status is computed as RED from the rule, not entered by the user |

## Boundary scenario (expected to fail; it documents a known limitation)

| ID | Principle | Scenario | Expected |
|---|---|---|---|
| L1 | DP4 boundary | An insider who holds both the audit HMAC key and write access to the audit file rewrites an entry and recomputes the whole chain. | **OCCURRED** (not detected) on both systems. ERMA-GRC has no external anchoring of chain commitments (cf. Crosby & Wallach, 2009). |

## Supporting evidence (reported separately, not counted as scenarios)

- The artifact's automated API test suite and its three browser end-to-end suites, with pass counts.
- `npm audit --omit=dev` for both systems (high and critical counts).
- The verified database install on Oracle Database 23ai Free (tables, foreign keys, invalid objects).
