/**
 * Hand-written demo rows for the tables the web app shows: lookups, people, assessment cycles,
 * the risk register and everything hung off it (assessments, controls, monitoring, plans), KPIs.
 * A fictional multi-department enterprise running an ERP ("Meridian Group"); every person and
 * e-mail address is invented (example.com).
 *
 * Ids are fixed (UUID 1, 2, …) so rows can point at each other. A reference to a row created by
 * the module seed (db/seed/demo_data.sql: controls, incidents, KRIs …) is written
 * { $ref: [table, naturalKeyColumn, value] } and becomes a sub-query.
 * Every row with a CREATED_BY column is stamped 'demo-seed'.
 */

const ref = (table, col, value) => ({ $ref: [table, col, value] })
const control = code => ref('ERM_MST_CONTROL', 'CONTROL_CODE', code)
const rows = (list, fn) => list.map((x, i) => ({ UUID: i + 1, ...fn(x, i + 1) }))

// ------------------------------------------------------------------ organisation and people
const ORG_LEVELS = [
  ['L1', 'Group', null],
  ['L2', 'Division', 1],
  ['L3', 'Department', 2],
]
// name, short code, level, parent, manager
const ORG = [
  ['Meridian Group', 'GRP', 1, null, 'Asha Menon'],
  ['Finance', 'FIN', 2, 1, 'Elena Petrova'],
  ['Human Resources', 'HR', 2, 1, 'Nadia Rahman'],
  ['Sales & Marketing', 'SLS', 2, 1, 'Carlos Mendes'],
  ['Procurement & Supply Chain', 'SCM', 2, 1, 'Kenji Watanabe'],
  ['Manufacturing & Operations', 'OPS', 2, 1, 'Tom Becker'],
  ['Information Technology', 'IT', 2, 1, 'Marcus Lee'],
  ['Legal & Compliance', 'LGL', 2, 1, 'Fatima Al-Sayed'],
  ['Customer Service', 'CS', 2, 1, 'Sofia Rossi'],
  ['Research & Development', 'RND', 2, 1, 'Lina Park'],
  ['Risk & Internal Audit', 'RSK', 2, 1, 'Grace Mensah'],
]
const DESIGNATIONS = [
  ['Chief Risk Officer', 'Owns the enterprise risk framework and reports to the board risk committee.'],
  ['Risk Manager', 'Runs RCSA cycles with the departments and approves risk assessments.'],
  ['Risk Analyst', 'Prepares assessments, maintains the register and tracks actions.'],
  ['Chief Information Officer', 'Accountable for the ERP, IT systems and information security.'],
  ['Chief Financial Officer', 'Accountable for finance, treasury and financial reporting.'],
  ['Chief Operating Officer', 'Accountable for manufacturing, quality and health & safety.'],
  ['Chief Compliance Officer', 'Accountable for legal and regulatory compliance.'],
  ['Internal Auditor', 'Provides independent assurance over controls.'],
  ['Head of Supply Chain', 'Accountable for procurement, suppliers, inventory and logistics.'],
  ['Chief Human Resources Officer', 'Accountable for people, payroll and workplace policies.'],
  ['Head of Sales', 'Accountable for customers, orders and revenue.'],
  ['Head of R&D', 'Accountable for product development and launches.'],
  ['Head of Customer Service', 'Accountable for customer support and complaints.'],
]
// name, designation, org unit, risk owner?, risk champion?
export const PEOPLE = [
  ['Asha Menon', 1, 1, 'Y', 'N'],
  ['Daniel Okafor', 2, 11, 'Y', 'Y'],
  ['Priya Raman', 3, 11, 'N', 'Y'],
  ['Marcus Lee', 4, 7, 'Y', 'N'],
  ['Elena Petrova', 5, 2, 'Y', 'N'],
  ['Tom Becker', 6, 6, 'Y', 'N'],
  ['Fatima Al-Sayed', 7, 8, 'Y', 'N'],
  ['Lucas Moreau', 8, 11, 'N', 'N'],
  ['Grace Mensah', 2, 11, 'Y', 'Y'],
  ['Kenji Watanabe', 9, 5, 'Y', 'N'],
  ['Nadia Rahman', 10, 3, 'Y', 'N'],
  ['Carlos Mendes', 11, 4, 'Y', 'N'],
  ['Lina Park', 12, 10, 'Y', 'N'],
  ['Sofia Rossi', 13, 9, 'Y', 'N'],
]
const email = name => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`
const personId = name => PEOPLE.findIndex(p => p[0] === name) + 1
const ROLES = [
  ['Administrator', 'Full access, including users, settings and the audit trail.'],
  ['Risk Manager', 'Creates, edits and approves risk records (never their own).'],
  ['Assessor', 'Creates and edits risks, assessments, controls and plans; submits them for approval.'],
  ['Auditor', 'Reads everything, including the audit trail.'],
  ['Viewer', 'Read only.'],
]
const USER_ROLES = [
  [1, 1], [2, 2], [3, 3], [4, 3], [5, 3], [6, 3], [7, 2], [8, 4], [9, 2], [10, 3], [11, 3], [12, 3], [13, 3], [14, 5],
]

// ------------------------------------------------------------------ risk taxonomy
export const CATEGORIES = ['Technology', 'Operational', 'Financial', 'Compliance', 'Third Party', 'Strategic', 'Reputational', 'People', 'Health & Safety']
const SUB_CATEGORIES = [
  [1, 'Cyber security'], [1, 'System availability'], [1, 'Access management'], [2, 'Process execution'], [2, 'Fraud'],
  [3, 'Financial reporting'], [3, 'Credit'], [4, 'Data privacy'], [4, 'Regulatory change'], [5, 'Supply chain'],
  [5, 'Outsourcing'], [6, 'Market'], [6, 'Project delivery'], [7, 'Product quality'], [8, 'Talent'], [9, 'Workplace safety'],
]
const subId = name => SUB_CATEGORIES.findIndex(s => s[1] === name) + 1
const CAUSAL_FACTORS = ['People', 'Process', 'Systems', 'External events']
const ROOT_CAUSES = [
  ['Inadequate process design', 'The process has gaps or relies on manual steps.'],
  ['Human error', 'Mistakes in execution despite a sound process.'],
  ['Technology failure', 'Hardware, software or network failure.'],
  ['Malicious external actor', 'Fraudsters, attackers or other bad actors outside the bank.'],
  ['Third-party failure', 'A supplier or outsourced provider does not deliver.'],
  ['Regulatory change', 'New or changed rules the bank must follow.'],
  ['Market movement', 'Adverse changes in rates, prices or demand.'],
]
const DATA_SOURCES = [
  ['Risk and control self-assessment', 'Workshops with process owners.'],
  ['Internal loss events', 'Losses and near misses recorded in the incident log.'],
  ['Internal audit findings', 'Issues raised by internal audit.'],
  ['KRI breaches', 'Key risk indicators outside tolerance.'],
  ['Regulatory review', 'Findings from supervisors and regulators.'],
]
const RISK_CYCLES = [
  ['Annual', 'Reviewed once a year.'],
  ['Semi-annual', 'Reviewed twice a year.'],
  ['Quarterly', 'Reviewed every quarter.'],
]
// rating, description, colour
const LIKELIHOOD = [
  ['Rare', 'May occur only in exceptional circumstances (less than once in 10 years).', '#2E7D32'],
  ['Unlikely', 'Could occur at some time (once in 5–10 years).', '#7CB342'],
  ['Possible', 'Might occur (once in 2–5 years).', '#F9A825'],
  ['Likely', 'Will probably occur (about once a year).', '#EF6C00'],
  ['Almost certain', 'Expected to occur several times a year.', '#C62828'],
]
const IMPACT = [
  ['Insignificant', 'Loss under $50k; no customer or regulatory impact.', '#2E7D32'],
  ['Minor', 'Loss $50k–$250k; limited customer impact.', '#7CB342'],
  ['Moderate', 'Loss $250k–$1m; regulatory notification possible.', '#F9A825'],
  ['Major', 'Loss $1m–$5m; regulatory action or media coverage.', '#EF6C00'],
  ['Severe', 'Loss over $5m; regulatory sanction, loss of a major customer or national media coverage.', '#C62828'],
]
const IMPACT_CATEGORIES = [
  ['Financial', 'Direct monetary loss or write-off.'],
  ['Regulatory', 'Fines, sanctions or supervisory action.'],
  ['Reputational', 'Damage to brand and public trust.'],
  ['Customer', 'Harm or disruption to customers.'],
  ['Operational', 'Disruption to internal operations.'],
]
const IMPACT_SUB = [
  [1, 'Direct loss'], [1, 'Write-off'], [2, 'Fine or penalty'], [2, 'Licence condition'],
  [3, 'Media coverage'], [4, 'Service outage'], [4, 'Data exposure'], [5, 'Production stoppage'], [5, 'Backlog'],
]
const IMPACT_PARTIES = [
  ['Customers', 'Business and consumer customers.'],
  ['Employees', 'Staff and contractors.'],
  ['Regulators', 'Tax, data-protection, health & safety and industry regulators.'],
  ['Shareholders', 'Investors and the board.'],
  ['Suppliers', 'Third-party providers.'],
]
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED']

// ------------------------------------------------------------------ processes
// ERP process areas (end-to-end processes across departments)
const PROCESSES = [
  ['Order to Cash', 'Customer orders, invoicing and collections.', ['Order management', 'Billing & collections']],
  ['Procure to Pay', 'Buying goods and services and paying suppliers.', ['Supplier onboarding', 'Purchasing & payments']],
  ['Record to Report', 'Ledger, month-end close and statutory reporting.', ['Reconciliation', 'Statutory reporting']],
  ['Hire to Retire', 'Recruitment, onboarding, payroll and exits.', ['Recruitment & onboarding', 'Payroll']],
  ['Plan to Produce', 'Production planning, manufacturing and quality.', ['Production line', 'Quality control']],
  ['Inventory & Logistics', 'Warehousing, stock control and deliveries.', ['Warehousing', 'Distribution']],
  ['IT Operations', 'Running and securing the ERP and other systems.', ['ERP administration', 'Access management']],
  ['Customer Service', 'Support, complaints and field service.', ['Complaints handling', 'Field service']],
  ['Product Development', 'Research, design and product launches.', ['R&D projects', 'Product launch']],
]
const SUB_PROCESSES = PROCESSES.flatMap((p, i) => p[2].map(s => [i + 1, s]))
const processId = name => PROCESSES.findIndex(p => p[0] === name) + 1
const subProcessId = name => SUB_PROCESSES.findIndex(s => s[1] === name) + 1

// ------------------------------------------------------------------ control taxonomy
const CONTROL_CATEGORIES = [
  ['Access control', 'Who can use systems and data.'],
  ['Reconciliation', 'Comparing records to find differences.'],
  ['Authorisation', 'Approval before a transaction proceeds.'],
  ['Monitoring', 'Ongoing review of activity or indicators.'],
  ['Training & awareness', 'Making sure people know the rules.'],
  ['Resilience', 'Backup, recovery and continuity.'],
  ['Quality & safety', 'Inspections and checks on products and workplaces.'],
]
const CONTROL_TYPES = [
  ['Preventive', 'Stops the event from happening.'],
  ['Detective', 'Finds the event after it happens.'],
  ['Corrective', 'Limits the damage once it has happened.'],
]
const CONTROL_CLASSIFICATIONS = [
  ['Key', 'A control the risk rating depends on.'],
  ['Secondary', 'Supports a key control.'],
]
const DESIGN_EFFECTIVENESS = [
  ['Effective', 'Designed to address the risk fully.'],
  ['Partially Effective', 'Addresses the risk with gaps.'],
  ['Ineffective', 'Does not address the risk.'],
]
const FREQUENCIES = ['Continuous', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-driven']
const MITIGATION_TYPES = [
  ['Reduce', 'Add or strengthen controls to lower likelihood or impact.'],
  ['Transfer', 'Move the risk to a third party, e.g. insurance.'],
  ['Avoid', 'Stop the activity that creates the risk.'],
  ['Accept', 'Tolerate the risk within appetite.'],
]
// name, description, category, type, classification, owner
const CONTROL_REGISTER = [
  ['Multi-factor authentication', 'MFA for ERP administrators and all remote access.', 1, 1, 1, 'Marcus Lee'],
  ['Daily bank reconciliation', 'Bank statements reconciled to the ERP ledger every day.', 2, 2, 1, 'Elena Petrova'],
  ['Three-way match', 'Supplier invoices paid only when they match the purchase order and goods receipt.', 3, 1, 1, 'Elena Petrova'],
  ['Segregation of duties in the ERP', 'No one can both create a supplier and approve its payments.', 3, 1, 1, 'Marcus Lee'],
  ['Supplier due diligence', 'Risk questionnaire and checks before a supplier is approved.', 4, 1, 2, 'Kenji Watanabe'],
  ['Backup and restore testing', 'Encrypted off-site ERP backups, restored and tested quarterly.', 6, 3, 1, 'Marcus Lee'],
  ['Security awareness training', 'Annual training and quarterly phishing simulations.', 5, 1, 2, 'Marcus Lee'],
  ['Incoming quality inspection', 'Sample inspection of critical components at goods-in.', 7, 2, 1, 'Tom Becker'],
  ['Line safety checks', 'Daily safety checklist on every production line.', 7, 1, 1, 'Tom Becker'],
]

// ------------------------------------------------------------------ cycles and the risk register
const CYCLES = [
  ['RCSA-2026-1', 'Q2 2026 RCSA', 'Q2', '2026-04-01', '2026-06-30', '2026-06-15', 'Completed', 'Closed and signed off by the risk committee.'],
  ['RCSA-2026-2', 'Q3 2026 RCSA', 'Q3', '2026-07-01', '2026-09-30', '2026-09-15', 'Under Review', 'Assessments submitted; risk managers are reviewing.'],
  ['RCSA-2026-3', 'Q4 2026 RCSA', 'Q4', '2026-10-01', '2026-12-31', '2026-12-10', 'In Progress', 'Current cycle.'],
]

// statement, category, sub-category, process, sub-process, owner, champion, [L, I], [rL, rI] | null,
// status, cycle, SLE ($), cause, controls (codes from the module seed)
export const RISKS = [
  ['ERP outage stops order processing and invoicing for more than a day', 'Technology', 'System availability', 'Order to Cash', 'Order management', 'Marcus Lee', 'Priya Raman', [4, 5], [3, 3], 'APPROVED', 2, 2000000, 3, ['CTL-OPS-INC-03', 'CTL-IT-BCK-05']],
  ['Ransomware encrypts the ERP and file servers', 'Technology', 'Cyber security', 'IT Operations', 'ERP administration', 'Marcus Lee', 'Priya Raman', [3, 5], [2, 4], 'APPROVED', 2, 4500000, 4, ['CTL-IT-AUTH-01', 'CTL-IT-BCK-05']],
  ['Failure of a single-source supplier halts a production line', 'Third Party', 'Supply chain', 'Plan to Produce', 'Production line', 'Kenji Watanabe', 'Grace Mensah', [4, 4], [3, 3], 'SUBMITTED', 3, 3000000, 5, ['CTL-VEN-DUE-06']],
  ['Duplicate or fraudulent supplier payments', 'Operational', 'Fraud', 'Procure to Pay', 'Purchasing & payments', 'Elena Petrova', 'Daniel Okafor', [3, 4], [2, 3], 'APPROVED', 2, 800000, 4, ['CTL-FIN-SOD-07']],
  ['Month-end close errors misstate the financial statements', 'Financial', 'Financial reporting', 'Record to Report', 'Reconciliation', 'Elena Petrova', 'Priya Raman', [4, 3], [2, 2], 'APPROVED', 1, 400000, 2, ['CTL-FIN-REC-02']],
  ['Customer personal data exposed through a CRM misconfiguration', 'Compliance', 'Data privacy', 'Customer Service', 'Complaints handling', 'Fatima Al-Sayed', 'Daniel Okafor', [3, 5], [2, 4], 'SUBMITTED', 3, 2500000, 1, ['CTL-COMP-TRN-04', 'CTL-IT-AUTH-01']],
  ['Key engineers leave for competitors', 'People', 'Talent', 'Hire to Retire', 'Recruitment & onboarding', 'Nadia Rahman', 'Grace Mensah', [3, 3], null, 'DRAFT', 3, 600000, 1, []],
  ['Payroll errors pay staff incorrectly', 'Operational', 'Process execution', 'Hire to Retire', 'Payroll', 'Nadia Rahman', 'Priya Raman', [2, 3], [1, 2], 'APPROVED', 1, 150000, 2, []],
  ['Serious workplace injury on the factory floor', 'Health & Safety', 'Workplace safety', 'Plan to Produce', 'Production line', 'Tom Becker', 'Grace Mensah', [3, 4], [2, 3], 'APPROVED', 2, 1000000, 2, []],
  ['Product recall caused by a quality defect', 'Reputational', 'Product quality', 'Plan to Produce', 'Quality control', 'Tom Becker', 'Grace Mensah', [2, 5], [2, 4], 'SUBMITTED', 3, 5000000, 1, []],
  ['Stock-outs caused by inaccurate inventory records', 'Operational', 'Process execution', 'Inventory & Logistics', 'Warehousing', 'Kenji Watanabe', 'Priya Raman', [4, 3], [3, 2], 'APPROVED', 2, 500000, 2, []],
  ['New e-invoicing and data-protection rules not implemented on time', 'Compliance', 'Regulatory change', 'Record to Report', 'Statutory reporting', 'Fatima Al-Sayed', 'Daniel Okafor', [3, 3], [2, 3], 'REJECTED', 3, 300000, 6, ['CTL-COMP-MON-08']],
  ['Three largest customers make up 45% of revenue', 'Strategic', 'Market', 'Order to Cash', 'Order management', 'Carlos Mendes', 'Daniel Okafor', [3, 4], [3, 3], 'DRAFT', 3, 6000000, 7, []],
  ['Bad debts from late-paying customers', 'Financial', 'Credit', 'Order to Cash', 'Billing & collections', 'Elena Petrova', 'Priya Raman', [3, 3], null, 'DRAFT', 3, 700000, 7, []],
  ['New product launch delayed by R&D overruns', 'Strategic', 'Project delivery', 'Product Development', 'Product launch', 'Lina Park', 'Grace Mensah', null, null, 'DRAFT', 3, null, 1, []],
  ['Excessive ERP access rights allow unauthorised changes', 'Technology', 'Access management', 'IT Operations', 'Access management', 'Marcus Lee', 'Priya Raman', [3, 4], [2, 3], 'APPROVED', 2, 900000, 1, ['CTL-IT-AUTH-01', 'CTL-FIN-SOD-07']],
  ['Logistics partner fails to deliver during peak season', 'Third Party', 'Outsourcing', 'Inventory & Logistics', 'Distribution', 'Kenji Watanabe', 'Daniel Okafor', [3, 3], [2, 3], 'SUBMITTED', 3, 400000, 5, ['CTL-VEN-DUE-06']],
]

const cycleDates = c => CYCLES[c - 1]
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10)

export function curatedRows() {
  const out = {}
  out.PER_MST_ORG_LEVEL = rows(ORG_LEVELS, ([code, name, parent]) => ({ ORG_LEVEL: code, ORG_LEVEL_NAME: name, PARENT_NODE_UUID: parent }))
  out.PER_MST_ORG_HIERARCHY = rows(ORG, ([name, code, level, parent, mgr]) => ({
    ORG_LEVEL_UUID: level, ORG_HIERARCHY_NAME: name, ORG_HIERARCHY_DESCRIPTION: `${name} (${code})`, IS_ACTIVE: 'Y',
    MANAGER_DETAILS: mgr, PER_MST_ORG_HIERARCHY_PARENT_UUID: parent, ORG_HIERARCHY_SHORT_CODE: code,
  }))
  out.PER_MST_DESIGNATION = rows(DESIGNATIONS, ([d, desc]) => ({ DESIGNATION: d, DESIGNATION_DESCRIPTION: desc }))
  out.PER_MST_USER_DETAILS = rows(PEOPLE, ([name, des, org, owner, champ]) => ({
    USER_FULL_NAME: name, USER_EMAIL_ADDRESS: email(name), HIERARCHY_LEVEL_UUID: org, IS_ACTIVE: 'Y', DESIGNATION_UUID: des,
    IS_RISK_OWNER: owner, IS_RISK_CHAMPION: champ,
  }))
  out.PER_MST_ROLES = rows(ROLES, ([name, desc]) => ({ ROLE_NAME: name, ROLE_DESCRIPTION: desc, PARENT_ROLE_UUID: null }))
  out.PER_MST_USER_ROLES_MAPPING = rows(USER_ROLES, ([u, r]) => ({ USER_UUID: u, ROLE_UUID: r, IS_ACTIVE: 'Y' }))

  out.PER_MST_RISK_CATEGORY = rows(CATEGORIES, c => ({ RISK_CATEGORY: c, IS_ACTIVE: 'Y' }))
  out.PER_MST_RISK_TYPE = rows(CATEGORIES, c => ({ RISK_TYPE: c, IS_ACTIVE: 'Y' }))
  out.PER_MST_RISK_SUB_CATEGORY = rows(SUB_CATEGORIES, ([cat, name]) => ({ RISK_CATEGORY_UUID: cat, RISK_SUB_CATEGORY: name, IS_ACTIVE: 'Y' }))
  out.PER_MST_RISK_CAUSAL_FACTOR = rows(CAUSAL_FACTORS, f => ({ RISK_CAUSAL_FACTOR: f, IS_ACTIVE: 'Y' }))
  out.PER_MST_RISK_ROOT_CAUSE = rows(ROOT_CAUSES, ([n, d]) => ({ RISK_ROOT_CAUSE: n, ROOT_CAUSE_DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_RISK_DATA_SOURCE = rows(DATA_SOURCES, ([n, d]) => ({ RISK_DATA_SOURCE: n, RISK_DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_RISK_CYCLE = rows(RISK_CYCLES, ([n, d]) => ({ RISK_CYCLE: n, CYCLE_DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_LIKELIHOOD = rows(LIKELIHOOD, ([r, d, c], i) => ({ LIKELIHOOD_RATING: `${i} - ${r}`, LIKELIHOOD_DESCRIPTION: d, COLOR_RATING: c, IS_ACTIVE: 'Y' }))
  out.PER_MST_IMPACT = rows(IMPACT, ([r, d, c], i) => ({ IMPACT_RATING: `${i} - ${r}`, IMPACT_DESCRIPTION: d, COLOR_RATING: c, IS_ACTIVE: 'Y' }))
  out.PER_MST_IMPACT_CATEGORY = rows(IMPACT_CATEGORIES, ([n, d]) => ({ IMPACT_CATEGORY: n, IMPACT_DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_IMPACT_SUB_CATEGORY = rows(IMPACT_SUB, ([cat, n]) => ({ IMPACT_CATEGORY_UUID: cat, SUB_CATEGORY_UUID: n, DESCRIPTION: n, IS_ACTIVE: 'Y' }))
  out.PER_MST_IMPACT_PARTIES = rows(IMPACT_PARTIES, ([n, d]) => ({ IMPACT_PARTIES: n, DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_CURRENCY_TYPE = rows(CURRENCIES, c => ({ CURRENCY_TYPE: c, IS_ACTIVE: 'Y' }))
  out.PER_MST_RISK_COMPUTATION_LOGIC = [
    { UUID: 1, FORMULAE_TITLE: 'Likelihood × Impact', FORMULAE: 'L*I', FORMULAE_DESCRIPTION: 'Score 1–25: likelihood (1–5) multiplied by impact (1–5).', IS_ACTIVE: 'Y' },
  ]
  out.PER_MST_COMPUTATION_OUTPUT = []
  for (let l = 1; l <= 5; l++)
    for (let i = 1; i <= 5; i++) {
      const s = l * i
      const [band, colour] = s >= 15 ? ['Critical', '#C62828'] : s >= 10 ? ['High', '#EF6C00'] : s >= 5 ? ['Moderate', '#F9A825'] : ['Low', '#2E7D32']
      out.PER_MST_COMPUTATION_OUTPUT.push({ IMPACT_RATING: i, LIKELIHOOD_RATING: l, FORMULAE: 'L*I', OUTCOME: s, COLOUR_CODES: colour, OUTCOME_DESCRIPTION: band })
    }

  out.PER_MST_BUSINESS_PROCESS = rows(PROCESSES, ([n, d]) => ({ PROCESS_NAME: n, PROCESS_DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_BUSINESS_SUB_PROCESS = rows(SUB_PROCESSES, ([p, n]) => ({
    BUSINESS_PROCESS_UUID: p, BUSINESS_SUB_PROCESS_NAME: n, BUSINESS_SUB_PROCESS_DESCRIPTION: `${n} within ${PROCESSES[p - 1][0]}.`, IS_ACTIVE: 'Y',
  }))

  out.PER_MST_CONTROL_CATEGORY = rows(CONTROL_CATEGORIES, ([n, d]) => ({ CONTROL_CATEGORY: n, DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_CONTROL_TYPE = rows(CONTROL_TYPES, ([n, d]) => ({ CONTROL_TYPE: n, DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_CONTROL_CLASSIFICATION = rows(CONTROL_CLASSIFICATIONS, ([n, d]) => ({ CONTROL_CLASIFICATION: n, DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_CONTROL_DESIGN_EFFECTIVENESS = rows(DESIGN_EFFECTIVENESS, ([n, d]) => ({ CONTROL_DESIGN_EFFECTIVENESS: n, DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_CONTROL_FREQUENCY = rows(FREQUENCIES, n => ({ CONTROL_FREQUENCY: n, DESCRIPTION: `Performed ${n.toLowerCase()}.`, IS_ACTIVE: 'Y' }))
  out.PER_TRN_MITIGATION_TYPE = rows(MITIGATION_TYPES, ([n, d]) => ({ MITIGATION_TYPE: n, DESCRIPTION: d, IS_ACTIVE: 'Y' }))
  out.PER_MST_CONTROL_REGISTER = rows(CONTROL_REGISTER, ([n, d, cat, type, cls, owner]) => ({
    CONTROL_NAME: n, CONTROL_DESCRIPTION: d, CONTROL_SIGNIFICANCE: cls === 1 ? 'Key control' : 'Secondary control',
    CONTROL_CATEGORY_UUID: cat, CONTROL_TYPE_UUID: type, CONTROL_CLASSIFICATION_UUID: cls, CONTROL_OWNER: owner,
  }))

  out.ERM_TRN_ASSESSMENT_CYCLE = rows(CYCLES, ([refNo, name, period, start, end, deadline, status, notes]) => ({
    CYCLE_REFERENCE: refNo, CYCLE_NAME: name, CYCLE_TYPE: 'QUARTERLY', CYCLE_YEAR: 2026, CYCLE_PERIOD: period, ORG_HIERARCHY_UUID: 1,
    CYCLE_START_DATE: start, CYCLE_END_DATE: end, SUBMISSION_DEADLINE: deadline, STATUS: status, NOTES: notes, CREATED_BY: 'demo-seed',
  }))

  // Library statements: one per register entry, so the register can point at its library entry.
  out.PER_MST_RISK_STATEMENT = rows(RISKS, ([statement, cat, , , , , , inh, , , , sle, cause], n) => ({
    RISK_REFERENCE_NUMBER: `RS-${String(n).padStart(3, '0')}`, TITLE: statement, DESCRIPTION: statement + '.',
    RISK_TYPE_UUID: CATEGORIES.indexOf(cat) + 1, RISK_CATEGORY_UUID: CATEGORIES.indexOf(cat) + 1,
    RISK_CAUSAL_FACTOR_UUID: [1, 2, 3, 4][(cause - 1) % 4], CURRENCY_TYPE_UUID: 1, INHERIT_SLE: sle,
    INHERIT_LIKELIHOOD_UUID: inh?.[0] ?? null, INHERIT_IMPACT_UUID: inh?.[1] ?? null, IS_ACTIVE: 'Y', IS_DRAFT: 'N',
  }))

  out.PER_TRN_IDENTIFY_RISK = rows(RISKS, ([statement, cat, , proc, sub, owner, champ, inh, res, status, cycle, sle], n) => {
    const [, , , start, end] = cycleDates(cycle)
    const created = addDays(start, n)
    const decided = status === 'APPROVED' || status === 'REJECTED'
    return {
      ASSESSMENT_CYCLE_UUID: cycle, HIERARCHY_LEVEL: 2, HIERARCHY_NAME: ORG.findIndex(o => o[4] === owner) + 1 || 1,
      ASSESSMENT_REFERENCE_NUMBER: `RSK-2026-${String(n).padStart(3, '0')}`, ASSESSMENT_REGISTERED_DATE: created,
      ASSESSMENT_ACTUAL_START_DATE: created, ASSESSMENT_ACTUAL_END_DATE: status === 'DRAFT' ? null : addDays(created, 21),
      BUSINESS_PROCESS_UUID: processId(proc), BUSINESS_SUB_PROCESS_UUID: subProcessId(sub), RISK_TYPE_UUID: CATEGORIES.indexOf(cat) + 1,
      RISK_STATEMENT_UUID: n, IS_SOP_AVAILABLE: n % 3 ? 'Y' : 'N', INHERENT_SLE: sle, IS_STAGE_COMPLTED: decided ? 'Y' : 'N',
      START_DATE: start, END_DATE: end, RISK_STATEMENT: statement, RISK_TYPE: cat, SUB_PROCESS_NAME: sub, PROCESS_NAME: proc,
      CREATED_ON: created, RISK_CHAMPION_UUID: personId(champ), STATUS: 'Y', APPROVAL_STATUS: status,
      APPROVER_COMMENTS: status === 'REJECTED' ? 'Impact looks understated: include regulatory fines for data breaches and resubmit.' : status === 'APPROVED' ? 'Agreed. Rating and controls reviewed.' : null,
      APPROVED_BY: decided ? email(cycle === 1 ? 'Asha Menon' : 'Daniel Okafor') : null, APPROVED_ON: decided ? addDays(created, 28) : null,
      RISK_OWNER: owner, RISK_CHAMPION: champ, RISK_APPETITE: ['Strategic', 'Financial'].includes(cat) ? 'Open' : ['Health & Safety', 'Compliance'].includes(cat) ? 'Averse' : 'Cautious',
      INHERENT_LIKELIHOOD: inh?.[0] ?? null, INHERENT_IMPACT: inh?.[1] ?? null, RESIDUAL_LIKELIHOOD: res?.[0] ?? null, RESIDUAL_IMPACT: res?.[1] ?? null,
      LAST_UPDATED_BY: 'demo-seed', LAST_UPDATED_ON: created,
    }
  })

  // One inherent assessment per rated risk (the history the inherent-assessment screen shows).
  out.PER_TRN_INHERENT_RISK_ASSESSMENT = []
  out.PER_TRN_IMPACT_CATEGORY = []
  RISKS.forEach(([statement, cat, sub, , , owner, , inh, , , cycle, , cause], i) => {
    if (!inh) return
    const id = out.PER_TRN_INHERENT_RISK_ASSESSMENT.length + 1
    out.PER_TRN_INHERENT_RISK_ASSESSMENT.push({
      UUID: id, RISK_CATEGORY_UUID: CATEGORIES.indexOf(cat) + 1, RISK_SUB_CATEGORY_UUID: subId(sub),
      DESCRIPTION: `Assessed in the ${CYCLES[cycle - 1][1]} workshop: ${statement.toLowerCase()}.`, IS_ACTIVE: 'Y',
      RISK_CAUSAL_FACTOR_UUID: [1, 2, 3, 4][(cause - 1) % 4], RISK_DATA_SOURCE_UUID: (i % DATA_SOURCES.length) + 1,
      RISK_ROOT_CAUSE_UUID: String(cause), RISK_OWNERS: owner, RISK_LIKELIHOOD_UUID: inh[0], RISK_CYCLE_UUID: 3,
      RISK_IMPACT_PARTIES_UUID: cat === 'Compliance' ? 3 : 1, RISK_IMPACT_DESCRIPTION: IMPACT[inh[1] - 1][1],
      IS_STAGE_COMPLTED: 'Y', RISK_UUID: i + 1, IDENTIFY_RISK_UUID: i + 1, RISK_STATEMENT_UUID: i + 1, RISK_IMPACT_UUID: inh[1],
      CREATED_ON: addDays(CYCLES[cycle - 1][3], i + 3), CREATED_BY: 'priya.raman@example.com',
    })
    const impactCat = { Financial: 1, Compliance: 2, Reputational: 3, Technology: 4, 'Third Party': 5, 'Health & Safety': 5 }[cat] ?? 5
    const sub2 = IMPACT_SUB.findIndex(s => s[0] === impactCat) + 1 || null
    out.PER_TRN_IMPACT_CATEGORY.push({
      UUID: out.PER_TRN_IMPACT_CATEGORY.length + 1, IMPACT_CATEGORY_UUID: impactCat, INHERENT_RISK_ASSESSMENT_UUID: id,
      RISK_IMPACT_CATEGORY_UUID: impactCat, RISK_IMPACT_SUB_CATEGORY_UUID: sub2, RISK_INHERENT_IMPACT_LEVEL: inh[1],
      RISK_RESIDUAL_IMPACT_LEVEL: RISKS[i][8]?.[1] ?? null,
    })
  })

  // Library controls applied to risks, with the matching control-library link.
  out.PER_TRN_CONTROL_IMPLEMENTATION = []
  out.ERM_LNK_CONTROL_RISK = []
  const ratings = ['Effective', 'Effective', 'Partially Effective', 'Not tested']
  RISKS.forEach(([, , , , , owner, , inh, res, status, , , cause, codes], i) => {
    codes.forEach((code, j) => {
      const id = out.PER_TRN_CONTROL_IMPLEMENTATION.length + 1
      out.PER_TRN_CONTROL_IMPLEMENTATION.push({
        UUID: id, ROOT_CAUSE_UUID: cause, CONTROL_ID: control(code), CONTROL_OWNER: personId(owner), MITIGATION_TYPE: 1,
        CONTROL_FREQUENCY: code.includes('REC') ? 2 : code.includes('TRN') ? 6 : 1, CONTROL_DESIGN_EFFECTIVENESS: j ? 2 : 1,
        CONTROL_CLASIFICATION: j ? 2 : 1, CONTROL_TYPE: 1, CONTROL_CATEGORY: 1,
        INHERENT_LIKELIHOOD: inh?.[0] ?? null, RESIDUAL_LIKELIHOOD: res?.[0] ?? null, WEIGHTAGE_VALUE: j ? 40 : 60,
        IS_STAGE_COMPLTED: status === 'APPROVED' ? 'Y' : 'N', IDENTIFY_RISK_UUID: i + 1, ASSESSMENT_REFERENCE_NUMBER_UUID: 0,
        APPROVAL_STATUS: status === 'REJECTED' ? 'DRAFT' : status, RISK_UUID: i + 1,
        EVIDENCE_NOTES: 'Walkthrough and sample test of 25 items in the last quarter; no exceptions.',
        CONTROL_EFFECTIVENESS_RATING: ratings[(i + j) % ratings.length],
        RESIDUAL_IMPACT: res ? String(res[1]) : null, RESIDUAL_RISK_SCORE: res ? res[0] * res[1] : null, CONTROL_RELATIONSHIP_TYPE: 'NEW',
      })
      out.ERM_LNK_CONTROL_RISK.push({ CONTROL_UUID: control(code), RISK_UUID: i + 1, CREATED_BY: 'demo-seed' })
    })
  })
  const implFor = riskNo => out.PER_TRN_CONTROL_IMPLEMENTATION.find(c => c.IDENTIFY_RISK_UUID === riskNo)

  // Monitoring / action items on risks.
  const MONITORING = [
    [1, 'Set up a standby ERP environment with automatic failover', 'Order processing resumes within 4 hours if the primary ERP fails.', 'The ERP runs in one data centre with no standby.', 'Marcus Lee', '2026-07-15', '2026-12-15', 60, 'CONTROL_ENHANCEMENT'],
    [2, 'Quarterly restore test of ERP backups', 'Prove a full ERP restore inside the 8-hour RTO.', 'Restore never tested end to end.', 'Marcus Lee', '2026-07-01', '2026-09-30', 100, 'PERIODIC_REVIEW'],
    [3, 'Qualify a second supplier for critical components', 'Two approved suppliers for every A-class component.', 'Three critical components rely on one supplier.', 'Kenji Watanabe', '2026-10-05', '2027-03-31', 20, 'NEW_CONTROL_PROPOSAL'],
    [4, 'Enforce three-way match before any supplier payment', 'No invoice paid without a matching purchase order and goods receipt.', 'Invoices without a purchase order were paid manually.', 'Elena Petrova', '2026-07-01', '2026-09-30', 100, 'CONTROL_ENHANCEMENT'],
    [5, 'Automate bank-to-ledger reconciliation in the ERP', 'Remove manual matching for 95% of entries.', 'Manual spreadsheet reconciliation.', 'Elena Petrova', '2026-04-15', '2026-06-30', 100, 'CONTROL_ENHANCEMENT'],
    [9, 'Monthly safety walk-throughs on every production line', 'Lost-time injury rate below 0.5 per 200,000 hours worked.', 'Two near misses on line 3 in Q2.', 'Tom Becker', '2026-07-01', '2026-12-31', 50, 'PERIODIC_REVIEW'],
    [16, 'Quarterly review of ERP user access', 'Access no longer needed is removed within 5 days of each review.', 'Leavers kept ERP access for weeks after leaving.', 'Marcus Lee', '2026-08-01', '2026-10-31', 80, 'PERIODIC_REVIEW'],
    [17, 'Standby logistics partner for peak season', 'Signed standby contract in place before November.', 'One carrier handles 90% of deliveries.', 'Kenji Watanabe', '2026-10-05', '2026-11-30', 10, 'NEW_CONTROL_PROPOSAL'],
  ]
  out.PER_TRN_RISK_MONITORING = MONITORING.map(([risk, title, goal, cause, owner, start, end, pct, type], i) => {
    const impl = implFor(risk)
    const status = RISKS[risk - 1][9]
    return {
      UUID: i + 1, ROOT_CAUSE: cause, MONITORING_TITLE: title, MONITORING_GOAL: goal, CONTROLS_UUID: impl ? impl.CONTROL_ID : null,
      MITIGATION_OWNER: owner, ESTIMATED_START_DATE: start, ESTIMATED_END_DATE: end, ACTUAL_START_DATE: start,
      ACTUAL_END_DATE: pct === 100 ? end : null, IS_STAGE_COMPLTED: pct === 100 ? 'Y' : 'N',
      APPROVAL_STATUS: status === 'APPROVED' ? 'APPROVED' : 'DRAFT', RISK_UUID: risk, IDENTIFY_RISK_UUID: risk,
      ASSESSMENT_REFERENCE_NUMBER_UUID: 0, COMPLETION_PCT: pct, CONTROL_IMPLEMENTATION_UUID: impl ? impl.UUID : null, MONITORING_TYPE: type,
    }
  })

  // Mitigation plans, as a small hierarchy (programme → workstreams).
  const PLANS = [
    [null, 'Programme', 'Cyber resilience programme 2026', 'Raise cyber maturity across the group and protect the ERP.', 'In Progress', 2, 'Marcus Lee', '2026-04-01', '2027-03-31'],
    [1, 'Reduce', 'Phishing-resistant MFA for ERP administrators', 'Replace SMS codes with security keys for all administrators.', 'In Progress', 16, 'Marcus Lee', '2026-07-01', '2026-12-31'],
    [1, 'Reduce', 'Immutable backups for the ERP', 'Write-once backups held in a separate cloud account.', 'Completed', 2, 'Marcus Lee', '2026-04-01', '2026-09-30'],
    [null, 'Programme', 'Supply-chain resilience', 'Remove single points of failure across suppliers and logistics.', 'In Progress', 3, 'Kenji Watanabe', '2026-10-01', '2027-06-30'],
    [4, 'Reduce', 'Dual-source critical components', 'Qualify alternative suppliers for 12 A-class components.', 'Not Started', 3, 'Kenji Watanabe', '2026-11-15', '2027-03-31'],
    [null, 'Transfer', 'Product liability and recall insurance renewal', 'Renew the policy with a $10m limit.', 'Completed', 10, 'Elena Petrova', '2026-05-01', '2026-06-30'],
    [null, 'Reduce', 'Retention plan for key engineers', 'Retention bonuses and career paths for 25 critical roles.', 'On Hold', 7, 'Nadia Rahman', '2026-10-15', '2027-01-31'],
  ]
  out.PER_TRN_MITIGATION_PLANS = PLANS.map(([parent, type, statement, activities, status, risk, owner, start, end], i) => ({
    UUID: i + 1, PARENT_PLAN_UUID: parent, PLAN_TYPE: type, PLAN_STATEMENT: statement, PLAN_ACTIVITIES: activities,
    PLAN_START_DATE: start, PLAN_END_DATE: end, IS_ACTIVE: 'Y', OVERALL_STATUS: status, PLAN_REFERENCE: `MP-2026-${String(i + 1).padStart(3, '0')}`,
    RISK_UUID: risk, MITIGATION_OWNER: owner, CREATED_BY: 'demo-seed', CREATED_ON: start,
  }))

  // Incidents from the module seed, linked to the risks they relate to.
  out.ERM_LNK_INCIDENT_RISK = [
    ['INC-001', 1], ['INC-002', 2], ['INC-003', 5], ['INC-004', 17],
  ].map(([inc, risk]) => ({ INCIDENT_UUID: ref('ERM_TRN_INCIDENT', 'INCIDENT_REF', inc), RISK_UUID: risk, CREATED_BY: 'demo-seed' }))

  // KPIs with six months of actuals.
  const KPIS = [
    ['KPI-RCSA-01', 'RCSA completion on time', 'Share of assessments submitted by the cycle deadline.', 'Governance', 95, 'HIGHER', [82, 86, 90, 88, 93, 96]],
    ['KPI-ACT-02', 'Overdue risk actions', 'Number of mitigation actions past their due date.', 'Governance', 5, 'LOWER', [14, 12, 9, 10, 7, 6]],
    ['KPI-CTL-03', 'Key controls tested this quarter', 'Share of key controls tested in the quarter.', 'Assurance', 100, 'HIGHER', [70, 78, 85, 90, 92, 97]],
    ['KPI-INC-04', 'Mean time to close incidents (days)', 'Average days from report to closure.', 'Operations', 10, 'LOWER', [21, 18, 16, 15, 12, 11]],
  ]
  out.ERM_MST_KPI_DEFINITION = rows(KPIS, ([code, name, desc, cat, target, dir]) => ({
    KPI_CODE: code, KPI_NAME: name, KPI_DESCRIPTION: desc, KPI_CATEGORY: cat, TARGET_VALUE: target, TARGET_DIRECTION: dir, IS_ACTIVE: 'Y', CREATED_BY: 'demo-seed',
  }))
  const MONTH_ENDS = ['2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31']
  out.ERM_TRN_KPI_ACTUALS = KPIS.flatMap(([, , , , target, , values], k) =>
    values.map((v, m) => ({
      KPI_UUID: k + 1, PERIOD_DATE: MONTH_ENDS[m], ACTUAL_VALUE: v, TARGET_VALUE: target, VARIANCE: v - target,
      VARIANCE_PCT: Math.round(((v - target) / target) * 10000) / 100, ENTERED_BY: 'demo-seed',
    })),
  ).map((r, i) => ({ UUID: i + 1, ...r }))

  return out
}
