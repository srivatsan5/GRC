"""
Build the examiner demonstration guide (Word + PDF).

    python3 -I docs/demo/examiner-guide/build_guide.py
    (then, for the PDF)  soffice --headless --convert-to pdf --outdir docs/demo docs/demo/ERMA-GRC_Examiner_Demo_Guide.docx
"""
from pathlib import Path
import docx
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'ERMA-GRC_Examiner_Demo_Guide.docx'
FONT = 'Calibri'
GREEN = RGBColor(0x0E, 0x5A, 0x3E)
GREY = RGBColor(0x55, 0x55, 0x55)

d = docx.Document()
for s in d.sections:
    s.page_width, s.page_height = Inches(8.27), Inches(11.69)
    s.left_margin = s.right_margin = Inches(0.9)
    s.top_margin = s.bottom_margin = Inches(0.8)
st = d.styles['Normal']
st.font.name, st.font.size = FONT, Pt(10.5)
st.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), FONT)
st.paragraph_format.space_after = Pt(5)
st.paragraph_format.line_spacing = 1.1


def run(p, text, bold=False, italic=False, size=None, color=None, mono=False):
    r = p.add_run(text)
    r.bold, r.italic = bold, italic
    r.font.name = 'Consolas' if mono else FONT
    if size:
        r.font.size = Pt(size)
    if color:
        r.font.color.rgb = color
    return r


def rich(p, text, size=None):
    """**bold**, `code` inline."""
    import re
    for part in re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text):
        if not part:
            continue
        if part.startswith('**'):
            run(p, part[2:-2], bold=True, size=size)
        elif part.startswith('`'):
            run(p, part[1:-1], mono=True, size=(size or 10.5) - 1)
        else:
            run(p, part, size=size)


def para(text, size=None, after=5, italic=False):
    p = d.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    if italic:
        run(p, text, italic=True, size=size, color=GREY)
    else:
        rich(p, text, size)
    return p


def h1(text):
    p = d.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    run(p, text, bold=True, size=16, color=GREEN)


def h2(text):
    p = d.add_paragraph()
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    run(p, text, bold=True, size=12.5)


def bullets(items, numbered=False):
    for i, t in enumerate(items, 1):
        p = d.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.3)
        p.paragraph_format.first_line_indent = Inches(-0.2)
        p.paragraph_format.space_after = Pt(2)
        rich(p, (f'{i}. ' if numbered else '•  ') + t)


def shade(cell, hex_):
    tcPr = cell._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd'); sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), hex_)
    tcPr.append(sh)


def table(rows, widths, header=True, size=9.5):
    t = d.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, r in enumerate(rows):
        for j, c in enumerate(r):
            cell = t.cell(i, j)
            cell.width = Inches(widths[j])
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(1)
            if header and i == 0:
                run(p, c, bold=True, size=size)
                shade(cell, 'E8EFEA')
            else:
                rich(p, c, size)
    d.add_paragraph().paragraph_format.space_after = Pt(2)


def box(title, lines, fill='F4F1EA'):
    """A shaded call-out: SAY / CLICK / POINT OUT blocks."""
    t = d.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = t.cell(0, 0)
    c.width = Inches(6.4)
    shade(c, fill)
    p = c.paragraphs[0]
    run(p, title, bold=True, size=9.5, color=GREEN)
    for ln in lines:
        q = c.add_paragraph()
        q.paragraph_format.space_after = Pt(2)
        rich(q, ln, 10)
    d.add_paragraph().paragraph_format.space_after = Pt(1)


def scene(num, title, minutes, who, click, say, point=None, ask=None, image=None):
    h2(f'Scene {num}. {title}   ({minutes}; signed in as {who})')
    box('CLICK', click, 'EEF3F0')
    box('SAY', [f'“{s}”' for s in say], 'F7F4EC')
    if point:
        box('POINT OUT', point, 'F2F2F2')
    if ask:
        box('IF THE EXAMINER ASKS', ask, 'FBF0EE')
    if image:
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(HERE / image), width=Inches(5.6))


def code(lines):
    for ln in lines:
        p = d.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.3)
        p.paragraph_format.space_after = Pt(1)
        run(p, ln, mono=True, size=9.5)
    d.add_paragraph().paragraph_format.space_after = Pt(1)


# ====================================================================== title
p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.LEFT
run(p, 'ERMA-GRC', bold=True, size=28, color=GREEN)
p = d.add_paragraph(); run(p, 'Demonstration and viva guide for the external examiner', size=15)
para('What to open, what to click, what to say and how to answer questions, scene by scene. '
     'Every step in this guide was tested on the running application on 25 November 2026.', italic=True)

h2('How to use this guide')
bullets([
    '**Before the session:** do the checklist in Section 1, about 15 minutes before the examiner arrives.',
    '**During the demo:** follow Section 4, scene by scene. Each scene has four boxes:',
    '**CLICK** (what to do), **SAY** (what to tell the examiner), **POINT OUT** (what to show on screen) and **IF THE EXAMINER ASKS** (short answers).',
    '**Timing:** the full demo takes about 25 minutes. If time is short, do the scenes marked ★ only (about 12 minutes).',
    '**Questions:** Section 7 has longer answers to the questions examiners usually ask.',
])

# ====================================================================== 1 checklist
h1('1. Before the examiner arrives (checklist)')
h2('1.1 Start the application (three terminals, in this order)')
para('In VS Code (or Antigravity), open the project folder, then open three terminals with **+** in the Terminal panel.')
table([
    ['Terminal', 'Command', 'Wait until you see'],
    ['1. Database (demo stand-in)', '`npm --prefix api run dev:fake-db`', '`[fake-ords] http://localhost:8181/ords/grc (62 tables, in-memory)`'],
    ['2. API (server)', '`npm --prefix api run dev`', '`ERMA-GRC API listening` … `"port":5000`'],
    ['3. Web app', '`npm run dev`', '`Ready` and `http://localhost:3000`'],
], [1.5, 2.3, 2.6])
para('Check: open **http://localhost:5000/ready** in the browser. It must show `{"status":"ready","database":"ok"}`.')

h2('1.2 Prepare three accounts (do this once, before the session)')
para('Separation of duties is the heart of the demo, so you need three people with different roles. '
     'Sign in as the administrator, open **Administration → Users → Add user**, and create:')
table([
    ['Name', 'Email (example)', 'Role', 'Used in'],
    ['(you)', 'srivatsan359@gmail.com', 'Administrator', 'Scenes 1, 3, 13, 15'],
    ['Arun Assessor', 'assessor@demo.local', 'Assessor', 'Scenes 4–5 (creates and submits a risk)'],
    ['Riya Manager', 'manager@demo.local', 'Risk Manager', 'Scenes 6–7 (approves; cannot self-approve)'],
], [1.3, 1.9, 1.2, 2.0])
para('Passwords must be **12+ characters with letters and numbers**, for example `DemoPassword2026`. Write them on a slip of paper.')

h2('1.3 Browser set-up')
bullets([
    'Use **two browser windows**: a normal window and a private window (Edge: InPrivate, Chrome: Incognito). '
    'Each keeps its own sign-in, so you can switch between the Assessor and the Risk Manager without signing out.',
    'Zoom the browser to **90%** if the projector is small, so the side menu and the detail panel fit together.',
    'Close other tabs and silence notifications.',
])

h2('1.4 Three things to remember')
box('IMPORTANT', [
    '**The demo database forgets everything when terminal 1 stops.** Risks you add disappear; user accounts do not '
    '(they are kept by the API in `api/data`). So do the database-outage scene (Scene 14) **last**.',
    '**Wrong password 5 times locks an account for 15 minutes.** If that happens, use another account, or see Section 8.',
    '**The small orange “N” button** at the bottom left is the Next.js developer tool. It appears only in development '
    'mode and is not part of the app. If asked, say exactly that.',
], 'FBF0EE')

# ====================================================================== 2 pitch
h1('2. The 60-second opening')
box('SAY (memorise the gist, not the words)', [
    '“Organisations keep their risk management in GRC systems: risk registers, approvals, audit trails. '
    'Boards and auditors trust what these systems show. We audited an existing GRC application and found that it '
    'invented risk ratings, lost approvals, trusted anyone who claimed to be an administrator, and reported failed '
    'database saves as successes.”',
    '“So we asked: which design failures corrupt assurance evidence, and which design principles prevent them? '
    'We derived seven failure modes and seven design principles, and built ERMA-GRC on those principles.”',
    '“We then tested both systems on 23 scenarios with the same stored data. The old system prevented 4 of the 18 '
    'audit-derived failures; ERMA-GRC prevented all 18. We also report honestly where ERMA-GRC still fails.”',
    '“Let me show you the application.”',
], 'F7F4EC')

# ====================================================================== 3 background
h1('3. Background you may need to explain')
h2('3.1 Key terms in one line each')
table([
    ['Term', 'Plain meaning'],
    ['ERM (enterprise risk management)', 'Identifying, assessing, treating and monitoring risks across the whole organisation.'],
    ['GRC (governance, risk and compliance)', 'Software that brings risk, controls, policies and compliance records together in one place.'],
    ['RCSA (risk and control self-assessment)', 'The cycle in which business units identify their risks, rate them, and record the controls that reduce them.'],
    ['Inherent risk', 'The risk before any controls: likelihood × impact.'],
    ['Residual risk', 'The risk that remains after controls are applied.'],
    ['Likelihood × impact', 'Each rated 1–5; the score is their product (1–25). Bands: Low < 7, Moderate 7–11, High 12–15, Critical ≥ 16 (configurable in Settings).'],
    ['SLE (single loss expectancy)', 'The estimated money lost if the risk happens once.'],
    ['KRI (key risk indicator)', 'A measured number, such as outage hours per month, with amber and red thresholds that warn when a risk is growing.'],
    ['Maker-checker', 'One person creates a record; a different person approves it. Nobody approves their own work.'],
    ['Audit trail', 'A permanent, time-stamped record of who did what.'],
    ['Tamper-evident', 'Any change to past audit entries can be detected (here, by an HMAC hash chain).'],
], [2.1, 4.3])

h2('3.2 Architecture (draw this if there is a whiteboard)')
code([
    'Browser  ──►  Web app (Next.js / React)      port 3000',
    '                 │  session cookie (httpOnly) + CSRF header',
    '                 ▼',
    '              API (Node.js, Express, TypeScript)   port 5000',
    '              sign-in · roles · validation · approvals · audit chain',
    '                 │  OAuth2 client credentials',
    '                 ▼',
    '              Oracle Autonomous Database via ORDS (REST)',
    '              (in the demo: an in-memory stand-in on port 8181)',
])
table([
    ['Layer', 'Technology', 'Why'],
    ['Web app', 'Next.js 16, React, TypeScript, Tailwind CSS', 'Fast, typed UI; every number comes from the API, nothing is stored only in the browser.'],
    ['API', 'Node.js 22, Express 5, zod validation, JWT sessions', 'Enforces roles, approvals and validation on the server, where the user cannot bypass them.'],
    ['Database', 'Oracle Autonomous Database (23ai) through ORDS', 'Managed, secure cloud database; 216 tables and 247 enforced foreign keys in our installation.'],
    ['Quality', 'Vitest, Supertest, Playwright, ESLint, GitHub Actions CI, Docker', '94 API tests, 18 web unit tests, 49 end-to-end browser checks, run on every push.'],
], [1.0, 2.3, 3.1])

# ====================================================================== 4 demo
h1('4. The demonstration, scene by scene')
para('★ = core scene. Total time about 25 minutes (core scenes only: about 12 minutes).', italic=True)

scene('1 ★', 'Sign-in and accountability', '1 min', 'nobody yet',
      ['Open **http://localhost:3000**. Point to the footer “Every sign-in is recorded in the audit trail”.',
       'Sign in as the **Administrator**.'],
      ['Every user has their own account. There are no shared logins, because accountability starts with knowing who did what.',
       'The password is stored only as a scrypt hash, and five wrong attempts lock the account for fifteen minutes.'],
      ask=['**Where is the session stored?** In an httpOnly cookie that browser scripts cannot read, valid for 8 hours, plus a CSRF header check on every change.'])

scene('2 ★', 'Dashboard: the risk position', '2 min', 'Administrator',
      ['Show the top row: **Active risks**, **High & critical**, **Control coverage**, **Approvals waiting for me**.',
       'Point to the **Inherent risk matrix** and the **Needs attention** panel (KRI breach, approvals).'],
      ['Every figure here is computed from the database through the API. Nothing is hard-coded.',
       'Look at this: “20 not rated”. The old system would have shown a made-up rating here. We show “Not rated” instead, because no rating is better than a false one. That is our first design principle, evidence provenance.'],
      point=['“0 rated · 20 not rated” and “No risks rated yet”: honest empty states instead of invented values.'],
      image='dashboard.png')

scene('3', 'Users and roles', '2 min', 'Administrator',
      ['Open **Administration → Users**. Show the three accounts and their roles. (Optionally click **Add user** to show the form, then **Cancel**.)'],
      ['There are five roles: Administrator, Risk Manager, Assessor, Auditor and Viewer.',
       'The server enforces each role on every request. Hiding a button is not security; the API refuses the action even if someone calls it directly.'],
      ask=['**What can each role do?** See the table in Section 5.3.'])

scene('4 ★', 'Add and rate a risk (the maker)', '3 min', 'Assessor (private window)',
      ['In the private window, sign in as the **Assessor**. Open **RCSA lifecycle → Risk register → Add risk**.',
       'Risk statement: `Ransomware attack encrypts the ERP database and halts order processing`',
       'Category `Technology`, Business process `Order to cash`, Risk owner `CIO`.',
       'Inherent rating: Likelihood **4 – Likely**, Impact **5 – Severe**. Single loss expectancy `250000`.',
       'Click **Add risk**. The message “Risk added to the register” appears.'],
      ['Likelihood four times impact five gives twenty, which is in the Critical band.',
       'The rating is stored because a person entered it. If the Assessor leaves it blank, the system says “Not rated”. It never guesses.'],
      point=['The breadcrumb steps across the top: 1 Assessment cycles → 2 Risk register → 3 Inherent assessment → 4 Controls & mitigation → 5 Monitoring. That is the RCSA lifecycle.'])

scene('5 ★', 'The risk detail panel and submission', '2 min', 'Assessor',
      ['Click the new risk in the register. The detail panel opens on the right.',
       'Show **Inherent → residual** (the 5 × 5 matrix with the risk at 20, Critical), **Controls**, **Action plans** and **Approval**.',
       'Click **Submit for approval**. The message “Submitted for approval” appears.'],
      ['The status is now Submitted. The Assessor cannot approve it, because only a Risk Manager can.',
       'Residual is “Not rated” until someone rates it after controls are applied. We don’t derive it automatically.'],
      image='risk-detail.png')

scene('6 ★', 'Approve the risk (the checker)', '2 min', 'Risk Manager (normal window)',
      ['In the normal window, sign out and sign in as the **Risk Manager**, or use a third window.',
       'Open **Risk register**, click the ransomware risk, click **Approve**, then **Approve** again in the confirmation box.',
       'The message “Risk approved” appears. (You can also show **Controls & policy → Approvals**, the approvals inbox.)'],
      ['A different person approved it. That is maker-checker.',
       'If anyone without approval rights later edits this approved risk, it goes back to review automatically. Signed-off content cannot change silently.'])

scene('7 ★', 'Separation of duties: self-approval is refused', '2 min', 'Risk Manager',
      ['Still as the Risk Manager: **Add risk** with the statement `Test risk created by the Risk Manager` → **Add risk**.',
       'Open it → **Submit for approval** → then try **Approve** → confirm.',
       'The error appears: **“You cannot approve or reject a record you created — another approver must decide.”**'],
      ['The Risk Manager has approval rights, but not over their own work. The server checks who created the record, using the audit trail, not anything the browser sends.',
       'In the old system, anyone could send a header saying “I am the administrator” and approve anything. We tested that in scenario S3.'],
      point=['This is design principle DP3: server-enforced, identity-bound separation of duties.'])

scene('8', 'Heatmaps', '1 min', 'any user',
      ['Open **Analytics → Heatmaps**. Switch between **Inherent**, **Residual** and **Movement**.'],
      ['The heatmap is drawn from stored ratings. Unrated risks are left out and counted separately, not placed on the map at a guessed position.'])

scene('9', 'Key risk indicators', '2 min', 'any user',
      ['Open **Analytics → Key risk indicators**. Show the four indicators: **1 Breach**, **3 Warning**.',
       'Open **Unplanned IT Outage Hours**: reading 13.5 hours a month, against warning ≥ 8 and breach ≥ 12. (Optionally **Record reading**.)'],
      ['The status comes from the thresholds. When you record a reading in the app, the status is computed by rule.'],
      ask=['**Can the status be wrong?** Honest answer: in our evaluation (scenario G4), a client calling the API directly could still send its own status. We report this as a limitation, and the fix is to compute it on the server too (Section 6).'])

scene('10', 'Controls, risk appetite and policies', '2 min', 'any user',
      ['Open **Control library** (8 controls with effectiveness ratings), then **Risk appetite** (exposure against appetite), then **Policies**.'],
      ['Controls are defined once in the library and applied to many risks, so effectiveness is consistent.',
       'The risk appetite page compares actual exposure with the limits the board has set.'])

scene('11', 'Enterprise risk modules', '1 min', 'any user',
      ['Briefly open **Vendors**, **Incidents**, **Business continuity** and **Scenarios**.'],
      ['These modules used to live only in the browser’s local storage in the old system, so each user saw different data. Now everything is in the database. That is design principle DP6, a single system of record.'])

scene('12', 'Reports', '1 min', 'any user',
      ['Open **Analytics → Reports**. Choose **Risk register**, then show **Print** and **Export CSV**.'],
      ['Reports print as an A4 board pack and export to CSV for auditors.'])

scene('13 ★', 'The audit trail and its integrity check', '3 min', 'Administrator',
      ['As the Administrator, open **Administration → Audit trail**.',
       'Point to the green badge **“Integrity verified · N entries”**, and click its refresh icon to verify again.',
       'Point to the entries from this demo: the Assessor’s **Create** and **Update**, the Risk Manager’s **Approve**, and every **Sign in**.'],
      ['Every entry is recorded by the server, with the identity from the signed-in session. A user cannot claim to be someone else.',
       'Each entry includes a keyed hash (HMAC-SHA-256) of the previous one, forming a chain. If anyone edits or deletes a past entry, the chain no longer verifies and this badge turns red.'],
      ask=['**Can an insider defeat it?** Yes, and we report it. Someone holding the secret key could rewrite the chain offline (scenario L1). The fix is to anchor the chain outside the system, for example by publishing periodic hashes. That is our future work.'],
      image='audit-trail.png')

scene('14 ★', 'Fail-visible: what happens when the database is down', '2 min', 'any user  (do this LAST)',
      ['Go to terminal 1 (the database) and press **Ctrl+C** to stop it.',
       'In the browser, open the **Risk register** or try **Add risk**.',
       'The app shows **“Couldn’t load this data — The database is unreachable right now. Please retry.”**'],
      ['The old system answered “saved successfully” even when the database was down. It kept the data in memory and lost it on restart. That is failure mode F5, silent failure reported as success.',
       'ERMA-GRC tells the truth: an error is an error. That is design principle DP5, fail-visible operation.'],
      point=['To continue afterwards, start terminal 1 again (`npm --prefix api run dev:fake-db`). The demo data resets to the sample set.'],
      image='database-outage.png')

scene('15', 'Settings', '1 min', 'Administrator',
      ['Open **Administration → Settings**. Show **Risk bands** (thresholds 7 / 12 / 16), **Currency** and **Session**.'],
      ['The organisation sets its own risk bands, and every page uses the same bands.'])

# ====================================================================== 5 research mapping
h1('5. How the application maps to the research')
h2('5.1 Failure modes, design principles and where to show them')
table([
    ['Failure found in the old system', 'Design principle in ERMA-GRC', 'Show it in scene'],
    ['F1 Invented ratings and values', 'DP1 Evidence provenance: no derived ratings, “Not rated” shown', '2, 4, 5'],
    ['F2 Approvals overwritten by default values on save', 'DP2 Decision preservation: approvals only through authorised steps', '5, 6'],
    ['F3 Security checked only in the browser, or not at all', 'DP3 Server-enforced, identity-bound separation of duties', '3, 7'],
    ['F4 Audit trail editable and forgeable', 'DP4 Tamper-evident, actor-bound audit trail (HMAC chain)', '13'],
    ['F5 Failed saves reported as success', 'DP5 Fail-visible operation', '14'],
    ['F6 Data split between browser and database', 'DP6 Single system of record', '11'],
    ['F7 Delete buttons on invented records', 'DP1 Evidence provenance: no placeholder rows', '2'],
    ['F1 (metrics) Status declared, not computed', 'DP7 Computed, not declared, metrics', '9'],
], [2.2, 3.0, 1.2])

h2('5.2 Evaluation results (say them exactly like this)')
table([
    ['Scenario group', 'Old system prevented', 'ERMA-GRC prevented'],
    ['18 scenarios derived from the audit', '4 of 18', '18 of 18'],
    ['4 scenarios beyond the audit (generalisation)', '0 of 4', '3 of 4'],
    ['1 boundary scenario (expected to fail)', '0 of 1', '0 of 1'],
    ['All 23', '4', '21'],
], [3.2, 1.6, 1.6])
para('The protocol was time-stamped in the project repository before the run (not a public registry). Both systems ran '
     'against the same database stand-in with identical rows. Stored outcomes were read from the database stand-in, and '
     'display outcomes from the screen. All deviations are reported in the paper.')

h2('5.3 Roles')
table([
    ['Role', 'Can'],
    ['Administrator', 'Everything, including users, settings and the audit trail'],
    ['Risk Manager', 'Create, edit, delete and approve, but never their own submissions; read the audit trail'],
    ['Assessor', 'Create and edit risks, assessments, controls and plans, and submit them for approval'],
    ['Auditor', 'Read everything, including the audit trail'],
    ['Viewer', 'Read only'],
], [1.4, 5.0])

# ====================================================================== 6 limitations
h1('6. Limitations: say them before the examiner does')
bullets([
    '**G4, metric status:** the interface computes a KRI’s status by rule, but the API still accepts a status sent by the client. Fix: compute it on the server.',
    '**L1, insider with the key:** someone holding the audit key can rewrite the chain offline, and it verifies after a restart. Fix: anchor the chain outside the system.',
    '**One case only:** the evaluation compares two systems built and tested by our team, against a database stand-in rather than live production.',
    '**User accounts** and the audit chain are stored on the API server (`api/data`), not yet in Oracle.',
    '**AI assistance:** we used Claude (Anthropic) under our direction for the audit, much of the implementation, the test scripts and drafting. We disclosed this as COPE requires. We set the questions, approved each stage and verified the results. (Only say what is true for you.)',
])

# ====================================================================== 7 Q&A
h1('7. Likely examiner questions, with answers')
qa = [
    ('What problem does this project solve?', 'GRC systems produce evidence (ratings, approvals, audit entries) that boards and auditors rely on. We showed that a system’s own design can corrupt that evidence, and we give seven principles, implemented and tested, that prevent it.'),
    ('What is new here? Commercial tools exist.', 'Existing research studies how GRC systems are adopted and what value they bring. We study whether the evidence they display can be trusted, with failure modes taken from a real system and principles tested against it. Commercial tools such as Archer or ServiceNow are expensive and closed, so their internals cannot be evaluated like this.'),
    ('Why Oracle Autonomous Database and ORDS?', 'It is a managed, patched cloud database with strong integrity features (foreign keys, check constraints). ORDS exposes the tables over REST with OAuth2, so the API never holds database passwords. Only a client ID and secret are used.'),
    ('Why not keep data in the browser? It is faster.', 'Browser storage is per device and editable by the user, so different users saw different “truths”. A system of record must be one place, on the server (DP6).'),
    ('How are passwords protected?', 'They are hashed with scrypt and a random salt, with a minimum of 12 characters including letters and numbers. Five failed attempts lock the account for 15 minutes, and a locked account gives the same message as a wrong password, so attackers cannot discover valid emails.'),
    ('How does the server know who the user is?', 'From a signed session token (JWT) in an httpOnly cookie, never from anything the client claims, such as a header or a name in the request body.'),
    ('How does the hash chain work?', 'Each audit entry stores HMAC-SHA-256(key, previous hash + entry). Verification recomputes the chain; any edit, insertion or deletion breaks it. The key is secret, so an outsider cannot recompute a forged chain.'),
    ('Then how did L1 succeed?', 'L1 assumed an insider who has the key. With the key you can recompute everything. That is why we list external anchoring as future work. We report it rather than hide it.'),
    ('What does maker-checker add?', 'One person cannot both create and approve. ERMA-GRC reads the record’s creator from the audit trail and refuses self-approval, as you saw in Scene 7.'),
    ('How did you test the system?', 'There are 94 API tests, 18 web unit tests and 49 end-to-end browser checks across three suites (core flow, real data, security). They run in GitHub Actions on every push, together with lint, type checks, `npm audit` and Docker builds. Separately, the 23-scenario evaluation compared the two systems.'),
    ('How do you calculate the risk score?', 'Likelihood (1–5) × impact (1–5), giving 1–25. Bands: Low below 7, Moderate 7–11, High 12–15, Critical 16 and above, configurable in Settings. SLE is entered by the assessor, never derived.'),
    ('Inherent versus residual?', 'Inherent is the risk before controls. Residual is the risk after controls, rated separately by a person, not computed by a formula.'),
    ('What happens if two approvers click Approve at the same time?', 'Only one decision is stored; the second receives a conflict (HTTP 409). We tested this in scenario G1.'),
    ('Is it secure against common web attacks?', 'Inputs are validated with zod on the server, there is an allow-list of tables and columns, identifiers are validated (path traversal is blocked, scenario G3), there is a CSRF header check, a CORS allow-list, rate limits, and httpOnly cookies. `npm audit` shows no high or critical vulnerabilities in production dependencies.'),
    ('How would you deploy it?', 'With two Docker images (web and API) behind HTTPS, pointed at the Autonomous Database. There are health (`/health`) and readiness (`/ready`) checks and structured JSON logs, as described in docs/DEPLOYMENT.md.'),
    ('Did you use AI? How much is your own work?', 'Answer truthfully. The paper states that Claude was used under our direction for the audit, much of the implementation, the test scripts, outcome-coding proposals, figures and draft text. We set the questions, approved each stage, verified sources and results, and take full responsibility, as COPE requires.'),
    ('What would you do next?', 'Compute every metric on the server (fixing G4), anchor the audit chain externally (fixing L1), move user accounts into Oracle, and evaluate with real practitioners in an organisation.'),
]
for q, a in qa:
    p = d.add_paragraph(); p.paragraph_format.space_after = Pt(1); p.paragraph_format.keep_with_next = True
    run(p, 'Q. ' + q, bold=True)
    p = d.add_paragraph(); p.paragraph_format.left_indent = Inches(0.25); p.paragraph_format.space_after = Pt(6)
    rich(p, 'A. ' + a)

# ====================================================================== 8 troubleshooting
h1('8. If something goes wrong during the demo')
table([
    ['Problem', 'Fix'],
    ['Page shows “Couldn’t load this data”', 'Terminal 1 (database) has stopped. Run `npm --prefix api run dev:fake-db` again. The demo data resets.'],
    ['“Email or password is incorrect, or the account is temporarily locked”', 'Check for typing errors (copy the password from your note). After 5 failures, wait 15 minutes or use another account.'],
    ['API terminal says “Invalid API configuration”', 'A line in `api/.env` is wrong: no quotes, no `< >`, a valid email, and a password of 12+ characters with letters and numbers.'],
    ['Browser cannot reach localhost:3000', 'Terminal 3 has stopped. Run `npm run dev` again and wait for “Ready”.'],
    ['Port already in use', 'An old copy is still running. Close the old terminal, or restart VS Code, then start the three terminals again.'],
    ['Forgot the admin password', 'Stop terminal 2, delete the folder `api/data`, put a new password in `BOOTSTRAP_ADMIN_PASSWORD=` in `api/.env`, then start terminal 2 again. This recreates the users, so you have to add the other accounts again.'],
], [2.4, 4.0])
para('Fallback: if the live app fails completely, show the screenshots in `docs/research/paper/figures/screens/` and the figures in the paper.', italic=True)

h1('9. One-page summary to keep in front of you')
table([
    ['Scene', 'Show', 'Key line'],
    ['1', 'Sign-in', 'Every user is accountable; passwords hashed; lockout after 5 tries.'],
    ['2', 'Dashboard', '“Not rated” rather than invented numbers (DP1).'],
    ['4–5', 'Add, rate and submit a risk (Assessor)', '4 × 5 = 20, Critical; stored because a person entered it.'],
    ['6', 'Approve (Risk Manager)', 'Maker-checker: a different person approves.'],
    ['7', 'Self-approval refused', 'Server-enforced separation of duties (DP3).'],
    ['13', 'Audit trail, “Integrity verified”', 'HMAC hash chain; edits are detectable (DP4).'],
    ['14', 'Stop the database', 'Errors are shown, never false success (DP5).'],
    ['Results', '4/18 vs 18/18; 0/4 vs 3/4', 'Honest limitations: G4 (metric status) and L1 (insider with key).'],
], [0.8, 2.4, 3.2])

d.core_properties.title = 'ERMA-GRC demonstration and viva guide'
d.core_properties.author = ''
d.save(OUT)
print('written', OUT)
