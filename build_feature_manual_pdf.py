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
        font-size: 13pt;
        font-weight: bold;
        color: #1e3a8a;
        margin-top: 0px;
        margin-bottom: 2px;
        border-bottom: 2px solid #1e3a8a;
        padding-bottom: 2px;
    }
    .section-title {
        font-size: 10pt;
        font-weight: bold;
        color: #1e40af;
        margin-top: 5px;
        margin-bottom: 2px;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 1px;
    }
    .subsection-title {
        font-size: 8.5pt;
        font-weight: bold;
        color: #0f172a;
        margin-top: 4px;
        margin-bottom: 1px;
    }
    .para {
        margin-top: 1px;
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
        margin: 3px 0px;
    }
    """

    rect = pymupdf.Rect(36, 36, 559, 795)
    page.insert_htmlbox(rect, html_body, css=css)

    # Running Headers & Footers
    page.insert_text(pymupdf.Point(36, 26), "Pericope ERM - Complete Platform Feature Manual", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(36, 816), "Confidential - Pericope Enterprise Risk Management v3.5", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))
    page.insert_text(pymupdf.Point(515, 816), f"Page {page_num} of {total_pages}", fontsize=7.5, fontname="helv", color=(0.4, 0.45, 0.55))


def build_manual_pdf():
    sections = [
        # Page 1: Overview & Authentication RBAC
        """# Pericope ERM - Complete Platform Feature Manual
**Product:** Pericope Enterprise Risk Management & GRC Suite  
**Platform Version:** 3.5 (Enterprise Edition)  
**Authors:** Srivatsan B, Raja Vishnu, Rithvik R, Niranthar M Javagal  
**Institutional Guide:** Prof. Veena S, Department of CSE, Atria Institute of Technology  

---

## 1. Platform Overview & Design Philosophy

**Pericope ERM** is a full-stack, enterprise-grade Governance, Risk, and Compliance (GRC) software suite. It centralizes risk registers, internal controls, KRI telemetry, and audit workpapers into an auditable system of record.
* **Dual Qualitative & Quantitative Scoring:** Bridges 5x5 heatmap coordinates with monetary Single Loss Expectancy (SLE = S x $10,000).
* **Resilience-First Design:** Bounded 8-second circuit breakers with an in-memory shadow store fallback that guarantees zero user interface freezing.
* **Audit Non-Repudiation:** Real-time user attribution and Oracle autonomous transaction triggers (PRAGMA AUTONOMOUS_TRANSACTION).

---

## 2. Identity, Authentication & Role-Based Access Control (RBAC)

### 2.1 Multi-Mode Authentication Portal (/login)
The authentication screen provides three distinct sign-in methods:
1. **Persona Quick-Select Mode:** 1-click access to 5 pre-configured enterprise job roles for demonstration and RBAC validation.
2. **Corporate Credentials Mode:** Standard email/password entry with client-side and server-side validation.
3. **Enterprise Single Sign-On (SSO):** Simulated federated OIDC / SAML 2.0 integration (Microsoft Entra ID, Okta).

### 2.2 The 5 Enterprise Roles & Access Permissions Matrix

| Role | Default Persona | Department | Permission Scope | Capabilities & Boundaries |
| :--- | :--- | :--- | :---: | :--- |
| **Administrator** | Srivatsan B | Executive Risk Office | `CREATE`, `READ`, `UPDATE`, `DELETE`, `ADMIN` | Full control across all 25 modules. Manage user roles, system parameters, and database sync. |
| **Risk Manager** | Priya Sharma | Finance & Treasury | `CREATE`, `READ`, `UPDATE`, `DELETE` | Operational GRC lead. Approve mitigation plans, validate controls, configure KRI limits. |
| **Assessor** | Anthony Muller | Global Operations | `CREATE`, `READ`, `UPDATE` | Business unit risk owner. Create risks, evaluate likelihood/impact. No destructive delete. |
| **Auditor** | Lin Wei | Internal Audit | `READ` ONLY | Independent reviewer. Access all records, testing workpapers, and immutable audit logs. |
| **Viewer** | Karen Diaz | Executive Office | `READ` ONLY | Executive oversight. View dashboards, heatmaps, and generate board PDF exports. |

### 2.3 User Attribution & Audit Headers
Every mutating API request attaches `X-User-Id`, `X-User-Name`, and `X-User-Role` headers populated from the authenticated session and persisted directly to the audit log.
""",

        # Page 2: Dashboard & RCSA Lifecycle (Step 1 to 3)
        """## 3. Executive Cockpit & Dashboard (/dashboard)

The Executive Dashboard provides an immediate command-center view of the organization's risk posture:
* **4 Operational Metric Tiles:**
  * **Active Risks:** Real-time portfolio totals with high/critical breakdown.
  * **Single Loss Expectancy (SLE):** Aggregate monetary exposure baseline ($/Rs).
  * **Control Coverage:** Percentage of cataloged risks with operating mitigating controls.
  * **RCSA Stage Completion:** Progress across active quarterly assessment cycles.
* **Trailing Risk Velocity Chart:** Interactive 6-month area chart modeling risk registration velocity versus closure rates.
* **Risk Allocation by Function:** Progress bars displaying risk distribution across IT, Finance, Operations, and Compliance.
* **Live RCSA Case Ledger:** High-density table of recent risk statements with immediate deep-link navigation.

---

## 4. RCSA Assessment Lifecycle Hub

### 4.1 Step 1: Cycle Provisioning & Setup (/rcsa/provisioning)
* **Create Assessment Cycles:** Define quarterly assessment scopes (e.g. `RCSA-FIN-2026-001`), department targets, start/end dates, and assign risk champions.
* **Industry Starter Packs:** 1-Click demo seeding for:
  * *Fintech & Banking Pack* (SWIFT settlement latency, AML/KYC review, payment processor availability).
  * *SaaS & Cloud Security Pack* (SOC 2 Type II readiness, AWS multi-region failover, GDPR data pipeline).
  * *Healthcare Compliance Pack* (HIPAA electronic health records security, clinical supply chain).

### 4.2 Step 2: Risk Identification & Cataloging (/rcsa/identification)
* **Risk Statement Entry:** Register operational risk scenarios with Likelihood (1-5) and Impact (1-5) ratings.
* **Automatic Single Loss Calculation:** System dynamically computes SLE = L x I x $10,000.

### 4.3 Bulk Excel/CSV Migration Wizard
* **Download Sample Template:** Generates `pericope_risk_register_template.csv`.
* **Drag-and-Drop Import:** Parses existing spreadsheet columns (Statement, Category, Department, Likelihood, Impact, Owner).
* **Multi-Row Preview Table:** Validates data before executing batch database insertion.

### 4.4 Step 3: Assessment Details & Risk Context (/rcsa/provisioning/[id])
* **Dedicated Assessment View:** Inspects an individual assessment cycle, displaying its specific metadata, active champion, total financial exposure, and connected risk records.
* **Direct Control Mapping Trigger:** Each risk has a **"Map Controls &rarr;"** action navigating directly to the control evaluation screen.
""",

        # Page 3: RCSA Lifecycle (Step 4 to 6) & Analytics
        """## 4. RCSA Lifecycle Hub (Continued)

### 4.5 Step 4: Internal Control Mapping & Residual Scoring (/rcsa/provisioning/[id]/controls/[riskId])
* **Control Tagging:** Map preventive, detective, and corrective controls to a specific risk scenario.
* **Effectiveness Scoring:** Rate Design Effectiveness (1-5) and Operating Effectiveness (1-5).
* **Live Residual Risk Calculation:** Displays immediate exposure reduction percentage (e.g. 75% reduction).

### 4.6 Step 5: Risk Mitigation & Department Overview (/rcsa/mitigation)
* **Departmental Accordion Groups:** Grouped view of all risks by business unit (Finance, IT, Procurement, Retail, Inventory).
* **Individual Mitigation Profile (/rcsa/mitigation/[id]):** In-depth risk mitigation screen showing linked controls, residual score step-down, and action plan creation.

### 4.7 Step 6: Risk Monitoring & Action Plans (/rcsa/monitoring, /monitoring/*)
* **Action Plan Roadmap:** Track remediation milestones, assigned owners, target completion dates, and completion percentages (0-100%).

---

## 5. Risk Analytics & Mathematical Engines

### 5.1 5x5 Enterprise Risk Heatmap Matrix (/heatmaps)
* **Bi-Axial Coordinate Grid:**
  * **Vertical Y-Axis (Likelihood):** `5 - Almost Certain` down to `1 - Rare`.
  * **Horizontal X-Axis (Impact):** `1 - Insignificant` up to `5 - Severe`.
* **Multi-View Modes:** Instant toggle between **1. Inherent Exposure**, **2. Residual (Post-Control)**, and **3. Risk Velocity**.
* **Interactive Cell Inspection:** Click any cell with active numbers to open a modal listing the underlying risk records.

### 5.2 Inherent & Residual Risk Evaluation (/assessments/inherent, /assessments/residual)
* **Root Cause & Causal Factor Analysis:** Capture detailed qualitative narratives, data sources, and affected stakeholders.
* **Mathematical Step-Down:** Compares gross inherent position against net residual exposure after control mitigation.
""",

        # Page 4: Mathematical Models & KRI Engine
        """## 5. Mathematical Engines & Quantification (Continued)

### 5.3 Key Risk Indicators (KRI) Telemetry Engine (/kri, /kri/matrix, /kri/configuration)
* **Threshold Color Bands:** Green (Normal), Amber (Warning Limit), Red (Critical Breach).
* **Live Telemetry Simulator:** Click the update icon on any indicator to input a new reading (e.g. `14.5` hrs) and observe the real-time status change, trend line peak, and audit log generation.

### 5.4 Open FAIR Monte Carlo Simulation Engine (/scenario, oracleService.ts)
* **10,000-Iteration Probabilistic Engine:**
  * Loss Event Frequency (LEF) modeled as a **Poisson distribution** (&lambda; = (L / 5) * 2.5).
  * Loss Magnitude (LM) modeled as a **Lognormal distribution** (&mu;, &sigma;).
  * Outputs **Annualized Loss Expectancy (ALE)** and **95% Value at Risk (VaR 95)**.

---

### 5.5 Quantitative Risk Formulas Reference Sheet

#### 1. Qualitative Composite Score:
$$S = L \\times I \\qquad L, I \\in \\{1, 2, 3, 4, 5\\} \\quad \\implies \\quad S \\in [1, 25]$$
* **Low:** 1 &le; S &le; 7
* **Medium:** 8 &le; S &le; 11
* **High:** 12 &le; S &le; 15
* **Critical:** 16 &le; S &le; 25

#### 2. Single Loss Expectancy (SLE):
$$\\text{SLE} = L \\times I \\times \\$10{,}000 \\quad (\\text{USD})$$

#### 3. Multi-Factor Control Effectiveness & Residual Risk:
$$\\eta = \\frac{\\text{Design Effectiveness (1-5)} \\times \\text{Operating Effectiveness (1-5)}}{25} \\in [0.04, 1.0]$$
$$L_{\\text{res}} = \\max\\left(1, \\; \\text{round}\\left(L_{\\text{inh}} \\times (1 - 0.7 \\times \\eta)\\right)\\right)$$
$$I_{\\text{res}} = \\max\\left(1, \\; \\text{round}\\left(I_{\\text{inh}} \\times (1 - 0.5 \\times \\eta)\\right)\\right)$$
$$\\text{Residual SLE} = L_{\\text{res}} \\times I_{\\text{res}} \\times \\$10{,}000$$
""",

        # Page 5: Governance, Controls & Approvals
        """## 6. Governance, Controls & Approvals

### 6.1 Advanced Control Library (/control-library)
* Central register of internal controls.
* Filter by type: *Preventive*, *Detective*, *Corrective*, *Compensating*.
* Tracks testing frequency (*Continuous*, *Daily*, *Weekly*, *Monthly*, *Quarterly*, *Annual*), control nature (*Automated*, *Manual*, *Hybrid*), and regulatory frameworks (*ISO 27001*, *SOX 404*, *GDPR*).

### 6.2 Risk Appetite & Boundary Framework (/risk-appetite, /appetite/framework)
* Define organizational appetite statements by domain (*Strategic*, *Financial*, *Operational*, *Compliance*, *IT & Cyber*, *Vendor*).
* Posture definitions (*Averse*, *Cautious*, *Open*, *Hungry*) with numerical tolerance limits.

### 6.3 Maker–Checker Approval Workflows (/workflow)
* Multi-step approval chains enforcing Segregation of Duties (SoD).
* Role-restricted Approve and Reject actions with timestamped audit notes.

### 6.4 Policy Management Center (/policy)
* Central governance library with version numbering (e.g. `v3.2`), effective dates, renewal cycles, and employee acknowledgment rates (%).

---

## 7. Enterprise Risk & Operational Resilience

### 7.1 Third-Party Risk Management (TPRM) (/vendor-risk)
* Tiered vendor register (*Critical*, *High*, *Medium*, *Low*).
* Tracks contract spend ($), risk scores (1-100), due diligence dates, and open audit findings.

### 7.2 Incident & Loss Event Management (/incidents)
* Loss event logging linked directly to enterprise risk IDs.
* Tracks severity (*Critical*, *High*, *Medium*, *Low*), status (*Open*, *Investigating*, *Mitigated*, *Closed*), root cause, and corrective actions.

### 7.3 Business Continuity Planning (BCP / DRP) (/bcp)
* Disaster recovery plans with Recovery Time Objective (RTO) and Recovery Point Objective (RPO) in hours.
* Tracks annual testing cadence and overdue review notices.

### 7.4 Scenario Analysis & Stress Testing (/scenario)
* Forward-looking stress testing lab modeling macro shocks (e.g. 20% FX devaluation, 24-hr cloud region outage).
* Compares baseline loss against stressed loss.
""",

        # Page 6: Audit, Administration & 8-in-1 Reports
        """## 8. Audit, Administration & Reports

### 8.1 Immutable Audit Trail (SOX 404) (/audit-trail)
* Chronological event ledger recording: Timestamp, Actor Name, Actor Role, Action Type (`CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `ROLE_CHANGE`), Target Entity, Description, and Result.
* 1-Click CSV Export.

### 8.2 User & Security Administration (/users)
* Administrative console to create users, assign job roles, and toggle account activation.

### 8.3 System Configuration (/settings)
* Organization profile parameters, notification alert routing, session timeout limits, and data retention compliance windows.

### 8.4 8-in-1 Executive Board Risk Reports & PDF Generator (/reports)
The platform includes 8 connected, dynamic report templates:
1. **Executive Board Risk Committee Pack (RPT-001):** Board-level summary, $SLE exposure, top high-exposure risks, and KRI thresholds.
2. **RCSA Assessment Lifecycle Summary (RPT-002):** Departmental progress and stage completion.
3. **SOX Section 404 Control Test Workpapers (RPT-003):** ICFR testing matrix with design and operating effectiveness scores.
4. **Immutable Audit Trail Ledger (RPT-004):** Complete chronological system event log.
5. **Key Risk Indicator (KRI) Threshold Register (RPT-005):** Operational telemetry threshold scorecard.
6. **Control Effectiveness & Residual Risk Report (RPT-006):** Inherent vs Residual step-down matrix and financial reduction metrics.
7. **ISO/IEC 27001 Security Evidence Pack (RPT-007):** Annex A information security control implementation evidence.
8. **Third-Party Vendor Risk Assessment (RPT-008):** TPRM portfolio review and spend criticality inventory.

* **1-Click PDF Export:** Custom print stylesheets strip all browser navigation and headers, rendering only the clean, full-width executive report.
""",

        # Page 7: Resilient 3-Tier Backend & Oracle DB
        """## 9. Resilient 3-Tier Backend & Oracle Database Architecture

### 9.1 Technical Specifications:
* **Frontend:** Next.js 15 App Router &middot; React 19 &middot; Tailwind CSS &middot; TanStack Query
* **BFF API Gateway:** Node.js Express API &middot; Bounded 8s Timeout &middot; In-Memory Shadow Store
* **Database:** Oracle Autonomous Database (ADW) &middot; ORDS REST Gateway (48 Entities) &middot; PL/SQL Autonomous Triggers (`PRAGMA AUTONOMOUS_TRANSACTION`)

### 9.2 The Shadow Store & Circuit Breaker Logic
```
Client Request ---> [ BFF Express Gateway (server.js) ]
                             | (8s Timeout Timer)
               +-------------+-------------+
               | (Success < 8s)            | (Timeout / Failure)
               v                           v
     [ Oracle ADW / ORDS ]        [ In-Memory Shadow Store ]
               |                           | (nextId() synthetic UUID)
               +-------------+-------------+
                             |
                     Returns JSON (200/201)
                     (UI NEVER Freezes!)
```

### 9.3 PL/SQL Autonomous Audit Trigger Fix
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
  WHEN OTHERS THEN ROLLBACK; -- Swallowed: Audit failure NEVER breaks business DML
END;
/
```
""",

        # Page 8: Operational Commands & Verification Testing
        """## 10. Operational Startup & Verification Commands

### 10.1 Running the Stack:
* **Start BFF API Server (Terminal 1):**
```bash
node server.js
```
* **Start Next.js Frontend (Terminal 2):**
```bash
npm run dev
```
* **Execute Automated QA Test Suite (Terminal 3):**
```bash
node qa_test_suite.mjs
```
* **TypeScript Static Typecheck:**
```bash
npx tsc --noEmit
```

### 10.2 Automated QA Verification Results:
* **Composite Scoring Bounds:** Verified (1 to 25)
* **Qualitative Banding:** Verified (Low, Medium, High, Critical)
* **Single Loss Expectancy (SLE):** Verified ($10k per score point)
* **Multi-Factor Residual Formula:** Verified (eta weighting)
* **Open FAIR Monte Carlo Simulation:** Verified (10,000 iterations)
* **Anti-Junk Input Filter:** Verified (rejection of keyboard mash)
* **ORDS Response Normalizer:** Verified (lowercase mapping)
* **User Attribution Logging:** Verified (X-User-* capture)
* **LocalStore CRUD Lifecycle:** Verified (100% offline tolerance)

---
*Pericope ERM &middot; Enterprise Risk Management &middot; Confidential &copy; 2026*
"""
    ]

    doc = pymupdf.open()
    for idx, raw_sec in enumerate(sections):
        html_sec = markdown_to_html(raw_sec)
        create_page(doc, html_sec, idx + 1, len(sections))

    output_path = 'PERICOPE_FEATURE_MANUAL.pdf'
    doc.save(output_path)
    print(f"Successfully generated {output_path} with {len(doc)} pages!")

if __name__ == '__main__':
    build_manual_pdf()
