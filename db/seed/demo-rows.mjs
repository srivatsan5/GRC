/**
 * Optional demo content for the new modules, as database rows.
 * Source: demo-data.json (the sample records the app used to keep in the browser).
 * Used by the local fake database (api/scripts/fake-ords.ts) and to generate demo_data.sql.
 *
 * Links to risk-register rows are not seeded: the old samples referenced made-up
 * risk ids (R-001…), and inventing links to real risks would be misleading.
 */
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('./demo-data.json', import.meta.url), 'utf8'))
const SEED_USER = 'demo-seed'
const audit = { CREATED_BY: SEED_USER }

/** Same rule the app uses (lib/kri.ts). */
export function kriLight(value, k) {
  if (k.direction === 'higher-worse') return value >= k.redThreshold ? 'RED' : value >= k.amberThreshold ? 'AMBER' : 'GREEN'
  return value <= k.redThreshold ? 'RED' : value <= k.amberThreshold ? 'AMBER' : 'GREEN'
}

/**
 * Returns rows per table. Parent references use `{ $ref: [table, naturalKeyColumn, value] }`,
 * resolved to the parent's UUID by the consumer (a subquery in SQL, a lookup in the fake DB).
 */
export function demoRows() {
  const controlCodeById = Object.fromEntries(data.controls.map(c => [c.id, c.code]))
  const rows = {}

  rows.ERM_MST_CONTROL = data.controls.map(c => ({
    CONTROL_CODE: c.code, CONTROL_NAME: c.name, DESCRIPTION: c.description, CONTROL_TYPE: c.type,
    CONTROL_NATURE: c.nature, FREQUENCY: c.frequency, OWNER_NAME: c.owner, FRAMEWORKS: (c.framework || []).join(', '),
    DESIGN_EFFECTIVENESS: c.designEffectiveness, OPERATING_EFFECTIVENESS: c.operatingEffectiveness,
    LAST_TESTED_ON: c.lastTested ?? null, STATUS: c.status, ...audit,
  }))

  rows.ERM_MST_POLICY = data.policies.map(p => ({
    POLICY_CODE: p.code, TITLE: p.title, CATEGORY: p.category, VERSION_LABEL: p.version, OWNER_NAME: p.owner,
    EFFECTIVE_DATE: p.effectiveDate, NEXT_REVIEW_DATE: p.nextReview, ACKNOWLEDGED_PCT: p.acknowledgmentPct, STATUS: p.status, ...audit,
  }))
  rows.ERM_LNK_POLICY_CONTROL = data.policies.flatMap(p =>
    (p.linkedControls || []).filter(id => controlCodeById[id]).map(id => ({
      POLICY_UUID: { $ref: ['ERM_MST_POLICY', 'POLICY_CODE', p.code] },
      CONTROL_UUID: { $ref: ['ERM_MST_CONTROL', 'CONTROL_CODE', controlCodeById[id]] },
      ...audit,
    })),
  )

  rows.ERM_TRN_INCIDENT = data.incidents.map(i => ({
    INCIDENT_REF: i.id, TITLE: i.title, DESCRIPTION: i.description, SEVERITY: i.severity, STATUS: i.status,
    CATEGORY: i.category, REPORTED_BY: i.reportedBy, ASSIGNED_TO: i.assignedTo, REPORTED_ON: i.reportedOn,
    CLOSED_ON: i.status === 'Closed' || i.status === 'Mitigated' ? i.closedOn ?? null : null,
    ROOT_CAUSE: i.rootCause ?? null, CORRECTIVE_ACTION: i.correctiveAction ?? null, ...audit,
  }))

  rows.ERM_MST_VENDOR = data.vendors.map(v => ({
    VENDOR_NAME: v.name, CATEGORY: v.category, TIER: v.tier, COUNTRY_CODE: v.country, CONTRACT_VALUE: v.contractValue,
    RISK_SCORE: v.riskScore, LAST_ASSESSMENT_ON: v.lastAssessment, NEXT_REVIEW_ON: v.nextReview, CONTACT_EMAIL: v.contact,
    OPEN_FINDINGS: v.findings, STATUS: v.status, ...audit,
  }))

  rows.ERM_MST_BCP_PLAN = data.bcp.map(b => ({
    PLAN_NAME: b.name, SCOPE: b.scope, RTO_HOURS: b.rto, RPO_HOURS: b.rpo, OWNER_NAME: b.owner,
    LAST_TESTED_ON: b.lastTested ?? null, NEXT_TEST_ON: b.nextTest, STATUS: 'Active', ...audit,
  }))

  rows.ERM_MST_SCENARIO = data.scenarios.map(s => ({
    SCENARIO_NAME: s.name, DESCRIPTION: s.description, SCENARIO_TYPE: s.type, CATEGORY: s.category,
    SHOCK_PCT: s.shockMagnitude, BASELINE_LOSS: s.baselineLoss, STRESSED_LOSS: s.stressedLoss,
    PROBABILITY_PCT: s.probability, OWNER_NAME: s.owner, LAST_RUN_ON: s.lastRun ?? null, ...audit,
  }))

  rows.ERM_MST_RISK_APPETITE = data.appetite.map(a => ({
    CATEGORY: a.category, STATEMENT: a.description, POSTURE: a.posture, TOLERANCE_SCORE: a.tolerance,
    APPROVED_BY: a.approvedBy, APPROVED_ON: a.approvedOn, REVIEW_FREQUENCY: a.review, ...audit,
  }))

  rows.ERM_MST_KRI_DEFINITION = data.kris.map(k => ({
    KRI_CODE: k.code, KRI_NAME: k.name, KRI_CATEGORY: k.category, OWNER_NAME: k.owner, UNIT_OF_MEASURE: k.unit,
    GREEN_THRESHOLD: k.greenThreshold, AMBER_THRESHOLD: k.amberThreshold, RED_THRESHOLD: k.redThreshold,
    DIRECTION: k.direction === 'lower-worse' ? 'LOWER_WORSE' : 'HIGHER_WORSE', MEASUREMENT_FREQUENCY: 'Monthly',
    IS_ACTIVE: k.active ? 'Y' : 'N', ...audit,
  }))
  rows.ERM_TRN_KRI_READINGS = data.kris.flatMap(k =>
    k.history.map(h => {
      const light = kriLight(h.value, k)
      return {
        KRI_UUID: { $ref: ['ERM_MST_KRI_DEFINITION', 'KRI_CODE', k.code] },
        READING_DATE: h.date, READING_VALUE: h.value, TRAFFIC_LIGHT: light, IS_BREACH: light === 'RED' ? 'Y' : 'N',
        RECORDED_BY: SEED_USER,
      }
    }),
  )

  const STATUS = { Pending: 'Pending', 'In Review': 'In Review', Approved: 'Approved', Rejected: 'Rejected' }
  rows.ERM_TRN_APPROVAL_REQUEST = data.workflow.map(w => ({
    TITLE: w.title, REQUEST_TYPE: w.type, BUSINESS_UNIT: w.business, AMOUNT: w.amount ?? null, STATUS: STATUS[w.status] ?? 'Pending',
    SUBMITTED_BY: `${w.submittedBy.toLowerCase().replace(/\s+/g, '.')}@demo.local`, SUBMITTED_NAME: w.submittedBy,
    SUBMITTED_ON: w.submittedOn, ...audit,
  }))
  rows.ERM_TRN_APPROVAL_STEP = data.workflow.flatMap(w =>
    w.approvers.map((a, i) => ({
      REQUEST_UUID: { $ref: ['ERM_TRN_APPROVAL_REQUEST', 'TITLE', w.title] },
      STEP_NO: i + 1,
      APPROVER_ROLE: a.role === 'Administrator' ? 'Administrator' : 'Risk Manager',
      DECISION: a.decision ?? null,
      DECIDED_NAME: a.decision ? a.name : null,
      DECIDED_BY: a.decision ? `${a.name.toLowerCase().replace(/\s+/g, '.')}@demo.local` : null,
      DECIDED_ON: a.on ?? null,
      COMMENTS: a.comment ?? (a.decision === 'Rejected' ? 'Rejected (demo data)' : null),
      ...audit,
    })),
  )
  return rows
}
