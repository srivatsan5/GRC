#!/usr/bin/env node
/**
 * Writes 10_more_demo_data.sql: an ADD-ON to an installed demo schema (install_all.sql already run).
 * It adds 9 risks (3 to each cycle), a planned cycle, and for those risks their library
 * statement, inherent assessment, impact rating, applied controls, monitoring actions, mitigation
 * plans and incident links. Nothing is erased.
 *
 * Everything is ONE PL/SQL block, so Database Actions sends it in a single round trip: seconds,
 * not minutes. New rows take their ids from the identity columns; links use the ids just created
 * or a natural key (control code, incident reference, risk reference). Running it twice adds
 * nothing the second time.
 *
 *   node db/install/tools/more.mjs      (also run by build-all.mjs)
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES, CYCLES, IMPACT, ORG, addDays, email, personId, processId, subId, subProcessId } from './mock-curated.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// statement, category, sub-category, process, sub-process, owner, champion, [L, I], [rL, rI] | null,
// status, cycle, SLE, root cause, control codes
const MORE_RISKS = [
  ['Payroll errors pay staff incorrectly', 'Operational', 'Process execution', 'Hire to Retire', 'Payroll', 'Nadia Rahman', 'Priya Raman', [2, 3], [1, 2], 'APPROVED', 1, 150000, 2, []],
  ['Stock-outs caused by inaccurate inventory records', 'Operational', 'Process execution', 'Inventory & Logistics', 'Warehousing', 'Kenji Watanabe', 'Priya Raman', [4, 3], [3, 2], 'APPROVED', 1, 500000, 2, []],
  ['Sales tax miscalculated on cross-border invoices', 'Compliance', 'Regulatory change', 'Record to Report', 'Statutory reporting', 'Fatima Al-Sayed', 'Daniel Okafor', [3, 3], [1, 3], 'APPROVED', 1, 350000, 6, ['CTL-COMP-MON-08']],
  ['Excessive ERP access rights allow unauthorised changes', 'Technology', 'Access management', 'IT Operations', 'Access management', 'Marcus Lee', 'Priya Raman', [3, 4], [2, 3], 'APPROVED', 2, 900000, 1, ['CTL-IT-AUTH-01', 'CTL-FIN-SOD-07']],
  ['Customer personal data exposed through a CRM misconfiguration', 'Compliance', 'Data privacy', 'Customer Service', 'Complaints handling', 'Fatima Al-Sayed', 'Daniel Okafor', [3, 5], [2, 4], 'SUBMITTED', 2, 2500000, 1, ['CTL-COMP-TRN-04']],
  ['Logistics partner fails to deliver during peak season', 'Third Party', 'Outsourcing', 'Inventory & Logistics', 'Distribution', 'Kenji Watanabe', 'Grace Mensah', [3, 3], [2, 3], 'APPROVED', 2, 400000, 5, ['CTL-VEN-DUE-06']],
  ['Product recall caused by a quality defect', 'Reputational', 'Product quality', 'Plan to Produce', 'Quality control', 'Tom Becker', 'Grace Mensah', [2, 5], [2, 4], 'SUBMITTED', 3, 5000000, 1, []],
  ['Three largest customers make up 45% of revenue', 'Strategic', 'Market', 'Order to Cash', 'Order management', 'Carlos Mendes', 'Daniel Okafor', [3, 4], null, 'DRAFT', 3, 6000000, 7, []],
  ['Inflated employee expense claims', 'Operational', 'Fraud', 'Record to Report', 'Reconciliation', 'Elena Petrova', 'Priya Raman', [2, 2], [1, 2], 'IN_REVIEW', 3, 50000, 4, ['CTL-FIN-SOD-07']],
]
const FIRST_NO = 10 // the install's risks are RSK-2026-001 … 009

// risk no, title, goal, root cause, owner, start, end, % complete, type
const MORE_MONITORING = [
  [11, 'Weekly cycle counts in every warehouse', 'Stock records match the shelves within 1%.', 'Counts were done once a year.', 'Kenji Watanabe', '2026-04-15', '2026-06-30', 100, 'PERIODIC_REVIEW'],
  [13, 'Quarterly review of ERP user access', 'Access no longer needed is removed within 5 days of each review.', 'Leavers kept ERP access for weeks after leaving.', 'Marcus Lee', '2026-08-01', '2026-10-31', 80, 'PERIODIC_REVIEW'],
  [15, 'Standby logistics partner for peak season', 'Signed standby contract in place before November.', 'One carrier handles 90% of deliveries.', 'Kenji Watanabe', '2026-10-05', '2026-11-30', 10, 'NEW_CONTROL_PROPOSAL'],
]
// parent plan statement | null, type, statement, activities, status, risk no, owner, start, end
const MORE_PLANS = [
  ['Cyber resilience programme 2026', 'Reduce', 'Quarterly review of ERP administrator accounts', 'Review every administrator account each quarter and remove what is not needed.', 'In Progress', 13, 'Marcus Lee', '2026-07-01', '2026-12-31'],
  [null, 'Reduce', 'Supplier master-data clean-up', 'Remove dormant suppliers and verify bank details of active ones.', 'On Hold', 2, 'Elena Petrova', '2026-10-15', '2027-01-31'],
  [null, 'Avoid', 'Outsource night-shift quality checks', 'Dropped in favour of training the in-house quality team.', 'Cancelled', 16, 'Tom Becker', '2026-09-01', '2026-09-30'],
]
// incident reference → risk reference
const MORE_INCIDENT_LINKS = [
  ['INC-005', 'RSK-2026-006'], ['INC-006', 'RSK-2026-002'], ['INC-007', 'RSK-2026-001'], ['INC-008', 'RSK-2026-014'],
]

const q = v => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const d = v => (v ? `DATE '${v}'` : 'NULL')
const ref = n => `RSK-2026-${String(n).padStart(3, '0')}`
const ins = (table, cols, ret) =>
  `  INSERT INTO ${table} (${Object.keys(cols).join(', ')})\n    VALUES (${Object.values(cols).join(', ')})${ret ? ` RETURNING UUID INTO ${ret}` : ''};`

const lines = []
MORE_RISKS.forEach(([statement, cat, sub, proc, subProc, owner, champ, inh, res, status, cycle, sle, cause, codes], i) => {
  const n = FIRST_NO + i
  const [, cycleName, , start, end] = CYCLES[cycle - 1]
  const created = addDays(start, n)
  const decided = status === 'APPROVED' || status === 'REJECTED'
  const catId = CATEGORIES.indexOf(cat) + 1
  lines.push(`\n  -- ${ref(n)}: ${statement} (${cycleName}, ${status})`)
  lines.push(
    ins('PER_MST_RISK_STATEMENT', {
      RISK_REFERENCE_NUMBER: q(`RS-${String(n).padStart(3, '0')}`), TITLE: q(statement), DESCRIPTION: q(statement + '.'),
      RISK_TYPE_UUID: catId, RISK_CATEGORY_UUID: catId, RISK_CAUSAL_FACTOR_UUID: [1, 2, 3, 4][(cause - 1) % 4], CURRENCY_TYPE_UUID: 1,
      INHERIT_SLE: q(sle), INHERIT_LIKELIHOOD_UUID: q(inh?.[0] ?? null), INHERIT_IMPACT_UUID: q(inh?.[1] ?? null), IS_ACTIVE: q('Y'), IS_DRAFT: q('N'),
    }, 's'),
  )
  lines.push(
    ins('PER_TRN_IDENTIFY_RISK', {
      ASSESSMENT_CYCLE_UUID: `(SELECT UUID FROM ERM_TRN_ASSESSMENT_CYCLE WHERE CYCLE_REFERENCE = ${q(CYCLES[cycle - 1][0])})`,
      HIERARCHY_LEVEL: 2, HIERARCHY_NAME: ORG.findIndex(o => o[4] === owner) + 1 || 1,
      ASSESSMENT_REFERENCE_NUMBER: q(ref(n)), ASSESSMENT_REGISTERED_DATE: d(created), ASSESSMENT_ACTUAL_START_DATE: d(created),
      ASSESSMENT_ACTUAL_END_DATE: d(status === 'DRAFT' ? null : addDays(created, 21)),
      BUSINESS_PROCESS_UUID: processId(proc), BUSINESS_SUB_PROCESS_UUID: subProcessId(subProc), RISK_TYPE_UUID: catId, RISK_STATEMENT_UUID: 's',
      IS_SOP_AVAILABLE: q(n % 3 ? 'Y' : 'N'), INHERENT_SLE: q(sle), IS_STAGE_COMPLTED: q(decided ? 'Y' : 'N'), START_DATE: d(start), END_DATE: d(end),
      RISK_STATEMENT: q(statement), RISK_TYPE: q(cat), SUB_PROCESS_NAME: q(subProc), PROCESS_NAME: q(proc), CREATED_ON: d(created),
      RISK_CHAMPION_UUID: personId(champ), STATUS: q('Y'), APPROVAL_STATUS: q(status),
      APPROVER_COMMENTS: q(status === 'APPROVED' ? 'Agreed. Rating and controls reviewed.' : null),
      APPROVED_BY: q(decided ? email(cycle === 1 ? 'Asha Menon' : 'Daniel Okafor') : null), APPROVED_ON: d(decided ? addDays(created, 28) : null),
      RISK_OWNER: q(owner), RISK_CHAMPION: q(champ),
      RISK_APPETITE: q(['Strategic', 'Financial'].includes(cat) ? 'Open' : ['Health & Safety', 'Compliance'].includes(cat) ? 'Averse' : 'Cautious'),
      INHERENT_LIKELIHOOD: q(inh?.[0] ?? null), INHERENT_IMPACT: q(inh?.[1] ?? null), RESIDUAL_LIKELIHOOD: q(res?.[0] ?? null), RESIDUAL_IMPACT: q(res?.[1] ?? null),
      LAST_UPDATED_BY: q('demo-seed'), LAST_UPDATED_ON: d(created),
    }, 'r'),
  )
  if (inh) {
    lines.push(
      ins('PER_TRN_INHERENT_RISK_ASSESSMENT', {
        RISK_CATEGORY_UUID: catId, RISK_SUB_CATEGORY_UUID: subId(sub), DESCRIPTION: q(`Assessed in the ${cycleName} workshop: ${statement.toLowerCase()}.`),
        IS_ACTIVE: q('Y'), RISK_CAUSAL_FACTOR_UUID: [1, 2, 3, 4][(cause - 1) % 4], RISK_DATA_SOURCE_UUID: (i % 5) + 1, RISK_ROOT_CAUSE_UUID: q(String(cause)),
        RISK_OWNERS: q(owner), RISK_LIKELIHOOD_UUID: inh[0], RISK_CYCLE_UUID: 3, RISK_IMPACT_PARTIES_UUID: cat === 'Compliance' ? 3 : 1,
        RISK_IMPACT_DESCRIPTION: q(IMPACT[inh[1] - 1][1]), IS_STAGE_COMPLTED: q('Y'), RISK_UUID: 'r', IDENTIFY_RISK_UUID: 'r', RISK_STATEMENT_UUID: 's',
        RISK_IMPACT_UUID: inh[1], CREATED_ON: d(addDays(start, n + 3)), CREATED_BY: q('priya.raman@example.com'),
      }, 'a'),
    )
    const impactCat = { Financial: 1, Compliance: 2, Reputational: 3, Technology: 4, 'Third Party': 5 }[cat] ?? 5
    lines.push(
      ins('PER_TRN_IMPACT_CATEGORY', {
        IMPACT_CATEGORY_UUID: impactCat, INHERENT_RISK_ASSESSMENT_UUID: 'a', RISK_IMPACT_CATEGORY_UUID: impactCat,
        RISK_INHERENT_IMPACT_LEVEL: inh[1], RISK_RESIDUAL_IMPACT_LEVEL: q(res?.[1] ?? null),
      }),
    )
  }
  codes.forEach((code, j) => {
    const control = `(SELECT UUID FROM ERM_MST_CONTROL WHERE CONTROL_CODE = ${q(code)})`
    lines.push(
      ins('PER_TRN_CONTROL_IMPLEMENTATION', {
        ROOT_CAUSE_UUID: cause, CONTROL_ID: control, CONTROL_OWNER: personId(owner), MITIGATION_TYPE: 1, CONTROL_FREQUENCY: 1,
        CONTROL_DESIGN_EFFECTIVENESS: j ? 2 : 1, CONTROL_CLASIFICATION: j ? 2 : 1, CONTROL_TYPE: 1, CONTROL_CATEGORY: 1,
        INHERENT_LIKELIHOOD: q(inh?.[0] ?? null), RESIDUAL_LIKELIHOOD: q(res?.[0] ?? null), WEIGHTAGE_VALUE: j ? 40 : 60,
        IS_STAGE_COMPLTED: q(status === 'APPROVED' ? 'Y' : 'N'), IDENTIFY_RISK_UUID: 'r', ASSESSMENT_REFERENCE_NUMBER_UUID: 0,
        APPROVAL_STATUS: q(status), RISK_UUID: 'r', EVIDENCE_NOTES: q('Walkthrough and sample test of 25 items in the last quarter; no exceptions.'),
        CONTROL_EFFECTIVENESS_RATING: q(['Effective', 'Partially Effective', 'Not tested'][(i + j) % 3]),
        RESIDUAL_IMPACT: q(res ? String(res[1]) : null), RESIDUAL_RISK_SCORE: q(res ? res[0] * res[1] : null), CONTROL_RELATIONSHIP_TYPE: q('NEW'),
      }),
    )
    lines.push(`  INSERT INTO ERM_LNK_CONTROL_RISK (CONTROL_UUID, RISK_UUID, CREATED_BY) VALUES (${control}, r, 'demo-seed');`)
  })
})

const riskId = n => `(SELECT UUID FROM PER_TRN_IDENTIFY_RISK WHERE ASSESSMENT_REFERENCE_NUMBER = ${q(n)})`
lines.push('\n  -- Monitoring actions')
for (const [no, title, goal, cause, owner, start, end, pct, type] of MORE_MONITORING) {
  const status = MORE_RISKS[no - FIRST_NO][9]
  lines.push(
    ins('PER_TRN_RISK_MONITORING', {
      ROOT_CAUSE: q(cause), MONITORING_TITLE: q(title), MONITORING_GOAL: q(goal),
      CONTROLS_UUID: `(SELECT MIN(CONTROL_ID) FROM PER_TRN_CONTROL_IMPLEMENTATION WHERE IDENTIFY_RISK_UUID = ${riskId(ref(no))})`,
      MITIGATION_OWNER: q(owner), ESTIMATED_START_DATE: d(start), ESTIMATED_END_DATE: d(end), ACTUAL_START_DATE: d(start),
      ACTUAL_END_DATE: d(pct === 100 ? end : null), IS_STAGE_COMPLTED: q(pct === 100 ? 'Y' : 'N'),
      APPROVAL_STATUS: q(status === 'APPROVED' ? 'APPROVED' : 'DRAFT'), RISK_UUID: riskId(ref(no)), IDENTIFY_RISK_UUID: riskId(ref(no)),
      ASSESSMENT_REFERENCE_NUMBER_UUID: 0, COMPLETION_PCT: pct,
      CONTROL_IMPLEMENTATION_UUID: `(SELECT MIN(UUID) FROM PER_TRN_CONTROL_IMPLEMENTATION WHERE IDENTIFY_RISK_UUID = ${riskId(ref(no))})`,
      MONITORING_TYPE: q(type),
    }),
  )
}
lines.push('\n  -- Mitigation plans')
MORE_PLANS.forEach(([parent, type, statement, activities, status, no, owner, start, end], i) => {
  lines.push(
    ins('PER_TRN_MITIGATION_PLANS', {
      PARENT_PLAN_UUID: parent ? `(SELECT MIN(UUID) FROM PER_TRN_MITIGATION_PLANS WHERE PLAN_STATEMENT = ${q(parent)})` : 'NULL',
      PLAN_TYPE: q(type), PLAN_STATEMENT: q(statement), PLAN_ACTIVITIES: q(activities), PLAN_START_DATE: d(start), PLAN_END_DATE: d(end),
      IS_ACTIVE: q('Y'), OVERALL_STATUS: q(status), PLAN_REFERENCE: q(`MP-2026-${String(10 + i).padStart(3, '0')}`),
      RISK_UUID: riskId(ref(no)), MITIGATION_OWNER: q(owner), CREATED_BY: q('demo-seed'), CREATED_ON: d(start),
    }),
  )
})
lines.push('\n  -- Incidents linked to risks')
for (const [inc, risk] of MORE_INCIDENT_LINKS) {
  lines.push(`  INSERT INTO ERM_LNK_INCIDENT_RISK (INCIDENT_UUID, RISK_UUID, CREATED_BY)
    SELECT i.UUID, r.UUID, 'demo-seed' FROM ERM_TRN_INCIDENT i, PER_TRN_IDENTIFY_RISK r
     WHERE i.INCIDENT_REF = ${q(inc)} AND r.ASSESSMENT_REFERENCE_NUMBER = ${q(risk)}
       AND NOT EXISTS (SELECT 1 FROM ERM_LNK_INCIDENT_RISK l WHERE l.INCIDENT_UUID = i.UUID AND l.RISK_UUID = r.UUID);`)
}
lines.push(`\n  -- The next cycle, planned and not started
  INSERT INTO ERM_TRN_ASSESSMENT_CYCLE (CYCLE_REFERENCE, CYCLE_NAME, CYCLE_TYPE, CYCLE_YEAR, CYCLE_PERIOD, ORG_HIERARCHY_UUID,
      CYCLE_START_DATE, CYCLE_END_DATE, SUBMISSION_DEADLINE, STATUS, NOTES, CREATED_BY)
    VALUES ('RCSA-2027-1', 'Q1 2027 RCSA', 'QUARTERLY', 2027, 'Q1', 1, DATE '2027-01-01', DATE '2027-03-31', DATE '2027-03-15',
      'Planned', 'Next cycle: scope agreed, starts in January.', 'demo-seed');`)

const sql = `-- =============================================================================
-- 10  More demo data (add-on; run AFTER install_all.sql)
-- Adds ${MORE_RISKS.length} risks (3 to each cycle) with their assessments, applied controls, monitoring
-- actions, mitigation plans and incident links, plus a planned Q1 2027 cycle. Erases nothing.
-- One block, so Database Actions runs it in seconds. Safe to run twice: the second run adds nothing.
-- Generated by db/install/tools/more.mjs. Do not edit by hand.
-- =============================================================================
SET DEFINE OFF
SET SERVEROUTPUT ON
DECLARE
  r NUMBER; -- the risk just added
  s NUMBER; -- its library statement
  a NUMBER; -- its inherent assessment
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM PER_TRN_IDENTIFY_RISK WHERE ASSESSMENT_REFERENCE_NUMBER = '${ref(FIRST_NO)}';
  IF n > 0 THEN
    DBMS_OUTPUT.PUT_LINE('More demo data is already there. Nothing added.');
    RETURN;
  END IF;
${lines.join('\n')}

  COMMIT;
  SELECT COUNT(*) INTO n FROM PER_TRN_IDENTIFY_RISK;
  DBMS_OUTPUT.PUT_LINE('Added ${MORE_RISKS.length} risks and their data. The register now holds ' || n || ' risks.');
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    DBMS_OUTPUT.PUT_LINE('Nothing was added: ' || SQLERRM);
    RAISE;
END;
/
`
writeFileSync(join(root, '10_more_demo_data.sql'), sql)
console.log(`10_more_demo_data.sql: ${MORE_RISKS.length} risks, ${MORE_MONITORING.length} actions, ${MORE_PLANS.length} plans`)
