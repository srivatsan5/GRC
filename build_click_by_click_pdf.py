import os
import re
import pymupdf

def markdown_to_html(md_text):
    def repl_code(match):
        code = match.group(1).replace('<', '&lt;').replace('>', '&gt;')
        return f'<div class="code-block"><pre><code>{code.strip()}</code></pre></div>'
    
    text = re.sub(r'```(?:bash|json|sql|javascript|typescript)?\n(.*?)```', repl_code, md_text, flags=re.DOTALL)

    def repl_tree(match):
        tree = match.group(1).replace('<', '&lt;').replace('>', '&gt;')
        return f'<div class="tree-block"><pre><code>{tree.strip()}</code></pre></div>'
    text = re.sub(r'```\n(.*?)```', repl_tree, text, flags=re.DOTALL)

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


def create_page(doc, html_body, page_num, total_pages=11):
    page = doc.new_page(width=595.3, height=841.9) # A4
    
    css = """
    body {
        font-family: sans-serif;
        color: #0f172a;
        font-size: 8pt;
        line-height: 1.34;
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
        margin-top: 5px;
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
    .code-block, .tree-block {
        background-color: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        padding: 3px 5px;
        margin: 3px 0px;
        font-family: monospace;
        font-size: 7.5pt;
        line-height: 1.22;
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

    page.insert_text(pymupdf.Point(36, 26), "Pericope ERM - Master Click-by-Click Live Demonstration Manual", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(36, 816), "Confidential - Final Year Major Project & Enterprise Client Manual", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(515, 816), f"Page {page_num} of {total_pages}", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))


def build_pdf():
    sections = [
        # Page 1: Overview, Credits & 5-Min Pre-Demo Setup
        """# Pericope ERM - Master Click-by-Click Live Demo Manual
**Major Project Title:** Pericope ERM: A Resilience-First, Three-Tier Architecture for Full-Lifecycle Enterprise Risk Management  
**Authors:** Srivatsan B (1AT23CG104), Raja Vishnu (1AT23CG080), Rithvik R (1AT23CG084), Niranthar M Javagal (1AT23CG071)  
**Academic Guide:** Prof. Veena S, Department of Computer Science & Engineering, Atria Institute of Technology  
**Version:** 4.0 (Exhaustive Step-by-Step Edition) &middot; **Target Duration:** 15-20 Minutes  

---

## 1. Executive Summary & Demonstration Objectives

Pericope ERM is an enterprise Governance, Risk, and Compliance (GRC) software system designed to replace fragmented spreadsheets with an automated, auditable, and mathematically quantified system of record over an Oracle Autonomous Database.

This manual provides an exhaustive, screen-by-screen, click-by-click script for presenting the system during your **Academic Major Project Defense Examination** and during **Enterprise Client Demos**.

---

## 2. Pre-Demo 5-Minute Setup Checklist

Before beginning your demonstration, execute these terminal commands:

* **Terminal 1: Start Backend API Server (Port 5000):**
```bash
node server.js
```
*Expected Output:* `Pericope ERM BFF API running on http://localhost:5000 | 48 endpoints ready`

* **Terminal 2: Start Frontend Next.js Client (Port 3000):**
```bash
npm run dev
```
*Expected Output:* `Ready in http://localhost:3000`

* **Terminal 3: Execute Automated QA Verification Suite:**
```bash
node qa_test_suite.mjs
```
*Expected Output:* **12 PASSED, 0 FAILED (TOTAL 12)** (Validates scoring bounds, FAIR Monte Carlo math, anti-junk sanitizers, and CRUD engines).
""",

        # Page 2: Module 1 — Login & Multi-Mode Auth
        """## 3. Module 1: Corporate Sign-In & Authentication Portal (/login)

### Step 1.1: Open Browser to http://localhost:3000
* **What appears on screen:** A clean, restrained enterprise login portal with the Pericope ERM shield badge.
* **Click action:** If already logged in, click your user profile menu in the top-right corner &rarr; select **"Sign out"**.
* **What to say:** *"Pericope ERM provides a multi-mode enterprise authentication gateway supporting standard corporate credentials, enterprise single sign-on (SSO), and role-based persona testing."*

### Step 1.2: Demonstrate One-Click Persona Login
* **Click action:** Under the "Or sign in as" section, click **"Srivatsan B &mdash; Administrator (Risk Office)"**.
* **What happens in code:**
  1. An active session token is generated.
  2. `sessionStorage` is populated with user attribution headers (`X-User-Id: U-001`, `X-User-Role: Administrator`, `X-User-Name: Srivatsan B`).
  3. A login event is logged to the immutable audit trail.
  4. The router navigates directly to `/dashboard`.
* **What to say:** *"Notice how seamlessly role context is assigned. For this demonstration, we will explore the system as an Administrator with full operational and governance permissions."*

---

### Step 1.3: Alternative Authentication Modes (Optional to Mention)
* **Credentials Mode:** Standard email/password validation (`srivatsan@pericope.local` / `Demo123!`).
* **Enterprise SSO:** Federated SAML 2.0 / OIDC identity assertions for Azure AD and Okta.
""",

        # Page 3: Module 2 — Executive Dashboard
        """## 4. Module 2: Executive Risk Dashboard (/dashboard)

### Step 2.1: Inspect the 4 Operational KPI Panels
* **What appears on screen:**
  1. **Active Risks:** `18` (highlighting high and critical severity exposure count).
  2. **Single Loss Expectancy (SLE):** `$1,280k` (gross aggregated monetary exposure).
  3. **Control Coverage:** `78.4%` (percentage of active risks mitigated by controls).
  4. **Assessment Completion:** `67%` (progress across active quarterly assessment cycles).
* **What to say:** *"Here is the Executive Dashboard. Unlike traditional spreadsheets that only provide subjective traffic-light colors, Pericope ERM translates risk coordinates into a tangible financial figure: Single Loss Expectancy (SLE = Score x $10,000)."*

### Step 2.2: Hover Over the Trailing Risk Velocity Area Chart
* **Action:** Move your cursor across the 6-month risk trend area chart.
* **What appears on screen:** Interactive tooltips displaying exact active risk volumes from November 2025 through April 2026.
* **What to say:** *"This area chart visualizes organizational risk velocity over trailing months, giving leadership visibility into whether risk exposure is expanding or contracting."*

### Step 2.3: Review Departmental Allocation & Recent Risk Entries
* **Action:** Inspect the **"Risks by department"** breakdown (IT: 35%, Finance: 28%, TPRM: 22%, Legal: 15%) and the **"Recent risk entries"** table.
* **Click action:** Click **"View all"** on the recent risk table to navigate to the live risk register.
""",

        # Page 4: Module 3 — RCSA Stage 1: Setup & Provisioning
        """## 5. Module 3: RCSA Stage 1 &mdash; Assessment Provisioning (/rcsa/provisioning)

### Step 3.1: Navigate to Assessment Setup
* **Click action:** In the sidebar or top navigation, click **"RCSA" &rarr; "Provisioning & Setup"** (`/rcsa/provisioning`).
* **What appears on screen:** The 4-stage lifecycle stepper (`01 Setup` &rarr; `02 Identification` &rarr; `03 Mitigation` &rarr; `04 Monitoring`) and the table of active assessment cycles.

### Step 3.2: Demonstrate One-Click Industry Starter Packs
* **Click action:** Click the **"Demo starter packs"** dropdown menu in the top-right toolbar.
* **Click action:** Select **"Fintech & Banking Pack"** (or SaaS Cloud Security Pack).
* **What happens in code:** The system automatically seeds 3 departmental assessment cycles with pre-mapped codes (`RCSA-FIN-2026-001`, `RCSA-AML-2026-002`, `RCSA-PAY-2026-003`).
* **What to say:** *"For rapid onboarding, Pericope includes industry starter templates that instantly seed regulatory assessment frameworks for banking, cloud security, or healthcare."*

### Step 3.3: Direct Assessment Drilldown
* **Click action:** Click **"Open &rarr;"** on any assessment row (e.g. `RCSA-1601 Finance & Treasury`).
* **What appears on screen:** Direct navigation to `/rcsa/provisioning/[id]` (Assessment Details).
* **What to say:** *"Notice that clicking 'Open' takes you directly into the dedicated workspace for this specific assessment, showing its scope, risk champion, and connected risks."*
""",

        # Page 5: Module 4 — RCSA Stage 2: Identification & CSV Import
        """## 6. Module 4: RCSA Stage 2 &mdash; Risk Identification & Bulk Migration (/rcsa/identification)

### Step 4.1: Navigate to Risk Identification Register
* **Click action:** Click **"02 Identification"** on the stepper bar or open `/rcsa/identification`.
* **What appears on screen:** The complete enterprise risk register with search bar, exposure totals, and action buttons.

### Step 4.2: Demonstrate Bulk Spreadsheet Migration (CSV Template & Importer)
* **Click action:** Click **"CSV Template"** in the toolbar &rarr; browser downloads `pericope_risk_register_template.csv` containing standard column headers.
* **Click action:** Click **"Import CSV"** in the toolbar &rarr; Bulk Import modal opens with a drag-and-drop file upload zone and raw CSV text area.
* **Action:** Click the upload zone to select a `.csv` file OR paste sample CSV text:
  `"Cloud database outage during payroll","IT & Cyber","IT",4,4,"Anthony Muller"`
* **Click action:** Click **"Parse Pasted CSV"** (or let file upload parse automatically) &rarr; live multi-row preview table displays calculated Likelihood (4/5), Impact (4/5), and Single Loss Expectancy ($160,000).
* **Click action:** Click **"Import risks into database"** &rarr; toast confirms successful bulk import, and the table updates with new risk records.
* **What to say:** *"This eliminates the biggest barrier for mid-sized organizations. Teams can migrate 200+ risks from Excel into Pericope in under 30 seconds."*

### Step 4.3: Manual Risk Scenario Cataloging
* **Click action:** Click **"+ Add Risk"** button &rarr; enter Risk Statement: *"SWIFT Payment Gateway Latency during Batch Settlement"*, Category: *"Financial"*, Likelihood: *"4 - Likely"*, Impact: *"4 - Major"*, Owner: *"Finance & Treasury"*.
* **Click action:** Click **"Save risk"** &rarr; SLE is calculated as $160,000, record is created, and an audit event is logged.
""",

        # Page 6: Module 5 — RCSA Stage 3: Controls Mapping & Residual Step-Down
        """## 7. Module 5: RCSA Stage 3 &mdash; Controls Mapping & Residual Step-Down (/rcsa/mitigation)

### Step 5.1: Navigate to Mitigation & Controls Overview
* **Click action:** Click **"03 Controls & Mitigation"** on the stepper bar or open `/rcsa/mitigation`.
* **What appears on screen:** Departmental accordion list (Finance & Treasury, IT, Procurement, Legal) with control counts and risk statements.

### Step 5.2: Open Risk Mitigation Profile
* **Click action:** Click **"View Details &rarr;"** on any risk (e.g. *SWIFT Payment Gateway Latency*).
* **What appears on screen:** Direct navigation to `/rcsa/mitigation/[id]` displaying:
  * **Gross Inherent SLE:** $160,000 (Score 16/25 &mdash; Critical)
  * **Net Residual SLE:** $40,000 (Score 4/25 &mdash; Low/Acceptable)
  * **Risk Reduction:** 75% drop in monetary exposure
  * Table of Mapped Mitigating Controls.
* **What to say:** *"Here we see our multi-factor residual calculation in action. The formula evaluates control design and operating effectiveness to mathematically step down both the 5x5 heatmap position and the financial exposure."*

### Step 5.3: Tag a New Control to the Risk
* **Click action:** Click **"Map Controls &rarr;"** or **"+ Add Action Plan"**.
* **Action:** Select control *"CTL-FIN-SOD-07 Maker-checker authorization for payments > $10k"*, set Operating Effectiveness to *"Effective (5/5)"*, and save.
""",

        # Page 7: Module 6 & 7 — 5x5 Heatmap & Continuous Monitoring
        """## 8. Module 6 & 7: 5x5 Risk Heatmap (/heatmaps) & Monitoring (/rcsa/monitoring)

### Step 7.1: Navigate to 5x5 Risk Heatmaps
* **Click action:** In the sidebar, click **"Risk Analytics" &rarr; "5x5 Risk Heatmaps"** (`/heatmaps`).
* **What appears on screen:** A high-density 5x5 coordinate matrix with Likelihood (1&ndash;5) on the vertical axis and Impact (1&ndash;5) on the horizontal axis.

### Step 7.2: Toggle Multi-View Modes
* **Click action:** Click **"Inherent"** &rarr; Matrix displays gross pre-control risk distribution.
* **Click action:** Click **"Residual"** &rarr; Matrix displays post-mitigation risk distribution, showing risks stepped down into green and yellow cells.
* **Click action:** Click **"Trend"** &rarr; Matrix displays directional risk velocity.
* **What to say:** *"Notice the clarity of this visualization. It allows executive leadership to see exactly how control investments reduce risk exposure across severity bands."*

### Step 7.3: Cell-Level Risk Inspection Dialog
* **Click action:** Click on any active cell with numbers (e.g. Score 16 cell).
* **What appears on screen:** A dialog modal opens listing the exact risk statements, owners, and individual SLE dollar figures situated in that cell.

### Step 7.4: Continuous Risk Monitoring (/rcsa/monitoring)
* **Click action:** Click **"04 Monitoring"** on the stepper bar.
* **What appears on screen:** Milestone action plan tracker showing completion percentages and stage sign-off buttons.
""",

        # Page 8: Module 8 — KRI Telemetry Alert Simulator
        """## 9. Module 8: Key Risk Indicators (KRI) & Telemetry Alert Simulator (/kri)

### Step 8.1: Navigate to KRI Intelligence
* **Click action:** In the sidebar, click **"Risk Analytics" &rarr; "Key Risk Indicators"** (`/kri`).
* **What appears on screen:** 4 telemetry summary tiles (*Total KRIs, Normal/Green, Warnings/Amber, Breaches/Red*) and a grid of KRI cards with sparkline trend lines.

### Step 8.2: Simulate an Operational Threshold Breach
* **Action:** Locate the card for **"Unplanned IT Outage Hours"** (current value: 7.2 hrs/mo, status: Amber).
* **Click action:** Click the **Refresh/Update icon** on the card.
* **Action:** In the "New value" input box, type `14.5` and click **"Update"**.
* **What happens in code:**
  1. The status badge immediately flips to **"Breach (Red)"**.
  2. The card border highlights in red.
  3. The mini trend line plots the new peak above the red threshold reference line.
  4. An automated audit event is logged with user attribution.
* **What to say:** *"This demonstrates continuous automated GRC. When an operational metric breaches tolerance, the system triggers an alert, records an immutable audit entry, and escalates the finding."*
""",

        # Page 9: Module 9 & 10 — Governance, TPRM, Incidents & Scenario Lab
        """## 10. Module 9 & 10: Governance, TPRM & Scenario Stress Lab

### Step 9.1: Control Library (/control-library)
* **Click action:** Open **"Controls & Policy" &rarr; "Control Library"**.
* **What appears on screen:** Multi-standard control register mapped across ISO 27001, SOX Section 404, GDPR, and NIST.
* **What to say:** *"Organizations can test a control once and prove compliance across multiple standards simultaneously."*

### Step 9.2: Third-Party Vendor Risk Management (/vendor-risk)
* **Click action:** Open **"Enterprise Risk" &rarr; "Vendor Risk (TPRM)"**.
* **What appears on screen:** Tiered vendor register (Critical, High, Medium, Low), contract values, risk scores (1&ndash;100), and review cadences.

### Step 9.3: Scenario Analysis & FAIR Monte Carlo Stress Lab (/scenario)
* **Click action:** Open **"Enterprise Risk" &rarr; "Scenario Analysis"**.
* **What appears on screen:** Macroeconomic and operational shock models (e.g. 20% Currency Devaluation, Cloud Region Outage).
* **Click action:** Click **"Run"** next to any scenario &rarr; executes 10,000-iteration Monte Carlo simulation computing Annualized Loss Expectancy (ALE) and 95% Value at Risk (VaR 95).
""",

        # Page 10: Module 11 — Approvals & Audit Trail
        """## 11. Module 11: Maker-Checker Approvals (/workflow) & Audit Trail (/audit-trail)

### Step 10.1: Maker-Checker Approval Workflow (/workflow)
* **Click action:** Open **"Controls & Policy" &rarr; "Workflow Approvals"**.
* **What appears on screen:** List of pending approval requests with multi-stage approver chains.
* **Click action:** Click **"Approve"** or **"Reject"** on a pending request &rarr; decision is recorded with user name, timestamp, and audit trail update.

### Step 10.2: Role-Based Access Control (RBAC) & Auditor Mode
* **Action:** Open the top-right user menu and select **"Lin Wei (Auditor)"**.
* **What happens on screen:**
  1. An amber banner appears: *"Auditor mode (read-only): You have view access to all records, control workpapers, and the audit log."*
  2. Navigate to `/rcsa/identification` or `/control-library` &rarr; notice that all "+ Add Risk", "New control", and "Delete" buttons are hidden.
* **What to say:** *"This enforces strict SOX 404 Segregation of Duties. Auditors receive read-only verification access without the ability to mutate operational data."*

### Step 10.3: Autonomous Audit Trail (/audit-trail)
* **Click action:** Open **"Administration" &rarr; "Audit Trail"**.
* **What appears on screen:** Chronological event ledger showing timestamps, actor names, roles, action types (`CREATE`, `UPDATE`, `APPROVE`, `ROLE_CHANGE`), and results.
* **Click action:** Click **"Export CSV"** to download the full compliance ledger.
""",

        # Page 11: Module 12 — Reports & 1-Click Board Pack PDF
        """## 12. Module 12: Executive Reports & 1-Click Board Pack PDF (/reports)

### Step 11.1: Navigate to Reports Catalog
* **Action:** Switch back to **"Srivatsan B (Administrator)"** from the top menu and open **"/reports"**.
* **What appears on screen:** Left catalog containing 8 distinct report templates and a live formatted preview on the right.

### Step 11.2: Demonstrate Dynamic Report Switching
* **Click action:** Click through the report templates on the left panel:
  * `RPT-001`: Executive Board Risk Committee Pack
  * `RPT-002`: RCSA Assessment Lifecycle Summary
  * `RPT-003`: SOX Section 404 Control Test Workpapers
  * `RPT-004`: Immutable Audit Trail Ledger (SOX)
  * `RPT-005`: Key Risk Indicator (KRI) Threshold Register
  * `RPT-006`: Control Effectiveness & Residual Risk Report
  * `RPT-007`: ISO/IEC 27001 Security Evidence Pack
  * `RPT-008`: Third-Party Vendor Risk Assessment (TPRM)
* **What happens:** The right panel dynamically reconfigures, rendering the specific data structures, metrics, and attestation sign-offs for that report.

### Step 11.3: 1-Click Export Board Risk Pack (PDF)
* **Action:** Select **"Executive Board Risk Committee Pack" (RPT-001)** and click **"Print / Save as PDF"**.
* **What to say:** *"Notice that our print stylesheet strips all browser headers, sidebars, search bars, and buttons. Page 1 begins cleanly with the Board Risk Report, executive metrics, risk scenarios table, KRI scorecard, and governance attestation sign-off."*
"""
    ]

    doc = pymupdf.open()
    for idx, raw_sec in enumerate(sections):
        html_sec = markdown_to_html(raw_sec)
        create_page(doc, html_sec, idx + 1, len(sections))

    output_path = 'CLICK_BY_CLICK_DEMO_MANUAL.pdf'
    try:
        doc.save(output_path)
        print(f"Successfully generated {output_path} with {len(doc)} pages!")
    except Exception as e:
        alt_path = 'PERICOPE_CLICK_BY_CLICK_MANUAL.pdf'
        doc.save(alt_path)
        print(f"File locked, saved as {alt_path} with {len(doc)} pages!")

if __name__ == '__main__':
    build_pdf()
