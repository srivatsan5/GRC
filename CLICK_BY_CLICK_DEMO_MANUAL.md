> **Note (Phase 0/1 security update):** sign-in now uses real accounts with passwords managed under **Users**; the one-click persona buttons and the role switcher described below have been removed, and the backend now lives in `api/`. See `FRONTEND_README.md` and `api/README.md`.

# Pericope ERM — Master Click-by-Click Live Demonstration Manual

**Major Project Title:** Pericope ERM: A Resilience-First, Three-Tier Architecture for Full-Lifecycle Enterprise Risk Management  
**Authors:** Srivatsan B (1AT23CG104), Raja Vishnu (1AT23CG080), Rithvik R (1AT23CG084), Niranthar M Javagal (1AT23CG071)  
**Academic Guide:** Prof. Veena S, Department of Computer Science & Engineering, Atria Institute of Technology  
**Version:** 4.0 (Exhaustive Step-by-Step Edition)  
**Target Duration:** 15–20 Minutes (Academic Defense & Enterprise Sales Pitch)

---

## 1. Pre-Demo 5-Minute Setup Checklist

Before beginning your demonstration to examiners or enterprise clients, execute these setup steps:

```bash
# Terminal 1: Start Backend BFF API Server (Port 5000)
node server.js
# Expected Output: Pericope ERM BFF API running on http://localhost:5000 | 48 endpoints ready

# Terminal 2: Start Frontend Next.js Client (Port 3000)
npm run dev
# Expected Output: Ready in http://localhost:3000

# Terminal 3: Run Automated QA Verification Suite
node qa_test_suite.mjs
# Expected Output: 12 PASSED, 0 FAILED (TOTAL 12)
```

---

## 2. Module 1: Corporate Sign-In & Authentication Portal (`/login`)

```
Step 1.1: Open Browser to http://localhost:3000
├── What appears: Clean, restrained enterprise login portal with Pericope branding.
├── Click: If already logged in, open the top-right user menu and click "Sign out".
├── What to say: "Pericope ERM provides a multi-mode enterprise authentication gateway supporting standard corporate credentials, enterprise single sign-on (SSO), and role-based persona testing."

Step 1.2: Demonstrate One-Click Persona Login
├── Click: "Srivatsan B — Administrator (Risk Office)" from the role selector list.
├── What happens: Instant session token generated, sessionStorage populated with user identity headers (X-User-Id: U-001, X-User-Role: Administrator), and redirect to /dashboard.
├── What to say: "Notice how seamlessly role context is assigned. For this demonstration, we will explore the system as an Administrator with full operational and governance permissions."
```

---

## 3. Module 2: Executive Risk Dashboard (`/dashboard`)

```
Step 2.1: Inspect the 4 Operational KPI Panels
├── What appears:
│   ├── Active Risks: 18 (with high/critical exposure count)
│   ├── Single Loss Expectancy (SLE): $1,280k total monetary exposure
│   ├── Control Coverage: 78.4% (percentage of risks with active controls)
│   └── Assessment Completion: 67% (progress across active quarterly cycles)
├── What to say: "Here is the Executive Dashboard. Unlike traditional spreadsheets that only give abstract colors, Pericope ERM translates risk coordinates into a tangible financial figure: Single Loss Expectancy (SLE = Score × $10,000)."

Step 2.2: Hover Over the Trailing Risk Velocity Area Chart
├── Action: Move your cursor across the 6-month risk trend area chart.
├── What appears: Interactive tooltips displaying exact active risk volumes from November 2025 through April 2026.
├── What to say: "This area chart visualizes organizational risk velocity over trailing months, giving leadership visibility into whether risk exposure is expanding or contracting."

Step 2.3: Review Departmental Allocation & Recent Risk Entries
├── Action: Scroll down to inspect the "Risks by department" breakdown (IT: 35%, Finance: 28%, TPRM: 22%, Legal: 15%) and the "Recent risk entries" table.
├── Click: Click "View all" on the recent risk table to navigate to the live risk register.
```

---

## 4. Module 3: RCSA Stage 1 — Assessment Provisioning (`/rcsa/provisioning`)

```
Step 3.1: Navigate to Assessment Setup
├── Click: In the sidebar or top navigation, click "RCSA" → "Provisioning & Setup" (/rcsa/provisioning).
├── What appears: The 4-stage lifecycle stepper (01 Setup → 02 Identification → 03 Mitigation → 04 Monitoring) and the table of active assessment cycles.

Step 3.2: Demonstrate One-Click Industry Starter Packs
├── Click: Click the "Demo starter packs" dropdown menu in the top-right toolbar.
├── Click: Select "Fintech & Banking Pack" (or SaaS Cloud Security Pack).
├── What happens: The system automatically seeds 3 departmental assessment cycles with pre-mapped codes (e.g. RCSA-FIN-2026-001, RCSA-AML-2026-002, RCSA-PAY-2026-003).
├── What to say: "For rapid onboarding, Pericope includes industry starter templates that instantly seed regulatory assessment frameworks for banking, cloud security, or healthcare."

Step 3.3: Direct Assessment Drilldown
├── Click: Click "Open →" on any assessment row (e.g. RCSA-1601 Finance & Treasury).
├── What appears: Direct navigation to /rcsa/provisioning/[id] (Assessment Details).
├── What to say: "Notice that clicking 'Open' takes you directly into the dedicated workspace for this specific assessment, showing its scope, risk champion, and connected risks."
```

---

## 5. Module 4: RCSA Stage 2 — Risk Identification & Bulk Migration (`/rcsa/identification`)

```
Step 4.1: Navigate to Risk Identification Register
├── Click: Click "02 Identification" on the stepper bar or open /rcsa/identification.
├── What appears: The complete enterprise risk register with search bar, exposure totals, and action buttons.

Step 4.2: Demonstrate Bulk Spreadsheet Migration (CSV Template & Importer)
├── Click: Click "CSV Template" in the toolbar.
│   └── What happens: The browser downloads pericope_risk_register_template.csv containing standard column headers.
├── Click: Click "Import CSV" in the toolbar.
│   └── What appears: The Bulk Import modal with a drag-and-drop file upload zone and raw CSV text area.
├── Action: Click the upload zone to select a .csv file OR paste sample CSV text:
    "Cloud database outage during payroll","IT & Cyber","IT",4,4,"Anthony Muller"
├── Click: Click "Parse Pasted CSV" (or let file upload parse automatically).
│   └── What appears: A live multi-row preview table showing calculated Likelihood (4/5), Impact (4/5), and Single Loss Expectancy ($160,000).
├── Click: Click "Import risks into database".
│   └── What happens: Toast confirms successful bulk import, and the table updates with new risk records.
├── What to say: "This eliminates the biggest barrier for mid-sized organizations. Teams can migrate 200+ risks from Excel into Pericope in under 30 seconds."

Step 4.3: Manual Risk Scenario Cataloging
├── Click: Click "+ Add Risk" button.
├── Action: Enter Risk Statement: "SWIFT Payment Gateway Latency during Batch Settlement", Category: "Financial", Likelihood: "4 - Likely", Impact: "4 - Major", Owner: "Finance & Treasury".
├── Click: Click "Save risk".
├── What happens: The record is created, SLE is calculated as $160,000, and an audit event is logged.
```

---

## 6. Module 5: RCSA Stage 3 — Controls Mapping & Residual Step-Down (`/rcsa/mitigation`)

```
Step 5.1: Navigate to Mitigation & Controls Overview
├── Click: Click "03 Controls & Mitigation" on the stepper bar or open /rcsa/mitigation.
├── What appears: Departmental accordion list (Finance & Treasury, IT, Procurement, Legal) with control counts and risk statements.

Step 5.2: Open Risk Mitigation Profile
├── Click: Click "View Details →" on any risk (e.g. SWIFT Payment Gateway Latency).
├── What appears: Direct navigation to /rcsa/mitigation/[id] displaying:
│   ├── Gross Inherent SLE: $160,000 (Score 16/25 - Critical)
│   ├── Net Residual SLE: $40,000 (Score 4/25 - Low/Acceptable)
│   ├── Risk Reduction: 75% drop in monetary exposure
│   └── Table of Mapped Mitigating Controls.
├── What to say: "Here we see our multi-factor residual calculation in action. The formula evaluates control design and operating effectiveness to mathematically step down both the 5x5 heatmap position and the financial exposure."

Step 5.3: Tag a New Control to the Risk
├── Click: Click "Map Controls →" or "+ Add Action Plan".
├── Action: Select control "CTL-FIN-SOD-07 Maker-checker authorization for payments > $10k", set Operating Effectiveness to "Effective (5/5)", and save.
```

---

## 7. Module 6 & 7: 5×5 Enterprise Risk Heatmap (`/heatmaps`) & Monitoring (`/rcsa/monitoring`)

```
Step 7.1: Navigate to 5×5 Risk Heatmaps
├── Click: Click "Risk Analytics" → "5×5 Risk Heatmaps" (/heatmaps).
├── What appears: A high-density 5×5 coordinate matrix with Likelihood (1–5) on the vertical axis and Impact (1–5) on the horizontal axis.

Step 7.2: Toggle Multi-View Modes
├── Click: Click "Inherent" → Matrix displays gross pre-control risk distribution.
├── Click: Click "Residual" → Matrix displays post-mitigation risk distribution, showing risks stepped down into green and yellow cells.
├── Click: Click "Trend" → Matrix displays directional risk velocity.
├── What to say: "Notice the clarity of this visualization. It allows executive leadership to see exactly how control investments reduce risk exposure across severity bands."

Step 7.3: Cell-Level Risk Inspection Dialog
├── Click: Click on any active cell with numbers (e.g. Score 16 cell).
├── What appears: A dialog modal opens listing the exact risk statements, owners, and individual SLE dollar figures situated in that cell.

Step 7.4: Continuous Risk Monitoring (/rcsa/monitoring)
├── Click: Click "04 Monitoring" on the stepper bar.
├── What appears: Milestone action plan tracker showing completion percentages and stage sign-off buttons.
```

---

## 8. Module 8: Key Risk Indicators (KRI) & Telemetry Alert Simulator (`/kri`)

```
Step 8.1: Navigate to KRI Intelligence
├── Click: In the sidebar, click "Risk Analytics" → "Key Risk Indicators" (/kri).
├── What appears: 4 telemetry summary tiles (Total KRIs, Normal/Green, Warnings/Amber, Breaches/Red) and a grid of KRI cards with sparkline trend lines.

Step 8.2: Simulate an Operational Threshold Breach
├── Action: Locate the card for "Unplanned IT Outage Hours" (current value: 7.2 hrs/mo, status: Amber).
├── Click: Click the Refresh/Update icon on the card.
├── Action: In the "New value" input box, type "14.5" and click "Update".
├── What happens:
│   ├── The status badge immediately flips to "Breach (Red)".
│   ├── The card border highlights in red.
│   ├── The mini trend line peaks above the red threshold reference line.
│   └── An automated audit event is logged with user attribution.
├── What to say: "This demonstrates continuous automated GRC. When an operational metric breaches tolerance, the system triggers an alert, records an immutable audit entry, and escalates the finding."
```

---

## 9. Module 9 & 10: Governance, TPRM & Scenario Stress Lab

```
Step 9.1: Control Library (/control-library)
├── Click: Open "Controls & Policy" → "Control Library".
├── What appears: Multi-standard control register mapped across ISO 27001, SOX Section 404, GDPR, and NIST.
├── What to say: "Organizations can test a control once and prove compliance across multiple standards simultaneously."

Step 9.2: Third-Party Vendor Risk Management (/vendor-risk)
├── Click: Open "Enterprise Risk" → "Vendor Risk (TPRM)".
├── What appears: Tiered vendor register (Critical, High, Medium, Low), contract values, risk scores (1–100), and review cadences.

Step 9.3: Scenario Analysis & FAIR Monte Carlo Stress Lab (/scenario)
├── Click: Open "Enterprise Risk" → "Scenario Analysis".
├── What appears: Macroeconomic and operational shock models (e.g. 20% Currency Devaluation, Cloud Region Outage).
├── Click: Click "Run" next to any scenario.
├── What happens: Executes a 10,000-iteration Monte Carlo loss simulation computing Annualized Loss Expectancy (ALE) and 95% Value at Risk (VaR 95).
```

---

## 10. Module 11: Maker–Checker Approvals (`/workflow`) & Audit Trail (`/audit-trail`)

```
Step 10.1: Maker–Checker Approval Workflow (/workflow)
├── Click: Open "Controls & Policy" → "Workflow Approvals".
├── What appears: List of pending approval requests with multi-stage approver chains.
├── Click: Click "Approve" or "Reject" on a pending request.
├── What happens: Decision is recorded with user name, timestamp, and audit trail update.

Step 10.2: Role-Based Access Control (RBAC) & Auditor Mode
├── Action: Open the top-right user menu and select "Lin Wei (Auditor)".
├── What happens:
│   ├── An amber banner appears: "Auditor mode (read-only): You have view access to all records, control workpapers, and the audit log."
│   ├── Navigate to /rcsa/identification or /control-library → Notice that all "+ Add Risk", "New control", and "Delete" buttons are hidden.
├── What to say: "This enforces strict SOX 404 Segregation of Duties. Auditors receive read-only verification access without the ability to mutate operational data."

Step 10.3: Autonomous Audit Trail (/audit-trail)
├── Click: Open "Administration" → "Audit Trail".
├── What appears: Chronological event ledger showing timestamps, actor names, roles, action types (CREATE, UPDATE, APPROVE, ROLE_CHANGE), and results.
├── Click: Click "Export CSV" to download the full compliance ledger.
```

---

## 11. Module 12: Executive Reports & 1-Click Board Pack PDF (`/reports`)

```
Step 11.1: Navigate to Reports Catalog
├── Action: Switch back to "Srivatsan B (Administrator)" from the top menu and open "/reports".
├── What appears: Left catalog containing 8 distinct report templates and a live formatted preview on the right.

Step 11.2: Demonstrate Dynamic Report Switching
├── Click: Click on different report templates on the left panel:
│   ├── RPT-001: Executive Board Risk Committee Pack
│   ├── RPT-002: RCSA Assessment Lifecycle Summary
│   ├── RPT-003: SOX Section 404 Control Test Workpapers
│   ├── RPT-004: Immutable Audit Trail Ledger (SOX)
│   ├── RPT-005: Key Risk Indicator (KRI) Threshold Register
│   ├── RPT-006: Control Effectiveness & Residual Risk Report
│   ├── RPT-007: ISO/IEC 27001 Information Security Evidence Pack
│   └── RPT-008: Third-Party Vendor Risk Assessment (TPRM)
├── What happens: The right panel dynamically reconfigures, rendering the specific data structures, metrics, and attestation sign-offs for that report.

Step 11.3: 1-Click Export Board Risk Pack (PDF)
├── Action: Select "Executive Board Risk Committee Pack" (RPT-001) and click "Print / Save as PDF".
├── What appears: Browser print dialog opens.
├── What to say: "Notice that our print stylesheet strips all browser headers, sidebars, search bars, and buttons. Page 1 begins cleanly with the Board Risk Report, executive metrics, risk scenarios table, KRI scorecard, and governance attestation sign-off."
```

---

## 12. Conclusion & Summary of Architectural Principles

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          KEY TECHNICAL TAKEAWAYS FOR EVALUATORS                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. 3-Tier Resilient Architecture: Next.js 15 Client + Node.js BFF + Oracle Database    │
│ 2. Shadow Store Fallback: 8s circuit breaker prevents client freezing during DB lag    │
│ 3. Dual Mathematical Model: Qualitative S = L × I and Quantitative SLE = S × $10,000   │
│ 4. Autonomous Transactions: PRAGMA AUTONOMOUS_TRANSACTION prevents audit DML deadlocks │
│ 5. Automated Verification: 12/12 unit and integration tests passing in test suite      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
