# Pericope ERM — Comprehensive Master Demo Runbook & Technical Defense Manual

**Project Title:** Pericope ERM: A Resilience-First, Three-Tier Architecture for Full-Lifecycle Enterprise Risk Management  
**Academic Affiliation:** Department of Computer Science & Engineering, Atria Institute of Technology, Bengaluru, India  
**Authors:** Srivatsan B (1AT23CG104), Raja Vishnu (1AT23CG080), Rithvik R (1AT23CG084), Niranthar M Javagal (1AT23CG071)  
**Project Guide:** Prof. Veena S, Assistant Professor, Department of CSE  
**Target Audiences:** Academic Viva Examination Panel & Enterprise Client Evaluators  
**Version:** 3.5 (Detailed Reference Edition)

---

## Table of Contents
1. [Executive Summary & Core Problem Statement](#1-executive-summary--core-problem-statement)
2. [Deep-Dive Architecture & Computer Science Principles](#2-deep-dive-architecture--computer-science-principles)
3. [The Mathematical Risk Engine & Quantification Models](#3-the-mathematical-risk-engine--quantification-models)
4. [Track A: Academic Project Defense (20-Minute Viva Blueprint)](#4-track-a-academic-project-defense-20-minute-viva-blueprint)
5. [Track B: Enterprise Client Sales Demo (15-Minute Business Pitch)](#5-track-b-enterprise-client-sales-demo-15-minute-business-pitch)
6. [Click-by-Click Live Demonstration Walkthrough](#6-click-by-click-live-demonstration-walkthrough)
7. [Comprehensive Viva & Client Q&A Defense Bank (12 Questions)](#7-comprehensive-viva--client-qa-defense-bank-12-questions)
8. [Database Hardening & Troubleshooting Procedures](#8-database-hardening--troubleshooting-procedures)

---

## 1. Executive Summary & Core Problem Statement

### 1.1 The Industry Problem (The "Spreadsheet Trap")
Over 70% of small to mid-sized enterprises (SMEs) manage their corporate risk registers, control matrices, and compliance tracking using **Microsoft Excel workbooks** and email threads. While spreadsheets are familiar and inexpensive, they introduce severe structural failure points:
1. **Lack of a Single Source of Truth:** Multiple conflicting workbook versions circulate across departments (Finance, IT, Operations).
2. **Disconnected Qualitative and Quantitative Risk Views:** When a control is added or tested, the residual position on a 5x5 heatmap is rarely recomputed, causing visual reports to drift out of sync with actual organizational exposure.
3. **Zero Tamper-Evident Auditability:** Spreadsheets have no native concept of maker-checker segregation of duties or immutable event logs, causing organizations to fail regulatory audits under **SOX Section 404**, **ISO 31000**, and **ISO/IEC 27001**.
4. **Prohibitive Cost of Commercial GRC Suites:** Enterprise tools like ServiceNow GRC or RSA Archer cost upwards of $50,000/year and require months of professional-services implementation, putting them out of reach for growing teams.

### 1.2 The Solution: Pericope ERM
**Pericope ERM** provides an institutional-grade, full-lifecycle Governance, Risk, and Compliance platform deployed on a lightweight, three-tier architecture over an **Oracle Autonomous Database** schema. It unifies:
* Risk and Control Self-Assessment (RCSA) lifecycle workflow.
* Dual mathematical scoring ($S = L \times I$ and Single Loss Expectancy $\text{SLE} = S \times \$10,000$).
* FAIR-standard Monte Carlo probabilistic loss simulation.
* Real-time Key Risk Indicator (KRI) telemetry tracking.
* 1-Click Excel/CSV bulk risk register migration.
* Multi-stage Maker-Checker approval chains.
* 1-Click Board Risk Committee Pack export (PDF/Print).

---

## 2. Deep-Dive Architecture & Computer Science Principles

### 2.1 The Three-Tier Resilient System
Pericope ERM is constructed around three decoupled, cooperating tiers rather than a monolithic backend:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: CLIENT PRESENTATION TIER                         │
│  - Framework: Next.js 15 App Router + React 19 + TypeScript                     │
│  - Styling & Design: Restrained Enterprise UI (IBM Carbon & Fluent principles)  │
│  - Data Layer: TanStack Query (5-minute TTL caching & exponential backoff)      │
│  - Offline Engine: Typed LocalStore with cross-tab storage event listeners      │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ HTTPS / JSON (X-User-* Attribution Headers)
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                  TIER 2: BACKEND-FOR-FRONTEND (BFF) API GATEWAY                 │
│  - Framework: Node.js Express Server (server.js)                                │
│  - Boundary Sanitization: Anti-Junk Heuristics (Consonant & Vowel Ratio checks) │
│  - Case Normalization: toOracleCase() conversion & column whitelisting          │
│  - Upstream Bounded Timeout: Strict 8-second circuit breaker                    │
│  - Fault Tolerance: In-Memory Shadow Store fallback (zero UI freezing)          │
│  - Security: Role-Based Access Control (RBAC) permission checking               │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ ORDS REST Gateway (OAuth2 / Token Bearer)
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                      TIER 3: ENTERPRISE DATABASE TIER                           │
│  - Database: Oracle Autonomous Database (ADW) / Cloud Infrastructure           │
│  - Schema: 48 Partitioned Entities (PER_* core RCSA & ERM_* governance)        │
│  - Audit Procedural Layer: Autonomous Transactions (PRAGMA AUTONOMOUS_TRANS)    │
│  - Performance Layer: Composite B-Tree Indexes on UUID, Stage & Timestamp       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 The In-Memory Shadow Store Fallback Pattern
In enterprise environments, upstream database latency or network dropouts can cause client requests to hang indefinitely. Pericope ERM implements a **Shadow Store Fallback Pattern**:
1. When a `POST`, `PUT`, or `GET` request is received by the BFF, an 8-second timer starts.
2. If Oracle ORDS answers normally, the data is transformed (`toOracleCase` on write, `normalizeItems` on read) and returned.
3. If ORDS times out or returns a network error, the BFF catches the exception, writes the record into an **In-Memory Shadow Store**, assigns a synthetic sequential identifier (`nextId()`), records the audit attribution, and returns a valid `201 Created` / `200 OK` response marked with `source: 'shadow'`.
4. **Result:** The user interface never freezes, spinners never spin forever, and users can continue their assessment work without data loss.

### 2.3 Database Hardening & Autonomous Audit Procedures
In Oracle databases, creating triggers on transactional tables to write audit logs often causes severe deadlocks or `ORA-04098: trigger is invalid and failed re-validation`. If an audit table insert fails, Oracle's default behavior rolls back the entire business transaction!

**The Pericope Remediation Fix (`fix_pericope_erm.sql`):**
```sql
CREATE OR REPLACE PROCEDURE ERM_AUDIT_WRITE (
  p_action    IN VARCHAR2,
  p_entity    IN VARCHAR2,
  p_entity_id IN VARCHAR2,
  p_desc      IN VARCHAR2
) AS
  PRAGMA AUTONOMOUS_TRANSACTION;
  v_actor VARCHAR2(200);
BEGIN
  v_actor := NVL(SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER'),
             NVL(SYS_CONTEXT('APEX$SESSION','APP_USER'), USER));
  EXECUTE IMMEDIATE
    'INSERT INTO ERM_TRN_AUDIT_LOG (ACTOR_NAME, ACTION_TYPE, ENTITY_NAME, ENTITY_ID, DESCRIPTION, RESULT, SOURCE_SYSTEM) ' ||
    'VALUES (:1, :2, :3, :4, :5, :6, :7)'
    USING v_actor, p_action, p_entity, p_entity_id, p_desc, 'SUCCESS', 'DB-TRIGGER';
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK; -- Swallowed: Audit failure NEVER aborts the primary business write
END;
/
```
* **Why this matters for your Viva:** `PRAGMA AUTONOMOUS_TRANSACTION` executes the audit insert in an independent transaction thread with its own commit scope. If the audit table has an issue, the exception is caught and rolled back independently, allowing the primary risk creation or update to succeed.

---

## 3. The Mathematical Risk Engine & Quantification Models

### 3.1 Qualitative Composite Score Formula
For qualitative risk evaluation, Likelihood ($L$) and Impact ($I$) are selected from a 5-point ordinal scale:
* **Likelihood Scale ($L \in \{1, 2, 3, 4, 5\}$):** 1 = Rare (<5%), 2 = Unlikely (5–20%), 3 = Possible (20–50%), 4 = Likely (50–80%), 5 = Almost Certain (>80%).
* **Impact Scale ($I \in \{1, 2, 3, 4, 5\}$):** 1 = Insignificant (<$25K), 2 = Minor ($25K–$100K), 3 = Moderate ($100K–$250K), 4 = Major ($250K–$1M), 5 = Severe (>$1M).

The composite risk score ($S$) is calculated as:
$$S = L \times I \qquad S \in [1, 25]$$

#### Severity Band Partitioning:
* **Low Severity (Acceptable):** $1 \le S \le 7$ (Comfortably within risk appetite)
* **Medium Severity (Monitored):** $8 \le S \le 11$ (Monitored via KRI telemetry)
* **High Severity (Elevated):** $12 \le S \le 15$ (Mandatory mitigation & testing)
* **Critical Severity (Unacceptable):** $16 \le S \le 25$ (Immediate Board escalation)

---

### 3.2 Quantitative Single Loss Expectancy (SLE)
To eliminate the disconnect between heatmaps and financial balance sheets, Pericope ERM computes a first-order monetary Single Loss Expectancy directly from the qualitative score:
$$\text{SLE} = S \times \$10{,}000 = (L \times I) \times \$10{,}000 \quad (\text{USD})$$
* *Example:* A risk with Likelihood = 4 (Likely) and Impact = 4 (Major) yields $S = 16$ and an inherent exposure $\text{SLE} = \$160,000$.

---

### 3.3 Multi-Factor Residual Risk Weighting
When internal controls are mapped to a risk scenario, the system calculates an actual **Composite Control Effectiveness Factor ($\eta$)** based on both Design and Operating ratings:
$$\eta = \frac{\text{Design Effectiveness (1–5)} \times \text{Operating Effectiveness (1–5)}}{25} \in [0.04, 1.0]$$

The residual likelihood ($L_{\text{res}}$) and residual impact ($I_{\text{res}}$) are then computed mathematically:
$$L_{\text{res}} = \max\left(1, \; \text{round}\left(L_{\text{inh}} \times (1 - 0.7 \times \eta)\right)\right)$$
$$I_{\text{res}} = \max\left(1, \; \text{round}\left(I_{\text{inh}} \times (1 - 0.5 \times \eta)\right)\right)$$
$$\text{Residual Score } (S_{\text{res}}) = L_{\text{res}} \times I_{\text{res}}$$
$$\text{Residual SLE} = S_{\text{res}} \times \$10{,}000$$
$$\text{Risk Reduction Percentage } = \left(\frac{S_{\text{inh}} - S_{\text{res}}}{S_{\text{inh}}}\right) \times 100\%$$

---

### 3.4 Open FAIR Probabilistic Monte Carlo Simulation Engine
For enterprise risk quantification, Pericope ERM includes a 10,000-iteration Monte Carlo loss distribution simulator:
1. **Loss Event Frequency (LEF):** Modeled as a **Poisson Process** with parameter $\lambda = \left(\frac{L}{5}\right) \times 2.5$ annual events.
2. **Loss Magnitude (LM):** Modeled as a **Lognormal Distribution** using the Box-Muller transform:
   $$Z = \sqrt{-2\ln(U_1)} \cos(2\pi U_2)$$
   $$\text{Magnitude} = \text{SLE} \times \exp(0.4 Z - 0.08)$$
3. **10,000 Iteration Loop:** Simulates 10,000 possible annual operational years to output:
   * **Annualized Loss Expectancy (ALE):** Mean loss across all simulated years.
   * **95% Value at Risk ($\text{VaR}_{95}$):** 95th percentile worst-case loss scenario.
   * **99% Maximum Plausible Loss ($\text{VaR}_{99}$):** Extreme tail-risk exposure.

---

## 4. Track A: Academic Project Defense (20-Minute Viva Blueprint)

### Presentation Structure:
* **Minutes 0–3:** Title, Team Introduction, and Industry Problem (Slide/Screen: Problem Statement).
* **Minutes 3–7:** System Architecture, 3-Tier decoupling, and the In-Memory Shadow Store pattern.
* **Minutes 7–11:** Mathematical Formulations (Dual qualitative/quantitative model, $\eta$ residual weighting, FAIR Monte Carlo algorithms).
* **Minutes 11–15:** Live System Demonstration (RCSA lifecycle, CSV bulk import, 5x5 heatmap, real-time KRI breach simulation, RBAC role switching).
* **Minutes 15–18:** Database Hardening, `PRAGMA AUTONOMOUS_TRANSACTION`, and QA Automated Test Suite verification (12/12 passing).
* **Minutes 18–20:** Examiner Q&A and Viva Defense.

---

## 5. Track B: Enterprise Client Sales Demo (15-Minute Business Pitch)

### Pitch Structure:
* **Minutes 0–2:** Executive Cockpit (`/dashboard`) — Total gross exposure in USD, control coverage rate, and risk velocity.
* **Minutes 2–5:** Zero-Friction Migration (`/rcsa/identification`) — Download CSV template, upload an existing spreadsheet risk register, and preview instant data validation.
* **Minutes 5–8:** Interactive 5x5 Heatmap (`/heatmaps`) — Dynamic coordinate mapping across Inherent, Residual, and Trend views with cell-level inspection.
* **Minutes 8–11:** Continuous KRI Telemetry (`/kri`) — Live threshold breach simulation, showing instant Amber/Red alerts and audit log attribution.
* **Minutes 11–13:** SOX 404 Segregation of Duties — Switch to Auditor persona, showing mutation button suppression and immutable compliance event logs.
* **Minutes 13–15:** Executive Deliverables (`/reports`) — 1-Click export of the Board Risk Committee Pack as a formatted, printable PDF.

---

## 6. Click-by-Click Live Demonstration Walkthrough

### Scene 1: Multi-Mode Authentication (`/login`)
1. Open `http://localhost:3000`.
2. Click **Sign in as Srivatsan B — Administrator** (or log in with `srivatsan@pericope.local` / `Demo123!`).
3. **Examiner / Client Narrative:** *"The system provides role-based identity management supporting credentials, enterprise SSO (Azure AD / Okta), and quick persona switching."*

### Scene 2: Executive Dashboard (`/dashboard`)
1. Arrive on the dashboard.
2. Highlight the 4 metric panels:
   * **Active Risks:** 18
   * **Single Loss Expectancy (SLE):** $1,280k
   * **Control Coverage:** 78%
   * **Assessment Completion:** 67%
3. Show the **Trailing Risk Velocity Chart** modeling 6-month historical trends.
4. Show the **Recent Risk Entries Table** with direct links.

### Scene 3: RCSA Lifecycle & Bulk Spreadsheet Migration
1. Go to **RCSA Hub** $\rightarrow$ **01 Setup** (`/rcsa/provisioning`).
   * Point out the Stepper Bar (`01 Setup` $\rightarrow$ `02 Identify` $\rightarrow$ `03 Mitigation` $\rightarrow$ `04 Monitoring`).
   * Click **Demo starter packs** $\rightarrow$ select **Fintech & Banking Pack** to show instant industry seeding.
2. Click **Next Stage: Identify &rarr;** or navigate to `/rcsa/identification`.
   * Click **CSV Template** $\rightarrow$ downloads formatted template.
   * Click **Import CSV** $\rightarrow$ select sample CSV $\rightarrow$ preview table displays parsed statements, likelihood, impact, and SLE.
   * Click **Import Risks** $\rightarrow$ toast confirms successful bulk import.

### Scene 4: 5×5 Enterprise Risk Heatmap Matrix (`/heatmaps`)
1. Open `/heatmaps`.
2. Show the coordinate axes: **Likelihood (1–5)** vertical, **Impact (1–5)** horizontal.
3. Toggle between **Inherent**, **Residual**, and **Trend** views.
4. Click any active numbered cell $\rightarrow$ modal dialog opens displaying the underlying risk statements.

### Scene 5: Continuous KRI Telemetry Simulation (`/kri`)
1. Open `/kri`.
2. Locate **Unplanned IT Outage Hours** (current value: 7.2 hrs/mo, status: Amber).
3. Click the **Update** icon $\rightarrow$ enter `14.5` $\rightarrow$ click **Update**.
4. **Show:** Status turns **Red (Breach)**, trend line peaks, and an audit event is logged.

### Scene 6: SOX 404 RBAC & Auditor Mode
1. Open user dropdown $\rightarrow$ select **Lin Wei (Auditor)**.
2. **Show:** Amber banner appears: *"Auditor mode (read-only): You have view access to all records, control workpapers, and the audit log."*
3. Visit `/rcsa/identification` or `/control-library` $\rightarrow$ show that Add/Delete buttons are hidden.
4. Open `/audit-trail` $\rightarrow$ show timestamped event log with user names and click **Export CSV**.

### Scene 7: 1-Click Executive Board Risk Report (PDF)
1. Switch back to **Administrator** $\rightarrow$ Open **Reports** (`/reports`).
2. Select **Executive Board Risk Committee Pack** (or click through any of the 8 dynamic reports in the catalog).
3. Click **Print / Save as PDF**.
4. **Show:** Print preview cleanly strips all browser navigation, rendering only the executive report on Page 1!

---

## 7. Comprehensive Viva & Client Q&A Defense Bank

### Q1: What makes your application "resilience-first"?
> **Answer:** *"Most web applications crash or freeze if their database times out. Pericope ERM implements an 8-second circuit breaker in the Node.js BFF (`server.js`). If Oracle ORDS fails or is slow, the BFF serves requests from an in-memory shadow store with synthetic IDs. Furthermore, client-side modules in `lib/localStore.ts` utilize browser localStorage with multi-tab storage listeners, allowing risk managers to continue working even during complete network outages."*

### Q2: Why is Single Loss Expectancy (SLE) better than traditional scoring?
> **Answer:** *"Traditional GRC tools give ordinal scores like '16' or 'Red', which mean nothing to a CFO or Board of Directors. By formulating $\text{SLE} = S \times \$10,000$, we translate qualitative matrix coordinates into a tangible financial baseline ($160,000). This allows leadership to perform cost-benefit analysis on control investments (e.g. spending $20,000 on a control to mitigate $120,000 in risk)."*

### Q3: How do you prevent audit triggers from crashing business transactions?
> **Answer:** *"In `fix_pericope_erm.sql`, we encapsulated the audit writer procedure `ERM_AUDIT_WRITE` inside `PRAGMA AUTONOMOUS_TRANSACTION`. It executes in a detached transaction thread with its own commit/rollback scope. Any audit logging exception is swallowed, ensuring the primary business operation (creating or editing a risk) is never aborted."*

### Q4: How is Role-Based Access Control (RBAC) enforced?
> **Answer:** *"We enforce RBAC at two distinct boundaries: (1) On the client, React components verify `hasPermission()` from the user's active session, hiding unpermitted buttons; (2) On the API gateway (`server.js`), requests pass through permission middleware checking `X-User-Role` headers and returning HTTP 403 Forbidden for unauthorized actions."*

### Q5: How does your Monte Carlo simulation work?
> **Answer:** *"We run 10,000 iterations modeling loss events as a Poisson process ($\lambda$) and loss magnitude as a Lognormal distribution. By aggregating simulated annual losses and sorting them, we compute the 95th percentile Value at Risk ($\text{VaR}_{95}$) and Annualized Loss Expectancy (ALE)."*

### Q6: Can clients migrate their existing Excel risk registers?
> **Answer:** *"Yes. We built a native CSV spreadsheet parser in `/rcsa/identification`. Users can download our pre-formatted CSV template, paste their existing spreadsheet data, and upload it with instant multi-row preview and validation."*

### Q7: What testing and verification did you perform?
> **Answer:** *"We built an automated test runner (`qa_test_suite.mjs`) containing 12 unit and integration tests covering composite scoring bounds, Single Loss Expectancy, multi-factor residual calculations, FAIR Monte Carlo math, anti-junk keyboard mash heuristics, ORDS response normalizers, and local storage CRUD operations."*

### Q8: How does your system handle input validation and malicious input?
> **Answer:** *"The API gateway applies regex-based anti-junk heuristics (`CONSONANT_RUN` and vowel ratio analysis) to reject keyboard-mash gibberish while permitting valid uppercase acronyms (e.g. `GDPR_SOC2`). All database writes are coerced and whitelisted against approved table schemas."*

### Q9: What happens when records are imported with manual IDs in Oracle?
> **Answer:** *"Manual imports cause Oracle primary-key sequences to fall behind `MAX(UUID)`, resulting in `ORA-00001` unique constraint violations on future inserts. Our script (`fix_pericope_erm.sql`, Step 6B) automatically advances sequences to `MAX(UUID) + 1` to guarantee unique IDs."*

### Q10: How do you support multi-framework compliance?
> **Answer:** *"Our Control Library maps controls across multiple regulatory frameworks simultaneously (e.g. ISO 27001, SOX Section 404, GDPR, and NIST SP 800-53), allowing organizations to test a control once and prove compliance across multiple standards."*

### Q11: What is the tech stack used?
> **Answer:** *"Next.js 15 App Router, React 19, Tailwind CSS, TanStack Query, Node.js Express, Oracle Autonomous Database, and Oracle REST Data Services (ORDS)."*

### Q12: How are reports generated for Board meetings?
> **Answer:** *"Under `/reports`, we offer 8 dedicated report templates (Board Pack, RCSA Summary, SOX Workpapers, Audit Trail, KRI Register, Residual Report, ISO 27001 Pack, and TPRM Review). When 'Print / Save as PDF' is clicked, our print stylesheet strips all browser UI and formats a clean executive deliverable."*

---

## 8. Database Hardening & Troubleshooting Procedures

### If Upstream Database Times Out:
* Check `http://localhost:5000/health`.
* The server will report `source: 'shadow'` and continue serving data seamlessly.

### If Oracle Trigger Fails:
* Open Oracle APEX SQL Workshop and execute `db/fix_pericope_erm.sql`.

### To Run the Verification Suite:
```bash
node qa_test_suite.mjs
```
