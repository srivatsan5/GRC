import os
import re
import pymupdf

def markdown_to_html(md_text):
    def repl_code(match):
        code = match.group(1).replace('<', '&lt;').replace('>', '&gt;')
        return f'<div class="code-block"><pre><code>{code.strip()}</code></pre></div>'
    
    text = re.sub(r'```(?:bash|json|sql|javascript|typescript)?\n(.*?)```', repl_code, md_text, flags=re.DOTALL)

    def repl_quote(match):
        content = match.group(1).strip().replace('\n> ', ' ')
        return f'<div class="callout"><p>{content}</p></div>'
    text = re.sub(r'^>\s*(.*(?:\n>\s*.*)*)', repl_quote, text, flags=re.MULTILINE)

    def repl_math_block(match):
        math_content = match.group(1).strip()
        clean_math = math_content.replace(r'\text{', '<span class="math-text">').replace('}', '</span>')
        clean_math = clean_math.replace(r'\quad', '&nbsp;&nbsp;').replace(r'\qquad', '&nbsp;&nbsp;&nbsp;&nbsp;')
        clean_math = clean_math.replace(r'\times', '&times;').replace(r'\le', '&le;').replace(r'\ge', '&ge;')
        clean_math = clean_math.replace(r'\in', '&isin;').replace(r'\implies', '&rArr;').replace(r'\frac', '')
        clean_math = clean_math.replace(r'\max', 'max').replace(r'\round', 'round').replace(r'\eta', '&eta;').replace(r'\lambda', '&lambda;')
        return f'<div class="math-block">{clean_math}</div>'
    text = re.sub(r'\$\$(.*?)\$\$', repl_math_block, text, flags=re.DOTALL)

    lines = text.split('\n')
    html_lines = []
    in_table = False
    table_rows = []

    def flush_table():
        nonlocal in_table, table_rows, html_lines
        if not in_table or not table_rows:
            return
        html_lines.append('<table class="data-table">')
        for idx, row in enumerate(table_rows):
            if idx == 0:
                html_lines.append('<thead><tr>')
                for cell in row:
                    html_lines.append(f'<th>{cell.strip()}</th>')
                html_lines.append('</tr></thead><tbody>')
            elif idx == 1 and all(c.strip().startswith('-') or c.strip() == '' for c in row):
                continue
            else:
                html_lines.append('<tr>')
                for cell in row:
                    html_lines.append(f'<td>{cell.strip()}</td>')
                html_lines.append('</tr>')
        html_lines.append('</tbody></table>')
        in_table = False
        table_rows = []

    for line in lines:
        stripped = line.strip()

        if stripped.startswith('|') and stripped.endswith('|'):
            in_table = True
            cells = [c for c in stripped.split('|')[1:-1]]
            table_rows.append(cells)
            continue
        elif in_table:
            flush_table()

        if stripped.startswith('# '):
            html_lines.append(f'<h1 class="doc-title">{stripped[2:]}</h1>')
        elif stripped.startswith('## '):
            html_lines.append(f'<h2 class="section-title">{stripped[3:]}</h2>')
        elif stripped.startswith('### '):
            html_lines.append(f'<h3 class="subsection-title">{stripped[4:]}</h3>')
        elif stripped.startswith('---'):
            html_lines.append('<hr class="divider" />')
        elif stripped.startswith('* ') or stripped.startswith('- '):
            html_lines.append(f'<li class="bullet-item">{stripped[2:]}</li>')
        elif re.match(r'^\d+\.\s', stripped):
            html_lines.append(f'<li class="num-item">{stripped[3:]}</li>')
        elif stripped.startswith('<div') or stripped.endswith('</div>'):
            html_lines.append(line)
        elif stripped:
            html_lines.append(f'<p class="para">{stripped}</p>')

    if in_table:
        flush_table()

    res_html = '\n'.join(html_lines)

    res_html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', res_html)
    res_html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', res_html)
    res_html = re.sub(r'`(.*?)`', r'<code class="inline-code">\1</code>', res_html)
    res_html = res_html.replace('—', '&mdash;').replace('–', '&ndash;').replace('·', '&middot;').replace('→', '&rarr;')

    return res_html


def create_page(doc, html_body, page_num, total_pages=8):
    page = doc.new_page(width=595.3, height=841.9) # A4
    
    css = """
    body {
        font-family: sans-serif;
        color: #0f172a;
        font-size: 8pt;
        line-height: 1.32;
        margin: 0;
        padding: 0;
    }
    .doc-title {
        font-size: 13.5pt;
        font-weight: bold;
        color: #1e3a8a;
        margin-top: 0px;
        margin-bottom: 2px;
        border-bottom: 2px solid #1e3a8a;
        padding-bottom: 2px;
    }
    .section-title {
        font-size: 10.5pt;
        font-weight: bold;
        color: #1e40af;
        margin-top: 6px;
        margin-bottom: 3px;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 1px;
    }
    .subsection-title {
        font-size: 9pt;
        font-weight: bold;
        color: #0f172a;
        margin-top: 4px;
        margin-bottom: 2px;
    }
    .para {
        margin-top: 2px;
        margin-bottom: 3px;
        text-align: justify;
    }
    .bullet-item {
        margin-left: 10px;
        margin-top: 1px;
        margin-bottom: 2px;
    }
    .num-item {
        margin-left: 12px;
        margin-top: 1px;
        margin-bottom: 2px;
    }
    .code-block {
        background-color: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        padding: 3px 5px;
        margin: 3px 0px;
        font-family: monospace;
        font-size: 7.5pt;
        line-height: 1.2;
        color: #0f172a;
    }
    .inline-code {
        font-family: monospace;
        background-color: #f1f5f9;
        border: 1px solid #e2e8f0;
        padding: 1px 3px;
        border-radius: 3px;
        font-size: 7.5pt;
        color: #1e40af;
    }
    .callout {
        background-color: #eff6ff;
        border-left: 3px solid #1e40af;
        padding: 4px 6px;
        margin: 3px 0px;
        color: #1e3a8a;
    }
    .math-block {
        background-color: #f8fafc;
        border: 1px solid #cbd5e1;
        border-left: 3px solid #2563eb;
        padding: 3px 6px;
        margin: 3px 0px;
        font-family: monospace;
        font-size: 7.5pt;
        font-weight: bold;
        color: #0f172a;
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 3px 0px;
        font-size: 7.5pt;
        line-height: 1.2;
    }
    .data-table th {
        background-color: #f1f5f9;
        color: #0f172a;
        font-weight: bold;
        text-align: left;
        padding: 3px 4px;
        border: 1px solid #cbd5e1;
    }
    .data-table td {
        padding: 3px 4px;
        border: 1px solid #e2e8f0;
        vertical-align: top;
    }
    .divider {
        border: 0;
        border-top: 1px solid #e2e8f0;
        margin: 4px 0px;
    }
    """

    rect = pymupdf.Rect(36, 36, 559, 795)
    page.insert_htmlbox(rect, html_body, css=css)

    page.insert_text(pymupdf.Point(36, 26), "Pericope ERM - Comprehensive Feature Reference Manual", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(36, 816), "Confidential - Final Year Major Project Documentation", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(515, 816), f"Page {page_num} of {total_pages}", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))


def build_pdf():
    sections = [
        # Page 1: Overview & Executive Dashboard
        """# Pericope ERM - Complete Feature Reference Manual
**Platform:** Pericope Enterprise Risk Management & GRC Suite  
**Authors:** Srivatsan B (1AT23CG104), Raja Vishnu (1AT23CG080), Rithvik R (1AT23CG084), Niranthar M Javagal (1AT23CG071)  
**Institution:** Dept. of Computer Science & Engineering, Atria Institute of Technology  
**Version:** 3.5 (Complete Feature Edition)  

---

## 1. Platform Overview & Core Architecture

Pericope ERM is an enterprise Governance, Risk, and Compliance (GRC) platform built on a three-tier, resilience-first architecture over an **Oracle Autonomous Database** schema. It digitizes the entire risk lifecycle, replacing disconnected Excel spreadsheets with an automated, auditable, and mathematically quantified system of record.

---

## 2. Executive Dashboard (/dashboard)

The Executive Dashboard serves as the central command cockpit for risk leaders and executive management:
* **4 Operational KPI Panels:**
  1. **Active Risks:** Real-time active risk count, highlighting critical severity items.
  2. **Single Loss Expectancy (SLE):** Aggregate monetary exposure ($SLE = S x $10,000).
  3. **Control Coverage:** Percentage of cataloged risks mitigated by active internal controls.
  4. **Assessment Completion:** Proportion of active departmental RCSA cycles completed and attested.
* **Trailing Risk Velocity Chart:** Interactive 6-month area chart modeling risk registration and closure trends.
* **Risk Allocation by Department:** Direct percentage breakdown of risk concentration across IT, Finance, Procurement, Operations, and Legal.
* **Recent Risk Entries Ledger:** High-density data table displaying recently cataloged risks, department scopes, SLE valuations, and direct review links.
""",

        # Page 2: RCSA Lifecycle (Stages 1-4)
        """## 3. RCSA Lifecycle Workflow (4-Stage Stepper)

Pericope ERM guides risk teams through a structured 4-stage assessment workflow:

### Stage 1: Assessment Setup & Provisioning (/rcsa/provisioning)
* **Cycle Provisioning:** Define quarterly and annual assessment cycles by business unit (e.g. `RCSA-FIN-2026-001` for Finance & Treasury).
* **Metadata Parameters:** Assign risk champions, estimated start/end dates, departmental scopes, and lifecycle statuses (Draft, In Progress, Completed).
* **Industry Starter Packs:** 1-Click seeding of pre-configured assessment templates for **Fintech & Banking**, **Cloud/SaaS Security**, and **Healthcare (HIPAA)**.
* **Assessment Details Drilldown (/rcsa/provisioning/[id]):** Directly opens the dedicated workspace for a specific assessment, displaying all connected risks and control mapping actions.

### Stage 2: Risk Identification & Cataloging (/rcsa/identification)
* **Risk Scenario Registration:** Form modal to capture detailed risk statements, categories, departments, Likelihood (1-5), and Impact (1-5).
* **Automated Single Loss Expectancy:** Computes SLE = L x I x $10,000 in real time upon score entry.
* **Bulk Spreadsheet (CSV) Importer:** Native CSV file parser allowing risk teams to drag-and-drop existing Excel risk registers, preview parsed rows, and import them in bulk with instant database validation.
* **Sample CSV Template Generator:** 1-Click download of `pericope_risk_register_template.csv`.

### Stage 3: Mitigation & Control Mapping (/rcsa/mitigation)
* **Departmental Mitigation Overview:** Collapsible department accordion rows displaying control counts and exposure totals.
* **Risk Mitigation Profile (/rcsa/mitigation/[id]):** Deep-dive workspace for a single risk showing inherent vs residual score, risk reduction percentage, mapped controls, and remediation action plans.
* **Applied Controls Mapper (/rcsa/provisioning/[id]/controls/[riskId]):** Tag controls to a specific risk, configure testing frequency (Daily, Weekly, Monthly, Continuous), and set Design (1-5) and Operating (1-5) scores.

### Stage 4: Continuous Risk Monitoring (/rcsa/monitoring)
* **Remediation Action Tracking:** Track milestone deadlines, assigned owners, and percentage completion.
* **Lifecycle Sign-off:** Maker-checker attestation to mark assessment cycles as validated and completed.
""",

        # Page 3: 5x5 Heatmaps & KRI Telemetry
        """## 4. Advanced Risk Analytics & 5x5 Heatmaps (/heatmaps)

* **Bi-Axial Coordinate Grid:**
  * **Vertical Y-Axis (Likelihood):** `5 - Almost Certain (>80%)`, `4 - Likely (50-80%)`, `3 - Possible (20-50%)`, `2 - Unlikely (5-20%)`, `1 - Rare (<5%)`.
  * **Horizontal X-Axis (Impact):** `1 - Insignificant (<$25K)`, `2 - Minor ($25K-$100K)`, `3 - Moderate ($100K-$250K)`, `4 - Major ($250K-$1M)`, `5 - Severe (>$1M)`.
* **Multi-View Modes:**
  1. **Inherent Exposure:** Pre-control gross risk distribution across the 5x5 matrix.
  2. **Residual Risk:** Post-control stepped-down risk distribution showing how controls push risks into the acceptable green zone.
  3. **Risk Velocity:** Trailing trajectory and emerging threats.
* **Interactive Cell Inspection:** Clicking any active cell with numbers opens an inspection dialog listing the exact risk statements, owners, and individual SLE valuations.

---

## 5. Key Risk Indicators (KRI) & Live Telemetry (/kri)

* **Continuous Telemetry Tracking:** Automated threshold monitoring across operational, cyber, financial, and people metrics.
* **Threshold Color Bands:**
  * **Green (Normal):** Below amber boundary.
  * **Amber (Warning):** Approaching risk tolerance limit.
  * **Red (Critical Breach):** Tolerance breached; immediate escalation triggered.
* **Live Reading Simulator & Updater:** Users can click the update icon on any KRI card to log a new measurement (e.g. entering `14.5` hrs for outage hours) and observe the card transition immediately to Red, updating trend lines and logging an audit event.
* **Directional Logic:** Supports both `higher-worse` (e.g. outage hours, CVE count) and `lower-worse` (e.g. cash runway, operating margin) metrics.
""",

        # Page 4: Governance, Controls & Approvals
        """## 6. Governance, Controls & Maker-Checker Workflows

### Control Library & Testing (/control-library)
* **Central Control Register:** Catalog preventive, detective, corrective, and compensating controls.
* **Multi-Framework Tagging:** Tag controls against **ISO/IEC 27001**, **SOX 404**, **GDPR**, **SOC 2**, and **NIST SP 800-53**.
* **Effectiveness Scoring:** Record Design Effectiveness (1-5) and Operating Effectiveness (1-5) testing results.

### Risk Appetite & Tolerance Framework (/risk-appetite)
* **Appetite Statements:** Formal qualitative posture (Averse, Cautious, Open, Hungry) and quantitative thresholds by domain (Strategic, Financial, Operational, Compliance, IT & Cyber).
* **Appetite vs Exposure Gauges:** Real-time visualization comparing active portfolio exposure against Board-approved tolerance limits.

### Maker-Checker Approval Engine (/workflow)
* **Segregation of Duties (SoD):** Multi-step approval chains where assessors submit requests and risk managers/administrators review, approve, or reject with documented comments.
* **Supported Approval Types:** Risk Assessments, Mitigation Plans, Control Changes, Policy Updates, and Formal Risk Acceptances.

### Policy Management Center (/policy)
* **Policy Versioning & Ownership:** Central register of corporate policies, version numbers, effective dates, and review cadences.
* **Acknowledgment Tracking:** Tracks employee acknowledgment compliance percentages.
""",

        # Page 5: Enterprise Risk & Resiliency (TPRM, Incidents, BCP, Scenario FAIR)
        """## 7. Enterprise Risk & Operational Resilience

### Third-Party Risk Management (TPRM) (/vendor-risk)
* **Tiered Vendor Portfolio:** Categorize third-party suppliers into Critical, High, Medium, and Low risk tiers.
* **Contract & Assessment Tracking:** Track contract values, risk scores (1-100), due diligence questionnaire (DDQ) completion, and upcoming audit reviews.

### Incident & Loss Event Tracker (/incidents)
* **Loss Event Logging:** Log operational failures, cyber incidents, and vendor breaches.
* **Root-Cause & Corrective Action Tracking:** Document root-cause investigations, assigned remediation owners, and Mean Time to Resolve (MTTR).

### Business Continuity Planning (BCP / DRP) (/bcp)
* **Disaster Recovery Metrics:** Define Recovery Time Objectives (RTO in hours) and Recovery Point Objectives (RPO in hours) for critical business processes.
* **Testing Cadence:** Monitor test schedules, overdue reviews, and operational failover readiness.

### Scenario Analysis & FAIR Monte Carlo Stress Lab (/scenario)
* **Forward-Looking Shock Simulation:** Model macro and operational shocks (e.g. 20% currency devaluation, cloud region outage, major customer loss).
* **Probabilistic Quantification:** Execute 10,000 Monte Carlo iterations modeling Poisson event frequency and Lognormal loss magnitudes to compute **Annualized Loss Expectancy (ALE)** and **95% Value at Risk (VaR 95)**.
""",

        # Page 6: Audit, Administration & RBAC
        """## 8. Audit, Administration & Security (RBAC)

### Immutable Audit Trail (SOX 404) (/audit-trail)
* **Complete Event Logging:** Captures all creates, updates, deletes, approvals, logins, role changes, and exports with user attribution (`actor_id`, `actor_name`, `actor_role`).
* **Filtering & Export:** Filter by date range, action type, or search term, with 1-click **Export to CSV**.
* **Database Triggers:** Backed by autonomous transaction triggers in Oracle SQL (`fix_pericope_erm.sql`) ensuring audit entries cannot be tampered with or aborted.

### User Management & Role-Based Access Control (/users)
* **5 Standard Enterprise Roles:**
  1. **Administrator:** Full platform control, user management, and system parameters.
  2. **Risk Manager:** RCSA approvals, control testing validation, and KRI threshold configuration.
  3. **Assessor:** Risk identification, inherent and residual assessment scoring (no destructive delete).
  4. **Auditor:** Read-only access to all registers, workpapers, and the immutable audit log.
  5. **Viewer:** Read-only C-suite access to executive dashboards, heatmaps, and reports.
* **Inline Role Assignment:** Administrators can change roles, activate/deactivate accounts, or provision new users.

### System Setup & Security Parameters (/settings)
* Organization profile settings, reporting currency selection, notification routing, session timeout, and data retention rules (e.g. 7-year SOX audit log retention).
""",

        # Page 7: Reporting & Board Deliverables
        """## 9. Reporting & Board Risk Deliverables (/reports)

Selecting any report from the left catalog renders a distinct, data-backed deliverable with clean `@media print` formatting:

1. **RPT-001: Executive Board Risk Committee Pack:** Gross SLE, critical risk table, KRI threshold scorecard, and CRO sign-off.
2. **RPT-002: RCSA Assessment Lifecycle Summary:** Department-wise cycle progression (Setup &rarr; Identify &rarr; Controls &rarr; Monitor).
3. **RPT-003: SOX Section 404 Control Test Workpapers:** Internal Controls Over Financial Reporting (ICFR) testing matrix with design/operating scores.
4. **RPT-004: Immutable Audit Trail Ledger (SOX):** Complete chronological event log with user attribution.
5. **RPT-005: Key Risk Indicator (KRI) Threshold Register:** Comprehensive telemetry register showing green/amber/red boundaries and current values.
6. **RPT-006: Control Effectiveness & Residual Risk Report:** Inherent to residual risk step-down matrix (L x I &rarr; L_res x I_res).
7. **RPT-007: ISO/IEC 27001 Security Evidence Pack:** Annex A security controls implementation matrix and CISO attestation.
8. **RPT-008: Third-Party Vendor Risk Assessment (TPRM):** Vendor criticality tier breakdown, contract spend, and review dates.
* **1-Click Print / Save as PDF:** Custom print stylesheets strip all browser UI, sidebars, and buttons, rendering only the clean, full-width executive report.
""",

        # Page 8: Data Ingestion, Tools & Backend Architecture
        """## 10. Data Ingestion & Migration Tools

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
"""
    ]

    doc = pymupdf.open()
    for idx, raw_sec in enumerate(sections):
        html_sec = markdown_to_html(raw_sec)
        create_page(doc, html_sec, idx + 1, len(sections))

    output_path = 'PERICOPE_FEATURES_GUIDE.pdf'
    doc.save(output_path)
    print(f"Successfully generated {output_path} with {len(doc)} pages!")

if __name__ == '__main__':
    build_pdf()
