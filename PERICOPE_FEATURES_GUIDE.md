> **Note (Phase 0/1 security update):** sign-in now uses real accounts with passwords managed under **Users**; the one-click persona buttons and the role switcher described below have been removed, and the backend now lives in `api/`. See `FRONTEND_README.md` and `api/README.md`.

# Pericope ERM — Complete Feature-by-Feature Reference Manual

**Platform:** Pericope Enterprise Risk Management & GRC Suite  
**Authors:** Srivatsan B, Raja Vishnu, Rithvik R, Niranthar M Javagal  
**Institution:** Department of Computer Science & Engineering, Atria Institute of Technology  
**Version:** 3.5 (Comprehensive Feature Edition)  

---

## Table of Contents
1. [Platform Overview & Design Architecture](#1-platform-overview--design-architecture)
2. [Executive Dashboard](#2-executive-dashboard)
3. [RCSA Lifecycle Workflow (4-Stage Stepper)](#3-rcsa-lifecycle-workflow-4-stage-stepper)
   - [Stage 1: Assessment Setup & Provisioning](#stage-1-assessment-setup--provisioning)
   - [Stage 2: Risk Identification & Cataloging](#stage-2-risk-identification--cataloging)
   - [Stage 3: Mitigation & Control Mapping](#stage-3-mitigation--control-mapping)
   - [Stage 4: Continuous Risk Monitoring](#stage-4-continuous-risk-monitoring)
4. [Advanced Risk Analytics & 5×5 Heatmaps](#4-advanced-risk-analytics--55-heatmaps)
5. [Key Risk Indicators (KRI) & Live Telemetry](#5-key-risk-indicators-kri--live-telemetry)
6. [Governance, Controls & Maker–Checker Workflows](#6-governance-controls--makerchecker-workflows)
   - [Control Library & Testing](#control-library--testing)
   - [Risk Appetite & Tolerance Framework](#risk-appetite--tolerance-framework)
   - [Maker–Checker Approval Engine](#makerchecker-approval-engine)
   - [Policy Management Center](#policy-management-center)
7. [Enterprise Risk & Operational Resilience](#7-enterprise-risk--operational-resilience)
   - [Third-Party Risk Management (TPRM)](#third-party-risk-management-tprm)
   - [Incident & Loss Event Tracker](#incident--loss-event-tracker)
   - [Business Continuity Planning (BCP / DRP)](#business-continuity-planning-bcp--drp)
   - [Scenario Analysis & FAIR Monte Carlo Stress Lab](#scenario-analysis--fair-monte-carlo-stress-lab)
8. [Audit, Administration & Security (RBAC)](#8-audit-administration--security-rbac)
   - [Immutable Audit Trail (SOX 404)](#immutable-audit-trail-sox-404)
   - [User Management & Role-Based Access Control](#user-management--role-based-access-control)
   - [System Setup & Security Parameters](#system-setup--security-parameters)
9. [Reporting & Board Risk Deliverables (All 8 Dynamic Reports)](#9-reporting--board-risk-deliverables-all-8-dynamic-reports)
10. [Data Ingestion & Migration Tools](#10-data-ingestion--migration-tools)
11. [Backend & Database Architecture](#11-backend--database-architecture)

---

## 1. Platform Overview & Design Architecture

Pericope ERM is an enterprise Governance, Risk, and Compliance (GRC) software system designed to replace fragmented spreadsheets with an automated, auditable, and mathematically quantified system of record.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SYSTEM CAPABILITY MAP                                  │
├─────────────────────────┬──────────────────────────────┬───────────────────────────────┤
│ 1. RCSA WORKFLOW        │ 2. QUANTITATIVE MODELING     │ 3. ENTERPRISE GOVERNANCE      │
│ • Cycle Provisioning    │ • Inherent/Residual SLE ($)  │ • Maker–Checker Approvals     │
│ • Bulk CSV Import       │ • Multi-Factor Controls (η)  │ • SOX 404 Audit Logging       │
│ • Mitigation Mapping    │ • FAIR Monte Carlo Simulation│ • Multi-Standard Control Maps │
├─────────────────────────┼──────────────────────────────┼───────────────────────────────┤
│ 4. REAL-TIME TELEMETRY  │ 5. RESILIENT ARCHITECTURE    │ 6. BOARD REPORTING            │
│ • KRI Threshold Alerts  │ • In-Memory Shadow Store     │ • 8 Dynamic Reports           │
│ • Trend Line Analytics  │ • 8s Bounded Circuit Breaker │ • 1-Click Board Pack PDF      │
│ • Incident Root-Cause   │ • Oracle Autonomous DB / ORDS│ • Segregated Auditor View     │
└─────────────────────────┴──────────────────────────────┴───────────────────────────────┘
```

---

## 2. Executive Dashboard (`/dashboard`)

The Executive Dashboard serves as the central command cockpit for risk leaders, compliance heads, and executive management.

* **4 Live KPI Panels:**
  1. **Active Risks:** Total cataloged risks, highlighting high and critical severity exposure counts.
  2. **Single Loss Expectancy (SLE):** Real-time aggregate dollar exposure across the entire organization ($\text{SLE} = S \times \$10,000$).
  3. **Control Coverage:** Percentage of active operational risks with verified mitigating controls attached.
  4. **Assessment Completion:** Proportion of active departmental RCSA assessment cycles validated and attested.
* **Trailing Risk Velocity Chart:** A 6-month interactive area chart visualizing the registration, mitigation, and closure trajectory of organizational risks.
* **Risk Allocation by Department:** Direct visual percentage breakdown of risk concentration across Information Technology, Finance, Procurement, Legal, and Operations.
* **Recent Risk Entries Ledger:** Real-time data table displaying recently cataloged risk scenarios, reference codes, departments, exposure figures, and direct review links.

---

## 3. RCSA Lifecycle Workflow (4-Stage Stepper)

Pericope ERM models the complete Risk and Control Self-Assessment (RCSA) lifecycle through a structured 4-stage stepper.

### Stage 1: Assessment Setup & Provisioning (`/rcsa/provisioning`)
* **Cycle Provisioning:** Define quarterly/annual assessment cycles for target business units (e.g. `RCSA-FIN-2026-001` for Finance & Treasury).
* **Metadata Parameters:** Assign risk champions, estimated start/end dates, scope, and status (Draft, In Progress, Completed).
* **Industry Starter Packs:** One-click seeding of pre-built assessment templates for **Fintech & Banking**, **Cloud/SaaS Security**, and **Healthcare (HIPAA)**.
* **Assessment Details Drilldown (`/rcsa/provisioning/[id]`):** Clicking "Open" navigates directly to the dedicated assessment workspace showing all linked risks, individual scores, and control mapping actions.

### Stage 2: Risk Identification & Cataloging (`/rcsa/identification`)
* **Risk Scenario Registration:** Form modal to capture detailed risk statements, categories, departments, initial Likelihood (1–5), and Impact (1–5).
* **Automated Single Loss Expectancy Calculation:** Instantly computes $\text{SLE} = L \times I \times \$10,000$ upon entering ratings.
* **Bulk Spreadsheet (CSV) Importer:** Native CSV file parser allowing risk teams to drag-and-drop existing Excel risk registers, preview parsed rows, and import them in bulk.
* **Sample CSV Template Generator:** One-click download of `pericope_risk_register_template.csv`.

### Stage 3: Mitigation & Control Mapping (`/rcsa/mitigation` & `/rcsa/provisioning/[id]/controls/[riskId]`)
* **Departmental Mitigation Overview:** Collapsible department accordion rows displaying control counts and exposure totals.
* **Risk Mitigation Profile (`/rcsa/mitigation/[id]`):** Deep-dive workspace for a single risk showing:
  - Inherent Score ($S = L \times I$) vs Residual Score ($S_{\text{res}} = L_{\text{res}} \times I_{\text{res}}$).
  - Risk reduction percentage ($\%$ drop in financial exposure).
  - Table of mapped mitigating controls.
  - Action plan generator for remediation tracking.
* **Applied Controls Mapper:** Tag controls to a specific risk, configure testing frequency (Daily, Weekly, Monthly, Continuous), and set Design (1–5) and Operating (1–5) ratings.

### Stage 4: Continuous Risk Monitoring (`/rcsa/monitoring`)
* **Remediation Tracking:** Track milestone deadlines, assigned action owners, and percentage completion.
* **Lifecycle Sign-off:** Maker-checker attestation to mark assessments as validated and completed.

---

## 4. Advanced Risk Analytics & 5×5 Heatmaps (`/heatmaps`)

* **Bi-Axial Coordinate Grid:**
  - **Vertical Y-Axis (Likelihood):** `5 - Almost Certain (>80%)`, `4 - Likely (50-80%)`, `3 - Possible (20-50%)`, `2 - Unlikely (5-20%)`, `1 - Rare (<5%)`.
  - **Horizontal X-Axis (Impact):** `1 - Insignificant (<$25K)`, `2 - Minor ($25K-$100K)`, `3 - Moderate ($100K-$250K)`, `4 - Major ($250K-$1M)`, `5 - Severe (>$1M)`.
* **Multi-View Modes:**
  1. **Inherent Exposure:** Pre-control gross risk distribution.
  2. **Residual Risk:** Post-control stepped-down risk distribution showing how controls push risks into the green zone.
  3. **Risk Velocity:** Trailing trajectory and emerging threats.
* **Interactive Cell Inspection:** Clicking any cell with active risks opens an inspection dialog listing the exact risk statements, owners, and individual SLE valuations.

---

## 5. Key Risk Indicators (KRI) & Live Telemetry (`/kri`)

* **Continuous Telemetry Tracking:** Automated threshold monitoring across operational, cyber, financial, and people metrics.
* **Threshold Color Bands:**
  - **Green (Normal):** Below amber boundary.
  - **Amber (Warning):** Approaching risk tolerance limit.
  - **Red (Critical Breach):** Tolerance breached; immediate escalation triggered.
* **Live Reading Simulator & Updater:** Users can click the update icon on any KRI card to log a new measurement (e.g. entering `14.5` hrs for outage hours) and observe the card transition immediately to Red, updating trend lines and logging an audit event.
* **Directional Logic:** Supports both `higher-worse` (e.g. outage hours, CVE count) and `lower-worse` (e.g. cash runway, operating margin) metrics.

---

## 6. Governance, Controls & Maker–Checker Workflows

### Control Library & Testing (`/control-library`)
* **Central Control Register:** Catalog preventive, detective, corrective, and compensating controls.
* **Multi-Framework Tagging:** Tag controls against **ISO/IEC 27001**, **SOX 404**, **GDPR**, **SOC 2**, and **NIST SP 800-53**.
* **Effectiveness Scoring:** Record Design Effectiveness (1–5) and Operating Effectiveness (1–5) testing results.

### Risk Appetite & Tolerance Framework (`/risk-appetite`)
* **Appetite Statements:** Formal qualitative posture (Averse, Cautious, Open, Hungry) and quantitative thresholds by domain (Strategic, Financial, Operational, Compliance, IT & Cyber).
* **Appetite vs Exposure Gauges:** Real-time visualization comparing active portfolio exposure against Board-approved tolerance limits.

### Maker–Checker Approval Engine (`/workflow`)
* **Segregation of Duties (SoD):** Multi-step approval chains where assessors submit requests and risk managers/administrators review, approve, or reject with documented comments.
* **Supported Approval Types:** Risk Assessments, Mitigation Plans, Control Changes, Policy Updates, and Formal Risk Acceptances.

### Policy Management Center (`/policy`)
* **Policy Versioning & Ownership:** Central register of corporate policies, version numbers, effective dates, and review cadences.
* **Acknowledgment Tracking:** Tracks employee acknowledgment compliance percentages.

---

## 7. Enterprise Risk & Operational Resilience

### Third-Party Risk Management (TPRM) (`/vendor-risk`)
* **Tiered Vendor Portfolio:** Categorize third-party suppliers into Critical, High, Medium, and Low risk tiers.
* **Contract & Assessment Tracking:** Track contract values, risk scores (1–100), due diligence questionnaire (DDQ) completion, and upcoming audit reviews.

### Incident & Loss Event Tracker (`/incidents`)
* **Loss Event Logging:** Log operational failures, cyber incidents, and vendor breaches.
* **Root-Cause & Corrective Action Tracking:** Document root-cause investigations, assigned remediation owners, and Mean Time to Resolve (MTTR).

### Business Continuity Planning (BCP / DRP) (`/bcp`)
* **Disaster Recovery Metrics:** Define Recovery Time Objectives (RTO in hours) and Recovery Point Objectives (RPO in hours) for critical business processes.
* **Testing Cadence:** Monitor test schedules, overdue reviews, and operational failover readiness.

### Scenario Analysis & FAIR Monte Carlo Stress Lab (`/scenario`)
* **Forward-Looking Shock Simulation:** Model macro and operational shocks (e.g. 20% currency devaluation, cloud region outage, major customer loss).
* **Probabilistic Quantification:** Execute 10,000 Monte Carlo iterations modeling Poisson event frequency and Lognormal loss magnitudes to compute **Annualized Loss Expectancy (ALE)** and **95% Value at Risk ($\text{VaR}_{95}$)**.

---

## 8. Audit, Administration & Security (RBAC)

### Immutable Audit Trail (SOX 404) (`/audit-trail`)
* **Complete Event Logging:** Captures all creates, updates, deletes, approvals, logins, role changes, and exports with user attribution (`actor_id`, `actor_name`, `actor_role`).
* **Filtering & Export:** Filter by date range, action type, or search term, with 1-click **Export to CSV**.
* **Database Triggers:** Backed by autonomous transaction triggers in Oracle SQL (`fix_pericope_erm.sql`) ensuring audit entries cannot be tampered with or aborted.

### User Management & Role-Based Access Control (`/users`)
* **5 Standard Enterprise Roles:**
  1. 👑 **Administrator:** Full platform control, user management, and system parameters.
  2. 🛡️ **Risk Manager:** RCSA approvals, control testing validation, and KRI threshold configuration.
  3. ✍️ **Assessor:** Risk identification, inherent and residual assessment scoring (no destructive delete).
  4. 🔍 **Auditor:** Read-only access to all registers, workpapers, and the immutable audit log.
  5. 📊 **Viewer:** Read-only C-suite access to executive dashboards, heatmaps, and reports.
* **Inline Role Assignment:** Administrators can change roles, activate/deactivate accounts, or provision new users.

### System Setup & Security Parameters (`/settings`)
* Organization profile settings, reporting currency selection, notification routing, session timeout, and data retention rules (e.g. 7-year SOX audit log retention).

---

## 9. Reporting & Board Risk Deliverables (All 8 Dynamic Reports)

Located under `/reports`, selecting any report from the left catalog renders a distinct, data-backed deliverable with clean `@media print` formatting:

1. **`RPT-001`: Executive Board Risk Committee Pack:** Gross SLE, critical risk table, KRI threshold scorecard, and CRO sign-off.
2. **`RPT-002`: RCSA Assessment Lifecycle Summary:** Department-wise cycle progression (Setup $\rightarrow$ Identify $\rightarrow$ Controls $\rightarrow$ Monitor).
3. **`RPT-003`: SOX Section 404 Control Test Workpapers:** Internal Controls Over Financial Reporting (ICFR) testing matrix with design/operating scores.
4. **`RPT-004`: Immutable Audit Trail Ledger (SOX):** Complete chronological event log with user attribution.
5. **`RPT-005`: Key Risk Indicator (KRI) Threshold Register:** Comprehensive telemetry register showing green/amber/red boundaries and current values.
6. **`RPT-006`: Control Effectiveness & Residual Risk Report:** Inherent to residual risk step-down matrix ($L \times I \rightarrow L_{\text{res}} \times I_{\text{res}}$).
7. **`RPT-007`: ISO/IEC 27001 Security Evidence Pack:** Annex A security controls implementation matrix and CISO attestation.
8. **`RPT-008`: Third-Party Vendor Risk Assessment (TPRM):** Vendor criticality tier breakdown, contract spend, and review dates.
* **1-Click Print / Save as PDF:** Custom print stylesheets strip all browser UI, sidebars, and buttons, rendering only the clean, full-width executive report.

---

## 10. Data Ingestion & Migration Tools

* **CSV Bulk Risk Importer:** Accessible in `/rcsa/identification`, allows uploading external spreadsheets with live row preview and validation.
* **Sample CSV Template Exporter:** Pre-mapped spreadsheet format for rapid risk migration.
* **Demo Starter Packs:** One-click pre-population of Fintech, SaaS, or Healthcare assessment cycles in `/rcsa/provisioning`.
* **Fast Persona Switcher:** Top navbar dropdown allowing live role switching without logging out.
* **Quick Tools Drawer:** Floating reviewer toolkit with demo reset, feedback logger, and print triggers.

---

## 11. Backend & Database Architecture

* **Node.js BFF API (`server.js`):** Bounded 8-second circuit-breaker timeout, in-memory shadow store fallback, uppercase Oracle casing (`toOracleCase`), and regex-based input sanitization.
* **Oracle Autonomous Database:** 48 relational entities partitionable into core `PER_*` and telemetry `ERM_*` schemas.
* **Autonomous Audit Triggers (`fix_pericope_erm.sql`):** Uses `PRAGMA AUTONOMOUS_TRANSACTION` to ensure audit writes never abort primary business DML operations.
* **QA Test Suite (`qa_test_suite.mjs`):** 12 automated unit and integration tests verifying scoring bounds, Single Loss Expectancy, multi-factor residual calculations, FAIR Monte Carlo math, and CRUD engines.

---
*Pericope ERM &middot; Final Year Major Project & Enterprise Reference Manual*
