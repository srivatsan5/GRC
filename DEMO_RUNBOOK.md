> **Note (Phase 0/1 security update):** sign-in now uses real accounts with passwords managed under **Users**; the one-click persona buttons and the role switcher described below have been removed, and the backend now lives in `api/`. See `FRONTEND_README.md` and `api/README.md`.

# Pericope ERM — Master Demo Runbook & Presentation Guide
**Project:** Pericope Enterprise Risk Management & GRC Suite  
**Major Project Authors:** Srivatsan B (1AT23CG104), Raja Vishnu (1AT23CG080), Rithvik R (1AT23CG084), Niranthar M Javagal (1AT23CG071)  
**Academic Guide:** Prof. Veena S, Department of Computer Science & Engineering, Atria Institute of Technology  
**Version:** 3.2 (Production & Defense Edition)  

---

## Table of Contents
1. [Executive Summary & Product Positioning](#1-executive-summary--product-positioning)
2. [Pre-Demo Technical Checklist (5-Minute Setup)](#2-pre-demo-technical-checklist-5-minute-setup)
3. [Track A: Academic Major Project Defense (20 Minutes)](#3-track-a-academic-major-project-defense-20-minutes)
4. [Track B: Enterprise Client Sales Demo (15 Minutes)](#4-track-b-enterprise-client-sales-demo-15-minutes)
5. [Click-by-Click Live Demonstration Script](#5-click-by-click-live-demonstration-script)
6. [Anticipated Viva & Client Questions with Model Answers](#6-anticipated-viva--client-questions-with-model-answers)
7. [System Architecture & Quantitative Formula Cheat-Sheet](#7-system-architecture--quantitative-formula-cheat-sheet)

---

## 1. Executive Summary & Product Positioning

### For Academic Evaluators:
> *"Pericope ERM is a three-tier, resilience-first web application designed for full-lifecycle Enterprise Risk Management (ERM). It digitizes risk identification, qualitative/quantitative scoring, control mitigation, KRI telemetry monitoring, maker-checker approval workflows, and immutable audit logging over an Oracle Autonomous Database via Oracle REST Data Services (ORDS). The core research contribution lies in its dual mathematical risk model ($S = L \times I$ and Single Loss Expectancy $\text{SLE} = S \times \$10,000$), an offline-tolerant in-memory shadow store fallback architecture, and a database hardening layer that prevents transaction-aborting audit trigger failures."*

### For Enterprise Clients:
> *"Most mid-sized organizations manage critical risk registers out of disconnected Excel spreadsheets and email chains. This creates compliance blindspots, untracked residual risk, and failed SOX/ISO audits. Pericope ERM automates the entire Risk and Control Self-Assessment (RCSA) workflow, allows 1-click migration of your existing Excel risk registers, gives real-time telemetry alerts on operational threshold breaches, and exports board-ready risk packs in 1 click."*

---

## 2. Pre-Demo Technical Checklist (5-Minute Setup)

### Step 1: Start Backend BFF Server
Open Terminal 1 and run:
```bash
node server.js
```
* **Verify Output:**
  ```
  Pericope ERM BFF API running on http://localhost:5000
  Upstream ORDS Base: https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc (timeout 8000ms)
  Registered 48 endpoints with full shadow fallback.
  ```

### Step 2: Start Frontend Application
Open Terminal 2 and run:
```bash
npm run dev
```
* **Open in Browser:** `http://localhost:3000`

### Step 3: Run Automated QA Test Suite (Proof of Verification)
Open Terminal 3 and run:
```bash
node qa_test_suite.mjs
```
* **Verify 12/12 Tests Passing:** Validates mathematical scoring bounds, FAIR Monte Carlo algorithms, anti-junk sanitizers, response normalizers, and local storage CRUD stores.

---

## 3. Track A: Academic Major Project Defense (20 Minutes)

| Timeline | Phase & Screen | Key Technical Points to Explain |
| :--- | :--- | :--- |
| **0:00 - 3:00** | **1. Problem Statement & Motivation** | • Spreadsheets lack segregation of duties, audit trails, and automated residual calculations.<br>• Commercial tools (ServiceNow, RSA Archer) cost $50k+/year and take months to deploy.<br>• Pericope ERM bridges this gap with a single-schema, three-tier cloud-native design. |
| **3:00 - 7:00** | **2. 3-Tier Resilient Architecture** | • **Tier 1 (Client):** Next.js 15 App Router + TanStack Query caching + LocalStore offline engine.<br>• **Tier 2 (BFF API):** Node.js Express proxy with 8s bounded timeout, keyboard-mash sanitization, and in-memory shadow store fallback.<br>• **Tier 3 (Database):** Oracle Autonomous Database (ADW) exposed through ORDS REST endpoints. |
| **7:00 - 11:00** | **3. Mathematical Scoring Engine** | • **Qualitative Model:** $S = L \times I \in [1, 25]$ mapped to 4 severity bands.<br>• **Quantitative Exposure:** $\text{SLE} = S \times \$10,000$ (Single Loss Expectancy in USD).<br>• **Multi-Factor Residual Formula:** $\eta = \frac{\text{Design (1-5)} \times \text{Operating (1-5)}}{25}$, calculating actual risk reduction.<br>• **FAIR Monte Carlo Simulation:** 10,000 iterations computing Annualized Loss Expectancy (ALE) and 95% Value at Risk (VaR). |
| **11:00 - 15:00** | **4. Database Hardening & Remediation** | • Show `db/fix_pericope_erm.sql`.<br>• Explain how ORA-04098 invalid trigger was resolved using **autonomous transactions (`PRAGMA AUTONOMOUS_TRANSACTION`)** so audit logging never aborts business DML.<br>• Explain sequence auto-resync (`STEP 6B`) preventing ORA-00001 PK collision. |
| **15:00 - 18:00** | **5. RBAC & SOX 404 Auditability** | • Show `X-User-*` header attribution.<br>• Demonstrate live role switching: **Auditor (`Lin Wei`)** gets read-only view with immutable audit log; **Manager (`Priya Sharma`)** has approval authority. |
| **18:00 - 20:00** | **6. Conclusion & Viva Q&A** | • Summarize research paper findings, performance benchmarks, and answer panel questions. |

---

## 4. Track B: Enterprise Client Sales Demo (15 Minutes)

| Timeline | Phase & Screen | Client Value Proposition |
| :--- | :--- | :--- |
| **0:00 - 2:00** | **1. Executive Cockpit (`/dashboard`)** | *"Here is the Executive Dashboard showing gross financial exposure ($SLE), control effectiveness (78%), and active RCSA cycles at a glance."* |
| **2:00 - 5:00** | **2. Excel / CSV Migration (`/rcsa/identification`)** | *"You don't need to rebuild your registers. Download our CSV template or upload your existing spreadsheets directly into Pericope with instant validation."* |
| **5:00 - 8:00** | **3. 5x5 Heatmap & Residual Step-down (`/heatmaps`)** | *"Watch how risks are plotted across likelihood and impact. Switch between Inherent, Residual, and Trend views to see how internal controls reduce monetary exposure."* |
| **8:00 - 11:00** | **4. Continuous KRI Telemetry (`/kri`)** | *"Simulate an operational spike in IT outage hours from 4.0 to 14.5. Watch the indicator turn Red, trigger an alert, and log an immutable audit event."* |
| **11:00 - 13:00** | **5. SOX 404 RBAC & Audit Trail (`/audit-trail`)** | *"Demonstrate Segregation of Duties. Switch to Auditor persona — notice all create/delete buttons disappear and the full historical event log is accessible."* |
| **13:00 - 15:00** | **6. 1-Click Board Risk Pack (`/reports`)** | *"Click 'Print / Save as PDF' on the Executive Board Pack to generate a formatted quarterly risk committee deck."* |

---

## 5. Click-by-Click Live Demonstration Script

### Scene 1: Multi-Mode Corporate Sign-In
1. Navigate to `http://localhost:3000`. If logged in, click user menu $\rightarrow$ **Sign out**.
2. **Talking Point:** *"Pericope supports standard corporate credentials, Enterprise SSO (Azure AD / Okta), and one-click role persona testing."*
3. Click **"Srivatsan B — Administrator"** or sign in with `srivatsan@pericope.local` / `Demo123!`.

---

### Scene 2: Executive Dashboard
1. Land on `/dashboard`.
2. Point to the **4 KPI Panels**:
   - **Active Risks:** 18
   - **Single Loss Expectancy (SLE):** $1,280k
   - **Control Coverage:** 78.4%
   - **Assessment Completion:** 67%
3. Hover over the **Trailing Risk Velocity** 6-month area chart.
4. Point to the **Recent Risk Entries** ledger table with direct navigation links.

---

### Scene 3: RCSA Lifecycle & Bulk Spreadsheet Migration
1. Click **RCSA Hub** $\rightarrow$ **01 Setup** (`/rcsa/provisioning`).
   - Point to the Stepper Bar: `01 Setup` $\rightarrow$ `02 Identify` $\rightarrow$ `03 Mitigation` $\rightarrow$ `04 Monitoring`.
   - Click **"Demo starter packs"** $\rightarrow$ select **"Fintech & Banking Pack"** to demonstrate instant industry seeding.
2. Click **"Next Stage: Identify &rarr;"** or open `/rcsa/identification`.
   - Click **"CSV Template"** $\rightarrow$ browser downloads `pericope_risk_register_template.csv`.
   - Click **"Import CSV"** $\rightarrow$ select any sample `.csv` $\rightarrow$ preview table displays parsed statements, likelihood, impact, and SLE.
   - Click **"Import Risks"** $\rightarrow$ toast confirms successful bulk import into database.

---

### Scene 4: Interactive 5×5 Risk Heatmap
1. Navigate to **Risk Analytics** $\rightarrow$ **5×5 Risk Heatmaps** (`/heatmaps`).
2. Point out the clear coordinate axes:
   - **Y-Axis (Likelihood):** `5 - Almost Certain` down to `1 - Rare`.
   - **X-Axis (Impact):** `1 - Insignificant` up to `5 - Severe`.
3. Toggle between:
   - **Inherent Exposure:** Pre-control gross risk scores.
   - **Residual (Post-Control):** Post-mitigation stepped-down risk scores.
   - **Risk Velocity:** Trending trajectory.
4. Click on any active cell with numbers (e.g., cell with 2 risks) $\rightarrow$ dialog modal opens listing the exact risk scenarios mapped to that score.

---

### Scene 5: Continuous KRI Telemetry & Breach Alert Simulation
1. Navigate to **Key Risk Indicators** (`/kri`).
2. Point to the 4 operational metric cards (*Tracked indicators, Normal, Warnings, Red Breaches*).
3. Find **"Unplanned IT Outage Hours"** (current value: 7.2 hrs/mo, status: Amber).
4. Click the **Refresh/Update icon** $\rightarrow$ input value `14.5` $\rightarrow$ click **Update**.
5. **Observe:**
   - Status badge turns **Critical / Breach (Red)**.
   - The mini trend line plots the new peak above the red reference line.
   - Audit trail automatically captures the event.

---

### Scene 6: Role-Based Access Control (RBAC) & Auditor Mode
1. Open the top-right User Dropdown menu.
2. Click **"Lin Wei (Auditor)"**.
3. **Observe:**
   - Amber banner appears: *"Auditor mode (read-only): You have view access to all records, control workpapers, and the audit log."*
   - Navigate to `/rcsa/identification` or `/control-library` $\rightarrow$ notice that "+ Add Risk", "New control", and "Delete" buttons are hidden or disabled.
4. Navigate to **Audit Trail** (`/audit-trail`).
   - Point to the chronological table showing timestamps, actor names, action types (`CREATE`, `UPDATE`, `ROLE_CHANGE`), and results.
   - Click **"Export CSV"** $\rightarrow$ exports complete compliance log.

---

### Scene 7: 1-Click Executive Board Risk Report (PDF)
1. Switch back to **Administrator** or navigate to **Reports** (`/reports`).
2. Select **"Executive Board Risk Committee Pack"** (or click through any of the 8 dynamic reports in the catalog).
3. Point out the 4 structured reporting sections:
   - *1. Executive Exposure Summary*
   - *2. Top High-Exposure Risk Scenarios Table*
   - *3. Key Risk Indicator (KRI) Operational Thresholds*
   - *4. SOX 404 & ISO 31000 Certification Sign-off*
4. Click **"Print / Save as PDF"**.
5. **Point out:** The print preview strips all browser navigation, buttons, and sidebars, rendering only the clean, full-width executive report.

---

## 6. Anticipated Viva & Client Questions with Model Answers

### Q1 (Academic): How does your system achieve resilience if the Oracle Database/ORDS is slow or unreachable?
> **Answer:** *"Pericope ERM implements an in-memory shadow store inside the Node.js BFF (`server.js`). Upstream ORDS requests have a strict 8-second timeout. If ORDS times out or fails, the BFF transparently answers from the shadow store with synthetic UUIDs, ensuring the user interface never freezes. When connectivity is restored, records reconcile. Additionally, local-first modules in `lib/localStore.ts` utilize browser localStorage with cross-tab event listeners to maintain offline functionality."*

### Q2 (Academic): Why did you choose a dual qualitative and quantitative risk scoring model?
> **Answer:** *"Most enterprises struggle because qualitative 5x5 heatmaps and quantitative dollar estimates are maintained in separate spreadsheets and drift out of sync. In Pericope ERM, every risk entry takes ordinal Likelihood $L \in [1,5]$ and Impact $I \in [1,5]$, computing the qualitative score $S = L \times I$ and the financial exposure $\text{SLE} = S \times \$10,000$ simultaneously. When controls are mapped, the multi-factor effectiveness factor $\eta = (\text{Design} \times \text{Operating})/25$ steps down both the heatmap cell and the monetary exposure together."*

### Q3 (Client): We have 200+ risks in Excel right now. How difficult is it to migrate to Pericope?
> **Answer:** *"You can migrate in less than 2 minutes. On the Risk Identification screen, click 'CSV Template' to download our pre-mapped format, paste your columns, and click 'Import CSV'. The system parses the records, validates the data, calculates the SLE exposures, and populates your live register immediately."*

### Q4 (Academic / Security): How do you enforce Segregation of Duties (SoD) and audit compliance?
> **Answer:** *"Every mutating request passes through authentication middleware that attaches user identity headers (`X-User-Id`, `X-User-Name`, `X-User-Role`). The backend enforces server-side role permissions where only Administrators can perform destructive deletes or manage users, Risk Managers approve mitigations, and Auditors are restricted to read-only access. Every event is written using Oracle autonomous transaction triggers (`ERM_AUDIT_WRITE`) that cannot be rolled back or aborted by business errors."*

---

## 7. System Architecture & Quantitative Formula Cheat-Sheet

### 1. Qualitative Composite Score:
$$S = L \times I \qquad L, I \in \{1, 2, 3, 4, 5\} \quad \implies \quad S \in [1, 25]$$
* **Low:** $1 \le S \le 7$
* **Medium:** $8 \le S \le 11$
* **High:** $12 \le S \le 15$
* **Critical:** $16 \le S \le 25$

### 2. Single Loss Expectancy (SLE):
$$\text{SLE} = L \times I \times \$10{,}000 \quad (\text{USD})$$

### 3. Multi-Factor Control Effectiveness & Residual Risk:
$$\eta = \frac{\text{Design Effectiveness (1–5)} \times \text{Operating Effectiveness (1–5)}}{25} \in [0.04, 1.0]$$
$$L_{\text{res}} = \max\left(1, \; \text{round}\left(L_{\text{inh}} \times (1 - 0.7 \times \eta)\right)\right)$$
$$I_{\text{res}} = \max\left(1, \; \text{round}\left(I_{\text{inh}} \times (1 - 0.5 \times \eta)\right)\right)$$
$$\text{Residual SLE} = L_{\text{res}} \times I_{\text{res}} \times \$10{,}000$$

### 4. FAIR Monte Carlo Loss Distribution (10,000 Iterations):
* **Loss Event Frequency (LEF):** Modeled via Poisson Distribution ($\lambda = \frac{L}{5} \times 2.5$).
* **Loss Magnitude (LM):** Modeled via Lognormal Distribution derived from SLE.
* **Output Metrics:** Annualized Loss Expectancy (ALE) and 95% Value at Risk ($\text{VaR}_{95}$).
