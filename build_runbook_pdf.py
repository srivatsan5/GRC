import os
import re
import pymupdf

def markdown_to_html_body(md_text):
    # Convert code blocks
    def repl_code(match):
        code = match.group(1).replace('<', '&lt;').replace('>', '&gt;')
        return f'<div class="code-block"><pre><code>{code.strip()}</code></pre></div>'
    
    text = re.sub(r'```(?:bash|json|sql|javascript|typescript)?\n(.*?)```', repl_code, md_text, flags=re.DOTALL)

    # Convert blockquotes
    def repl_quote(match):
        content = match.group(1).strip()
        return f'<div class="callout"><p>{content}</p></div>'
    text = re.sub(r'^>\s*(.*(?:\n>\s*.*)*)', repl_quote, text, flags=re.MULTILINE)

    # Convert math equations
    def repl_math_block(match):
        math_content = match.group(1).strip()
        clean_math = math_content.replace(r'\text{', '<span class="math-text">').replace('}', '</span>')
        clean_math = clean_math.replace(r'\quad', '&nbsp;&nbsp;').replace(r'\qquad', '&nbsp;&nbsp;&nbsp;&nbsp;')
        clean_math = clean_math.replace(r'\times', '&times;').replace(r'\le', '&le;').replace(r'\ge', '&ge;')
        clean_math = clean_math.replace(r'\in', '&isin;').replace(r'\implies', '&rArr;').replace(r'\frac', '')
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
                continue  # Divider row
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

        # Check for table
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

    # Inline formatting
    res_html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', res_html)
    res_html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', res_html)
    res_html = re.sub(r'`(.*?)`', r'<code class="inline-code">\1</code>', res_html)
    res_html = res_html.replace('—', '&mdash;').replace('–', '&ndash;').replace('·', '&middot;').replace('→', '&rarr;')

    return res_html


def create_page_layout(doc, section_html, page_num):
    page = doc.new_page(width=595.3, height=841.9) # A4
    
    # CSS Stylesheet for PyMuPDF HTML renderer
    css = """
    body {
        font-family: sans-serif;
        color: #0f172a;
        font-size: 8.5pt;
        line-height: 1.35;
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
        font-size: 9.5pt;
        font-weight: bold;
        color: #0f172a;
        margin-top: 5px;
        margin-bottom: 2px;
    }
    .para {
        margin-top: 2px;
        margin-bottom: 3px;
        text-align: justify;
    }
    .bullet-item {
        margin-left: 12px;
        margin-top: 1px;
        margin-bottom: 2px;
    }
    .num-item {
        margin-left: 14px;
        margin-top: 2px;
        margin-bottom: 2px;
    }
    .code-block {
        background-color: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        padding: 4px 6px;
        margin: 3px 0px;
        font-family: monospace;
        font-size: 7.5pt;
        line-height: 1.25;
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
        padding: 4px 8px;
        margin: 3px 0px;
        color: #1e3a8a;
        font-style: italic;
    }
    .math-block {
        background-color: #f8fafc;
        border: 1px solid #cbd5e1;
        border-left: 3px solid #2563eb;
        padding: 4px 8px;
        margin: 4px 0px;
        font-family: monospace;
        font-size: 8pt;
        font-weight: bold;
        color: #0f172a;
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 4px 0px;
        font-size: 7.5pt;
        line-height: 1.25;
    }
    .data-table th {
        background-color: #f1f5f9;
        color: #0f172a;
        font-weight: bold;
        text-align: left;
        padding: 3px 5px;
        border: 1px solid #cbd5e1;
    }
    .data-table td {
        padding: 3px 5px;
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
    page.insert_htmlbox(rect, section_html, css=css)

    # Running Header & Footer
    page.insert_text(pymupdf.Point(36, 26), "Pericope ERM - Master Demo Runbook & Academic Defense Guide", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(36, 816), "Confidential - Final Year Major Project & Client Runbook", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(525, 816), f"Page {page_num} of 7", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))


def build_pdf():
    sections_raw = [
        # Page 1
        """# Pericope ERM - Master Demo Runbook & Defense Guide
**Major Project Authors:** Srivatsan B (1AT23CG104), Raja Vishnu (1AT23CG080), Rithvik R (1AT23CG084), Niranthar M Javagal (1AT23CG071)  
**Academic Guide:** Prof. Veena S, Department of Computer Science & Engineering, Atria Institute of Technology  
**Version:** 3.2 (Production & Defense Edition)  

---

## 1. Executive Summary & Product Positioning

### Academic Defense Positioning:
> Pericope ERM is a three-tier, resilience-first web application for full-lifecycle Enterprise Risk Management (ERM). It digitizes risk identification, qualitative/quantitative scoring, control mitigation, KRI telemetry, maker-checker approval workflows, and immutable audit logging over an Oracle Autonomous Database via Oracle REST Data Services (ORDS). The core contribution lies in its dual mathematical risk model (S = L x I and Single Loss Expectancy SLE = S x $10,000), an in-memory shadow store fallback architecture, and a database hardening layer with autonomous transactions.

### Enterprise Client Value Proposition:
> Most mid-sized organizations manage critical risk registers out of disconnected Excel spreadsheets and email chains. This creates compliance blindspots, untracked residual risk, and failed SOX/ISO audits. Pericope ERM automates the entire RCSA workflow, allows 1-click migration of your existing Excel risk registers, gives real-time telemetry alerts on operational threshold breaches, and exports board-ready risk packs in 1 click.

---

## 2. Pre-Demo Technical Checklist (5-Minute Setup)

* **Step 1: Start Backend BFF Server (Port 5000):**
```bash
node server.js
```
*Output Confirmation:* `Pericope ERM BFF API on http://localhost:5000 | Upstream ORDS: 48 endpoints ready`

* **Step 2: Start Frontend Application (Port 3000):**
```bash
npm run dev
```
*Open Browser:* `http://localhost:3000`

* **Step 3: Run Automated QA Test Suite (Proof of Verification):**
```bash
node qa_test_suite.mjs
```
*Result:* **12/12 Passed** (Validates mathematical bounds, FAIR Monte Carlo math, anti-junk sanitizers, ORDS normalizers, and local storage CRUD engines).
""",

        # Page 2
        """## 3. Track A: Academic Major Project Defense (20 Minutes)

| Timeline | Phase & Screen | Key Technical Points to Explain |
| :--- | :--- | :--- |
| **0:00 - 3:00** | **1. Problem Statement & Motivation** | • Spreadsheets lack segregation of duties, audit trails, and automated residual calculations.<br>• Commercial tools (ServiceNow, RSA Archer) cost $50k+/year and take months to deploy.<br>• Pericope ERM bridges this gap with a single-schema, three-tier cloud-native design. |
| **3:00 - 7:00** | **2. 3-Tier Resilient Architecture** | • **Tier 1 (Client):** Next.js 15 App Router + TanStack Query caching + LocalStore offline engine.<br>• **Tier 2 (BFF API):** Node.js Express proxy with 8s bounded timeout, keyboard-mash sanitization, and in-memory shadow store fallback.<br>• **Tier 3 (Database):** Oracle Autonomous Database (ADW) exposed through ORDS REST endpoints. |
| **7:00 - 11:00** | **3. Mathematical Scoring Engine** | • **Qualitative Model:** S = L x I in [1, 25] mapped to 4 severity bands.<br>• **Quantitative Exposure:** SLE = S x $10,000 (Single Loss Expectancy in USD).<br>• **Multi-Factor Residual Formula:** eta = (Design x Operating) / 25, calculating actual risk reduction.<br>• **FAIR Monte Carlo Simulation:** 10,000 iterations computing Annualized Loss Expectancy (ALE) and 95% Value at Risk (VaR). |
| **11:00 - 15:00** | **4. Database Hardening & Remediation** | • Show `db/fix_pericope_erm.sql`.<br>• Explain how ORA-04098 invalid trigger was resolved using **autonomous transactions (PRAGMA AUTONOMOUS_TRANSACTION)** so audit logging never aborts business DML.<br>• Explain sequence auto-resync (STEP 6B) preventing ORA-00001 PK collision. |
| **15:00 - 18:00** | **5. RBAC & SOX 404 Auditability** | • Show `X-User-*` header attribution.<br>• Demonstrate live role switching: **Auditor (Lin Wei)** gets read-only view with immutable audit log; **Manager (Priya Sharma)** has approval authority. |
| **18:00 - 20:00** | **6. Conclusion & Viva Q&A** | • Summarize research paper findings, performance benchmarks, and answer panel questions. |
""",

        # Page 3
        """## 4. Track B: Enterprise Client Sales Demo (15 Minutes)

| Timeline | Phase & Screen | Client Value Proposition |
| :--- | :--- | :--- |
| **0:00 - 2:00** | **1. Executive Cockpit (/dashboard)** | *"Here is the Executive Dashboard showing gross financial exposure ($SLE), control effectiveness (78%), and active RCSA cycles at a glance."* |
| **2:00 - 5:00** | **2. Excel / CSV Migration (/rcsa/identification)** | *"You don't need to rebuild your registers. Download our CSV template or upload your existing spreadsheets directly into Pericope with instant validation."* |
| **5:00 - 8:00** | **3. 5x5 Heatmap & Residual Step-down (/heatmaps)** | *"Watch how risks are plotted across likelihood and impact. Switch between Inherent, Residual, and Trend views to see how internal controls reduce monetary exposure."* |
| **8:00 - 11:00** | **4. Continuous KRI Telemetry (/kri)** | *"Simulate an operational spike in IT outage hours from 4.0 to 14.5. Watch the indicator turn Red, trigger an alert, and log an immutable audit event."* |
| **11:00 - 13:00** | **5. SOX 404 RBAC & Audit Trail (/audit-trail)** | *"Demonstrate Segregation of Duties. Switch to Auditor persona &mdash; notice all create/delete buttons disappear and the full historical event log is accessible."* |
| **13:00 - 15:00** | **6. 1-Click Board Risk Pack (/reports)** | *"Click 'Print / Save as PDF' on the Executive Board Pack to generate a formatted quarterly risk committee deck."* |
""",

        # Page 4
        """## 5. Click-by-Click Live Demonstration Script

### Scene 1: Multi-Mode Corporate Sign-In
1. Navigate to `http://localhost:3000`. If logged in, click user menu &rarr; **Sign out**.
2. **Talking Point:** *"Pericope supports standard corporate credentials, Enterprise SSO, and one-click role persona testing."*
3. Click **"Srivatsan B &mdash; Administrator"** or sign in with `srivatsan@pericope.local` / `Demo123!`.

### Scene 2: Executive Dashboard
1. Land on `/dashboard`.
2. Point to the **4 KPI Panels**:
   * **Active Risks:** 18
   * **Single Loss Expectancy (SLE):** $1,280k
   * **Control Coverage:** 78.4%
   * **Assessment Completion:** 67%
3. Hover over the **Trailing Risk Velocity** 6-month area chart.
4. Point to the **Recent Risk Entries** ledger table with direct navigation links.

### Scene 3: RCSA Lifecycle & Bulk Spreadsheet Migration
1. Click **RCSA Hub** &rarr; **01 Setup** (`/rcsa/provisioning`).
   * Point to the Stepper Bar: `01 Setup` &rarr; `02 Identify` &rarr; `03 Mitigation` &rarr; `04 Monitoring`.
   * Click **"Demo starter packs"** &rarr; select **"Fintech & Banking Pack"** to demonstrate instant industry seeding.
2. Click **"Next Stage: Identify &rarr;"** or open `/rcsa/identification`.
   * Click **"CSV Template"** &rarr; browser downloads `pericope_risk_register_template.csv`.
   * Click **"Import CSV"** &rarr; select any sample `.csv` &rarr; preview table displays parsed statements, likelihood, impact, and SLE.
   * Click **"Import Risks"** &rarr; toast confirms successful bulk import into database.

### Scene 4: Interactive 5x5 Risk Heatmap
1. Navigate to **Risk Analytics** &rarr; **5x5 Risk Heatmaps** (`/heatmaps`).
2. Point out the clear coordinate axes:
   * **Y-Axis (Likelihood):** `5 - Almost Certain` down to `1 - Rare`.
   * **X-Axis (Impact):** `1 - Insignificant` up to `5 - Severe`.
3. Toggle between **Inherent Exposure**, **Residual (Post-Control)**, and **Risk Velocity**.
4. Click on any active cell with numbers &rarr; dialog modal opens listing the exact risk scenarios mapped to that score.
""",

        # Page 5
        """## 5. Live Demonstration Script (Continued)

### Scene 5: Continuous KRI Telemetry & Breach Alert Simulation
1. Navigate to **Key Risk Indicators** (`/kri`).
2. Point to the 4 operational metric cards (*Tracked indicators, Normal, Warnings, Red Breaches*).
3. Find **"Unplanned IT Outage Hours"** (current value: 7.2 hrs/mo, status: Amber).
4. Click the **Refresh/Update icon** &rarr; input value `14.5` &rarr; click **Update**.
5. **Observe:**
   * Status badge turns **Critical / Breach (Red)**.
   * The mini trend line plots the new peak above the red reference line.
   * Audit trail automatically captures the event.

### Scene 6: Role-Based Access Control (RBAC) & Auditor Mode
1. Open the top-right User Dropdown menu.
2. Click **"Lin Wei (Auditor)"**.
3. **Observe:**
   * Amber banner appears: *"Auditor mode (read-only): You have view access to all records, control workpapers, and the audit log."*
   * Navigate to `/rcsa/identification` or `/control-library` &rarr; notice that "+ Add Risk", "New control", and "Delete" buttons are hidden or disabled.
4. Navigate to **Audit Trail** (`/audit-trail`).
   * Point to the chronological table showing timestamps, actor names, action types (`CREATE`, `UPDATE`, `ROLE_CHANGE`), and results.
   * Click **"Export CSV"** &rarr; exports complete compliance log.

### Scene 7: 1-Click Executive Board Risk Report (PDF)
1. Switch back to **Administrator** or navigate to **Reports** (`/reports`).
2. Select **"Executive Board Risk Committee Pack"** (or click through any of the 8 dynamic reports in the catalog).
3. Point out the 4 structured reporting sections:
   * *1. Executive Exposure Summary*
   * *2. Top High-Exposure Risk Scenarios Table*
   * *3. Key Risk Indicator (KRI) Operational Thresholds*
   * *4. SOX 404 & ISO 31000 Certification Sign-off*
4. Click **"Print / Save as PDF"**.
5. **Point out:** The print preview strips all browser navigation, buttons, and sidebars, rendering only the clean, full-width executive report.
""",

        # Page 6
        """## 6. Anticipated Viva & Client Questions with Model Answers

### Q1 (Academic): How does your system achieve resilience if the Oracle Database/ORDS is slow or unreachable?
> **Answer:** *"Pericope ERM implements an in-memory shadow store inside the Node.js BFF (`server.js`). Upstream ORDS requests have a strict 8-second timeout. If ORDS times out or fails, the BFF transparently answers from the shadow store with synthetic UUIDs, ensuring the user interface never freezes. When connectivity is restored, records reconcile. Additionally, local-first modules in `lib/localStore.ts` utilize browser localStorage with cross-tab event listeners to maintain offline functionality."*

### Q2 (Academic): Why did you choose a dual qualitative and quantitative risk scoring model?
> **Answer:** *"Most enterprises struggle because qualitative 5x5 heatmaps and quantitative dollar estimates are maintained in separate spreadsheets and drift out of sync. In Pericope ERM, every risk entry takes ordinal Likelihood L in [1,5] and Impact I in [1,5], computing the qualitative score S = L x I and the financial exposure SLE = S x $10,000 simultaneously. When controls are mapped, the multi-factor effectiveness factor eta = (Design x Operating)/25 steps down both the heatmap cell and the monetary exposure together."*

### Q3 (Client): We have 200+ risks in Excel right now. How difficult is it to migrate to Pericope?
> **Answer:** *"You can migrate in less than 2 minutes. On the Risk Identification screen, click 'CSV Template' to download our pre-mapped format, paste your columns, and click 'Import CSV'. The system parses the records, validates the data, calculates the SLE exposures, and populates your live register immediately."*

### Q4 (Academic / Security): How do you enforce Segregation of Duties (SoD) and audit compliance?
> **Answer:** *"Every mutating request passes through authentication middleware that attaches user identity headers (X-User-Id, X-User-Name, X-User-Role). The backend enforces server-side role permissions where only Administrators can perform destructive deletes or manage users, Risk Managers approve mitigations, and Auditors are restricted to read-only access. Every event is written using Oracle autonomous transaction triggers (ERM_AUDIT_WRITE) that cannot be rolled back or aborted by business errors."*
""",

        # Page 7
        """## 7. System Architecture & Quantitative Formula Cheat-Sheet

### 1. Qualitative Composite Score:
$$S = L \\times I \\qquad L, I \\in \\{1, 2, 3, 4, 5\\} \\quad \\implies \\quad S \\in [1, 25]$$
* **Low:** 1 &le; S &le; 7
* **Medium:** 8 &le; S &le; 11
* **High:** 12 &le; S &le; 15
* **Critical:** 16 &le; S &le; 25

### 2. Single Loss Expectancy (SLE):
$$\\text{SLE} = L \\times I \\times \\$10{,}000 \\quad (\\text{USD})$$

### 3. Multi-Factor Control Effectiveness & Residual Risk:
$$\\eta = \\frac{\\text{Design Effectiveness (1-5)} \\times \\text{Operating Effectiveness (1-5)}}{25} \\in [0.04, 1.0]$$
$$L_{\\text{res}} = \\max\\left(1, \\; \\text{round}\\left(L_{\\text{inh}} \\times (1 - 0.7 \\times \\eta)\\right)\\right)$$
$$I_{\\text{res}} = \\max\\left(1, \\; \\text{round}\\left(I_{\\text{inh}} \\times (1 - 0.5 \\times \\eta)\\right)\\right)$$
$$\\text{Residual SLE} = L_{\\text{res}} \\times I_{\\text{res}} \\times \\$10{,}000$$

### 4. FAIR Monte Carlo Loss Distribution (10,000 Iterations):
* **Loss Event Frequency (LEF):** Modeled via Poisson Distribution (&lambda; = (L / 5) * 2.5).
* **Loss Magnitude (LM):** Modeled via Lognormal Distribution derived from SLE.
* **Output Metrics:** Annualized Loss Expectancy (ALE) and 95% Value at Risk (VaR 95).

---
### 5. Architectural Verification:
* **Frontend:** Next.js 15 App Router &middot; React 19 &middot; Tailwind CSS &middot; TanStack Query
* **BFF Layer:** Node.js Express API &middot; Bounded 8s Timeout &middot; In-Memory Shadow Store
* **Database:** Oracle Autonomous Database (ADW) &middot; ORDS REST Gateway &middot; PL/SQL Autonomous Triggers
"""
    ]

    doc = pymupdf.open()

    for idx, raw_sec in enumerate(sections_raw):
        html_sec = markdown_to_html_body(raw_sec)
        create_page_layout(doc, html_sec, idx + 1)

    output_path = 'DEMO_RUNBOOK.pdf'
    doc.save(output_path)
    print(f"Successfully generated {output_path} with {len(doc)} pages!")

if __name__ == '__main__':
    build_pdf()
