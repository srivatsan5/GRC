import os
import re
import pymupdf

def markdown_to_html(md_text):
    # Convert code blocks
    def repl_code(match):
        code = match.group(1).replace('<', '&lt;').replace('>', '&gt;')
        return f'<div class="code-block"><pre><code>{code.strip()}</code></pre></div>'
    
    text = re.sub(r'```(?:bash|json|sql|javascript|typescript)?\n(.*?)```', repl_code, md_text, flags=re.DOTALL)

    # Convert blockquotes
    def repl_quote(match):
        content = match.group(1).strip().replace('\n> ', ' ')
        return f'<div class="callout"><p>{content}</p></div>'
    text = re.sub(r'^>\s*(.*(?:\n>\s*.*)*)', repl_quote, text, flags=re.MULTILINE)

    # Convert math equations
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

    # Inline formatting
    res_html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', res_html)
    res_html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', res_html)
    res_html = re.sub(r'`(.*?)`', r'<code class="inline-code">\1</code>', res_html)
    res_html = res_html.replace('—', '&mdash;').replace('–', '&ndash;').replace('·', '&middot;').replace('→', '&rarr;')

    return res_html


def create_page(doc, html_body, page_num, total_pages=9):
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
        font-size: 13pt;
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

    # Running Headers & Footers
    page.insert_text(pymupdf.Point(36, 26), "Pericope ERM - Comprehensive Demo Runbook & Technical Defense Manual", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(36, 816), "Confidential - Final Year Major Project & Enterprise Client Manual", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(515, 816), f"Page {page_num} of {total_pages}", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))


def build_detailed_pdf():
    sections = [
        # Page 1: Title, Team, Problem Statement & Executive Overview
        """# Pericope ERM - Master Technical Defense & Demo Manual
**Major Project Title:** A Resilience-First, Three-Tier Architecture for Full-Lifecycle Enterprise Risk Management  
**Authors:** Srivatsan B (1AT23CG104), Raja Vishnu (1AT23CG080), Rithvik R (1AT23CG084), Niranthar M Javagal (1AT23CG071)  
**Academic Guide:** Prof. Veena S, Department of Computer Science & Engineering, Atria Institute of Technology  
**Version:** 3.5 (Detailed Technical Edition)  

---

## 1. Executive Summary & Core Problem Statement

### 1.1 The Industry Problem (The "Spreadsheet Trap")
Over 70% of small to mid-sized enterprises (SMEs) manage their corporate risk registers, control matrices, and compliance tracking using **Microsoft Excel workbooks** and email chains. While spreadsheets are familiar, they introduce critical structural failures:
* **Lack of a Single Source of Truth:** Multiple conflicting workbook versions circulate across departments (Finance, IT, Operations).
* **Disconnected Qualitative and Quantitative Views:** When a control is tested, the 5x5 heatmap is rarely updated, causing reports to drift out of sync with actual organizational exposure.
* **Zero Tamper-Evident Auditability:** Spreadsheets have no native concept of maker-checker segregation of duties or immutable event logs, causing organizations to fail regulatory audits under **SOX Section 404**, **ISO 31000**, and **ISO/IEC 27001**.
* **Prohibitive Cost of Commercial Suites:** Enterprise tools like ServiceNow GRC or RSA Archer cost $50,000+/year and require months of configuration, putting them out of reach for growing teams.

### 1.2 The Solution: Pericope ERM
**Pericope ERM** provides an institutional-grade, full-lifecycle Governance, Risk, and Compliance platform deployed on a lightweight, three-tier architecture over an **Oracle Autonomous Database** schema. It unifies:
* RCSA assessment lifecycle workflows across departments.
* Dual mathematical scoring (S = L x I and Single Loss Expectancy SLE = S x $10,000).
* Open FAIR Monte Carlo probabilistic loss simulation.
* Real-time Key Risk Indicator (KRI) telemetry tracking.
* 1-Click Excel/CSV bulk risk register migration.
* Multi-stage Maker-Checker approval chains and 1-Click Board Pack PDF exports.
""",

        # Page 2: Architecture Deep-Dive & Computer Science Principles
        """## 2. Deep-Dive Architecture & Computer Science Principles

### 2.1 The Three-Tier Resilient System
Pericope ERM is constructed around three decoupled, cooperating tiers rather than a monolithic backend:
* **Tier 1 (Client Presentation Tier):** Next.js 15 App Router + React 19 + TypeScript. Data caching is governed by TanStack Query with a 5-minute TTL. Local state is persisted via a typed `LocalStore` engine supporting cross-tab `storage` event listeners for 9 offline-tolerant modules.
* **Tier 2 (Backend-for-Frontend Gateway - `server.js`):** Node.js Express API proxy providing input sanitization (keyboard-mash rejection), uppercase Oracle case normalization (`toOracleCase`), and a strict 8-second circuit-breaker timeout.
* **Tier 3 (Enterprise Database Tier):** Oracle Autonomous Database (ADW) exposed through Oracle REST Data Services (ORDS) spanning 48 partitioned relational entities.

### 2.2 The In-Memory Shadow Store Fallback Pattern
To eliminate client-side freezing during upstream database latency or network dropouts:
1. When a mutating request (`POST`/`PUT`) is received, the BFF starts an 8-second timer.
2. If ORDS answers within 8 seconds, data is persisted and returned.
3. If ORDS times out or is unreachable, the BFF catches the error, writes the record into an **In-Memory Shadow Store**, assigns a synthetic sequential identifier (`nextId()`), logs the user attribution, and returns a `201 Created` / `200 OK` response with `source: 'shadow'`.
4. **Result:** The user interface never hangs, spinners never freeze, and users continue working seamlessly.

### 2.3 Database Hardening & Autonomous Audit Procedures
In Oracle databases, writing audit logs within the main transaction thread often causes deadlocks or `ORA-04098: trigger is invalid`. If an audit table write fails, Oracle's default behavior rolls back the entire business transaction.

**The Pericope Remediation Fix (`fix_pericope_erm.sql`):**
```sql
CREATE OR REPLACE PROCEDURE ERM_AUDIT_WRITE (
  p_action IN VARCHAR2, p_entity IN VARCHAR2, p_entity_id IN VARCHAR2, p_desc IN VARCHAR2
) AS
  PRAGMA AUTONOMOUS_TRANSACTION;
  v_actor VARCHAR2(200);
BEGIN
  v_actor := NVL(SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER'), USER);
  EXECUTE IMMEDIATE 'INSERT INTO ERM_TRN_AUDIT_LOG (...) VALUES (...)';
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN ROLLBACK; -- Swallowed: Audit failure NEVER breaks business writes
END;
/
```
* **Theoretical Contribution:** `PRAGMA AUTONOMOUS_TRANSACTION` executes the audit insert in an independent transaction thread with its own commit scope.
""",

        # Page 3: Mathematical Risk Engine & Quantification Models
        """## 3. The Mathematical Risk Engine & Quantification Models

### 3.1 Qualitative Composite Score Formula
Likelihood ($L$) and Impact ($I$) are selected from a 5-point ordinal scale ($L, I \\in \\{1, 2, 3, 4, 5\\}$):
$$S = L \\times I \\qquad S \\in [1, 25]$$

#### Severity Band Partitioning:
* **Low Severity (Acceptable):** 1 &le; S &le; 7 (Operates comfortably within risk appetite)
* **Medium Severity (Monitored):** 8 &le; S &le; 11 (Monitored via automated KRI telemetry)
* **High Severity (Elevated):** 12 &le; S &le; 15 (Mandatory mitigation & control testing)
* **Critical Severity (Unacceptable):** 16 &le; S &le; 25 (Immediate Board Risk Committee escalation)

### 3.2 Quantitative Single Loss Expectancy (SLE)
To translate qualitative matrix coordinates into tangible monetary exposure for financial stakeholders:
$$\\text{SLE} = S \\times \\$10{,}000 = (L \\times I) \\times \\$10{,}000 \\quad (\\text{USD})$$

### 3.3 Multi-Factor Residual Risk Weighting
When internal controls are mapped to a risk scenario, the system calculates a **Composite Control Effectiveness Factor (eta)**:
$$\\text{eta} = \\frac{\\text{Design (1-5)} \\times \\text{Operating (1-5)}}{25} \\in [0.04, 1.0]$$

The residual likelihood ($L_{\\text{res}}$), residual impact ($I_{\\text{res}}$), and net residual exposure are computed mathematically:
$$L_{\\text{res}} = \\max\\left(1, \\; \\text{round}\\left(L_{\\text{inh}} \\times (1 - 0.7 \\times \\text{eta})\\right)\\right)$$
$$I_{\\text{res}} = \\max\\left(1, \\; \\text{round}\\left(I_{\\text{inh}} \\times (1 - 0.5 \\times \\text{eta})\\right)\\right)$$
$$\\text{Residual Score } (S_{\\text{res}}) = L_{\\text{res}} \\times I_{\\text{res}}$$
$$\\text{Residual SLE} = S_{\\text{res}} \\times \\$10{,}000$$

### 3.4 Open FAIR Probabilistic Monte Carlo Simulation Engine
1. **Loss Event Frequency (LEF):** Modeled as a **Poisson Process** with parameter &lambda; = (L / 5) * 2.5 annual events.
2. **Loss Magnitude (LM):** Modeled as a **Lognormal Distribution** using the Box-Muller transform:
   $$Z = \\sqrt{-2\\ln(U_1)} \\cos(2\\pi U_2) \\implies \\text{Magnitude} = \\text{SLE} \\times \\exp(0.4 Z - 0.08)$$
3. **10,000 Iteration Loop:** Simulates 10,000 operational years to compute **Annualized Loss Expectancy (ALE)** and **95% Value at Risk (VaR 95)**.
""",

        # Page 4: Track A (Academic Viva Blueprint)
        """## 4. Track A: Academic Project Defense (20-Minute Viva Blueprint)

| Timeline | Phase & Screen | Key Theoretical Points to Explain |
| :--- | :--- | :--- |
| **0:00 - 3:00** | **1. Problem Statement & Motivation** | • Spreadsheets lack segregation of duties, audit trails, and automated residual calculations.<br>• Commercial tools (ServiceNow, RSA Archer) cost $50k+/year and take months to deploy.<br>• Pericope ERM bridges this gap with a single-schema, three-tier cloud-native design. |
| **3:00 - 7:00** | **2. 3-Tier Resilient Architecture** | • **Tier 1 (Client):** Next.js 15 App Router + TanStack Query caching + LocalStore offline engine.<br>• **Tier 2 (BFF API):** Node.js Express proxy with 8s bounded timeout, keyboard-mash sanitization, and in-memory shadow store fallback.<br>• **Tier 3 (Database):** Oracle Autonomous Database (ADW) exposed through ORDS REST endpoints. |
| **7:00 - 11:00** | **3. Mathematical Scoring Engine** | • **Qualitative Model:** S = L x I in [1, 25] mapped to 4 severity bands.<br>• **Quantitative Exposure:** SLE = S x $10,000 (Single Loss Expectancy in USD).<br>• **Multi-Factor Residual Formula:** eta = (Design x Operating) / 25, calculating actual risk reduction.<br>• **FAIR Monte Carlo Simulation:** 10,000 iterations computing Annualized Loss Expectancy (ALE) and 95% Value at Risk (VaR). |
| **11:00 - 15:00** | **4. Database Hardening & Remediation** | • Show `db/fix_pericope_erm.sql`.<br>• Explain how ORA-04098 invalid trigger was resolved using **autonomous transactions (PRAGMA AUTONOMOUS_TRANSACTION)** so audit logging never aborts business DML.<br>• Explain sequence auto-resync (STEP 6B) preventing ORA-00001 PK collision. |
| **15:00 - 18:00** | **5. RBAC & SOX 404 Auditability** | • Show `X-User-*` header attribution.<br>• Demonstrate live role switching: **Auditor (Lin Wei)** gets read-only view with immutable audit log; **Manager (Priya Sharma)** has approval authority. |
| **18:00 - 20:00** | **6. Conclusion & Viva Q&A** | • Summarize research paper findings, performance benchmarks, and answer panel questions. |
""",

        # Page 5: Track B (Enterprise Client Pitch)
        """## 5. Track B: Enterprise Client Sales Demo (15-Minute Business Pitch)

| Timeline | Phase & Screen | Client Value Proposition |
| :--- | :--- | :--- |
| **0:00 - 2:00** | **1. Executive Cockpit (/dashboard)** | *"Here is the Executive Dashboard showing gross financial exposure ($SLE), control effectiveness (78%), and active RCSA cycles at a glance."* |
| **2:00 - 5:00** | **2. Excel / CSV Migration (/rcsa/identification)** | *"You don't need to rebuild your registers. Download our CSV template or upload your existing spreadsheets directly into Pericope with instant validation."* |
| **5:00 - 8:00** | **3. 5x5 Heatmap & Residual Step-down (/heatmaps)** | *"Watch how risks are plotted across likelihood and impact. Switch between Inherent, Residual, and Trend views to see how internal controls reduce monetary exposure."* |
| **8:00 - 11:00** | **4. Continuous KRI Telemetry (/kri)** | *"Simulate an operational spike in IT outage hours from 4.0 to 14.5. Watch the indicator turn Red, trigger an alert, and log an immutable audit event."* |
| **11:00 - 13:00** | **5. SOX 404 RBAC & Audit Trail (/audit-trail)** | *"Demonstrate Segregation of Duties. Switch to Auditor persona &mdash; notice all create/delete buttons disappear and the full historical event log is accessible."* |
| **13:00 - 15:00** | **6. 1-Click Board Risk Pack (/reports)** | *"Click 'Print / Save as PDF' on the Executive Board Pack to generate a formatted quarterly risk committee deck."* |
""",

        # Page 6: Live Walkthrough (Scenes 1-4)
        """## 6. Click-by-Click Live Demonstration Walkthrough

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
2. Click **"Open &rarr;"** on any assessment (e.g. `RCSA-1601` Finance & Treasury) &rarr; opens direct Assessment Details page (`/rcsa/provisioning/[id]`).
   * Displays the linked risks for that exact assessment.
   * Click **"Map Controls &rarr;"** on any risk &rarr; opens applied controls page to evaluate and mitigate the risk.
3. Click **"Next Stage: Identify &rarr;"** or open `/rcsa/identification`.
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

        # Page 7: Live Walkthrough (Scenes 5-7)
        """## 6. Live Demonstration Walkthrough (Continued)

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

        # Page 8: Viva & Client Q&A Defense Bank (Q1-Q6)
        """## 7. Comprehensive Viva & Client Q&A Defense Bank (Part 1)

### Q1: What makes your application "resilience-first"?
> **Answer:** *"Most web applications crash or freeze if their database times out. Pericope ERM implements an 8-second circuit breaker in the Node.js BFF (`server.js`). If Oracle ORDS fails or is slow, the BFF serves requests from an in-memory shadow store with synthetic IDs. Furthermore, client-side modules in `lib/localStore.ts` utilize browser localStorage with multi-tab storage listeners, allowing risk managers to continue working even during complete network outages."*

### Q2: Why is Single Loss Expectancy (SLE) better than traditional scoring?
> **Answer:** *"Traditional GRC tools give ordinal scores like '16' or 'Red', which mean nothing to a CFO or Board of Directors. By formulating SLE = S x $10,000, we translate qualitative matrix coordinates into a tangible financial baseline ($160,000). This allows leadership to perform cost-benefit analysis on control investments (e.g. spending $20,000 on a control to mitigate $120,000 in risk)."*

### Q3: How do you prevent audit triggers from crashing business transactions?
> **Answer:** *"In `fix_pericope_erm.sql`, we encapsulated the audit writer procedure `ERM_AUDIT_WRITE` inside `PRAGMA AUTONOMOUS_TRANSACTION`. It executes in a detached transaction thread with its own commit/rollback scope. Any audit logging exception is swallowed, ensuring the primary business operation (creating or editing a risk) is never aborted."*

### Q4: How is Role-Based Access Control (RBAC) enforced?
> **Answer:** *"We enforce RBAC at two distinct boundaries: (1) On the client, React components verify `hasPermission()` from the user's active session, hiding unpermitted buttons; (2) On the API gateway (`server.js`), requests pass through permission middleware checking `X-User-Role` headers and returning HTTP 403 Forbidden for unauthorized actions."*

### Q5: How does your Monte Carlo simulation work?
> **Answer:** *"We run 10,000 iterations modeling loss events as a Poisson process (&lambda;) and loss magnitude as a Lognormal distribution. By aggregating simulated annual losses and sorting them, we compute the 95th percentile Value at Risk (VaR 95) and Annualized Loss Expectancy (ALE)."*

### Q6: Can clients migrate their existing Excel risk registers?
> **Answer:** *"Yes. We built a native CSV spreadsheet parser in `/rcsa/identification`. Users can download our pre-formatted CSV template, paste their existing spreadsheet data, and upload it with instant multi-row preview and validation."*
""",

        # Page 9: Viva & Client Q&A Defense Bank (Q7-Q12) + Database Hardening
        """## 7. Viva & Client Q&A Defense Bank (Part 2)

### Q7: What testing and verification did you perform?
> **Answer:** *"We built an automated test runner (`qa_test_suite.mjs`) containing 12 unit and integration tests covering composite scoring bounds, Single Loss Expectancy, multi-factor residual calculations, FAIR Monte Carlo math, anti-junk keyboard mash heuristics, ORDS response normalizers, and local storage CRUD operations."*

### Q8: How does your system handle input validation and malicious input?
> **Answer:** *"The API gateway applies regex-based anti-junk heuristics (`CONSONANT_RUN` and vowel ratio analysis) to reject keyboard-mash gibberish while permitting valid uppercase acronyms (e.g. `GDPR_SOC2`). All database writes are coerced and whitelisted against approved table schemas."*

### Q9: What happens when records are imported with manual IDs in Oracle?
> **Answer:** *"Manual imports cause Oracle primary-key sequences to fall behind `MAX(UUID)`, resulting in `ORA-00001` unique constraint violations on future inserts. Our script (`fix_pericope_erm.sql`, Step 6B) automatically advances sequences to `MAX(UUID) + 1` to guarantee unique IDs."*

### Q10: How do you support multi-framework compliance?
> **Answer:** *"Our Control Library maps controls across multiple regulatory frameworks simultaneously (e.g. ISO 27001, SOX Section 404, GDPR, and NIST SP 800-53), allowing organizations to test a control once and prove compliance across multiple standards."*

---

## 8. Operational Commands & Verification Cheat-Sheet

* **Start Backend API Server (Port 5000):** `node server.js`
* **Start Frontend Client (Port 3000):** `npm run dev`
* **Execute Automated QA Verification Suite:** `node qa_test_suite.mjs`
* **TypeScript Static Typecheck:** `npx tsc --noEmit`
* **Database Diagnostic Health Check:** `http://localhost:5000/health`
"""
    ]

    doc = pymupdf.open()
    for idx, raw_sec in enumerate(sections):
        html_sec = markdown_to_html(raw_sec)
        create_page(doc, html_sec, idx + 1, len(sections))

    output_path = 'DEMO_RUNBOOK_DETAILED.pdf'
    try:
        doc.save(output_path)
        print(f"Successfully generated {output_path} with {len(doc)} pages!")
    except Exception as e:
        fallback_path = 'PERICOPE_DEMO_RUNBOOK_DETAILED.pdf'
        doc.save(fallback_path)
        print(f"File was locked, saved successfully as {fallback_path} with {len(doc)} pages!")

if __name__ == '__main__':
    build_detailed_pdf()
