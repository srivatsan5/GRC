/**
 * Every table the API exposes, and exactly what may be done with it.
 * Anything not listed here is not reachable through the API.
 *
 * Column names are the real Oracle column names (including legacy typos such
 * as IS_STAGE_COMPLTED). Clients may send them in any case.
 */

export type ColumnType =
  | 'id' //      positive integer foreign key
  | 'int' //     integer (>= 0)
  | 'number' //  any finite number
  | 'percent' // 0..100
  | 'flag' //    'Y' | 'N'
  | 'date' //    ISO date or date-time
  | 'text' //    string, max 4000
  | 'approval' // approval workflow status
  | 'scalar' //  string or number (legacy columns whose Oracle type is not pinned down yet)
  | 'rating' //  whole number 1..5
  | 'email' //   e-mail address

/** A text column restricted to fixed values (matching the Oracle CHECK constraint). */
export interface EnumColumn {
  enum: readonly string[]
}
/** A whole number within [min, max]. */
export interface RangeColumn {
  range: readonly [number, number]
}
export type ColumnSpec = ColumnType | EnumColumn | RangeColumn

export type ServerField = 'created_on' | 'created_by' | 'updated_on' | 'updated_by' | 'approved_on'

export interface WritableTable {
  access: 'write'
  label: string
  columns: Record<string, ColumnSpec>
  /** Columns searched by `?search=` (defaults to every text column). */
  search?: string[]
  /** Permission needed to create/update/delete (default: create / update / delete). */
  writePermission?: 'approve' | 'users:manage'
  required?: string[]
  /** Applied on create only, and only when the client did not send the column. */
  defaults?: Record<string, string | number>
  /** Columns filled by the server from the authenticated user / clock. */
  serverColumns?: Partial<Record<ServerField, string>>
}

export interface ReadOnlyTable {
  access: 'read' | 'restricted'
  label: string
  search?: string[]
  /** Alternative upstream names to try when the first one does not exist (legacy spelling). */
  upstreamCandidates?: string[]
}

export type TableDef = WritableTable | ReadOnlyTable

// APPROVED_ON is stamped by the server; APPROVED_BY is preserved but never client-writable
// (its Oracle type is not confirmed, the approver is recorded in the audit log).
const APPROVAL_TRACKING: Record<string, ColumnSpec> = {
  APPROVAL_STATUS: 'approval',
  APPROVER_COMMENTS: 'text',
}

/** Columns only users with the `approve` permission may change. */
export const APPROVER_ONLY_COLUMNS = new Set(['APPROVER_COMMENTS', 'APPROVAL_DETAILS'])
/** A non-approver may move a record between these states (e.g. submit it for review). */
export const WORKING_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PENDING'])

export const APPROVAL_STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PENDING', 'APPROVED', 'REJECTED'] as const
/** Setting one of these requires the `approve` permission. */
export const DECISION_STATUSES = new Set(['APPROVED', 'REJECTED'])

const AUDIT_COLUMNS = { created_by: 'CREATED_BY', created_on: 'CREATED_ON', updated_by: 'UPDATED_BY', updated_on: 'UPDATED_ON' } as const

export const TABLES: Record<string, TableDef> = {
  // ---------------------------------------------------------------- RCSA core
  per_trn_identify_risk: {
    access: 'write',
    label: 'Risk register',
    columns: {
      IDENTIFY_RISK_UUID: 'id',
      ASSESSMENT_CYCLE_UUID: 'id',
      HIERARCHY_LEVEL: 'int',
      HIERARCHY_NAME: 'int',
      ASSESSMENT_REFERENCE_NUMBER: 'text',
      ASSESSMENT_REGISTERED_DATE: 'date',
      ASSESSMENT_ACTUAL_START_DATE: 'date',
      ASSESSMENT_ACTUAL_END_DATE: 'date',
      BUSINESS_PROCESS_UUID: 'id',
      BUSINESS_SUB_PROCESS_UUID: 'id',
      RISK_TYPE_UUID: 'id',
      RISK_STATEMENT_UUID: 'id',
      IS_SOP_AVAILABLE: 'flag',
      INHERENT_SLE: 'number',
      IS_STAGE_COMPLTED: 'flag',
      START_DATE: 'date',
      END_DATE: 'date',
      RISK_STATEMENT: 'text',
      RISK_TYPE: 'text',
      SUB_PROCESS_NAME: 'text',
      PROCESS_NAME: 'text',
      RISK_CHAMPION_UUID: 'id',
      STATUS: 'flag',
      RISK_OWNER: 'text',
      RISK_CHAMPION: 'text',
      RISK_APPETITE: 'scalar',
      INHERENT_LIKELIHOOD: 'rating',
      INHERENT_IMPACT: 'rating',
      RESIDUAL_LIKELIHOOD: 'rating',
      RESIDUAL_IMPACT: 'rating',
      ...APPROVAL_TRACKING,
    },
    search: ['RISK_STATEMENT', 'PROCESS_NAME', 'SUB_PROCESS_NAME', 'RISK_TYPE', 'RISK_OWNER', 'ASSESSMENT_REFERENCE_NUMBER'],
    defaults: { APPROVAL_STATUS: 'DRAFT', IS_STAGE_COMPLTED: 'N', STATUS: 'Y' },
    serverColumns: { created_on: 'CREATED_ON', approved_on: 'APPROVED_ON' },
  },
  per_trn_control_implementation: {
    access: 'write',
    label: 'Control implementation',
    columns: {
      ROOT_CAUSE_UUID: 'id',
      CONTROL_ID: 'int',
      CONTROL_OWNER: 'id',
      MITIGATION_TYPE: 'scalar',
      CONTROL_FREQUENCY: 'scalar',
      CONTROL_DESIGN_EFFECTIVENESS: 'scalar',
      CONTROL_CLASIFICATION: 'scalar',
      CONTROL_TYPE: 'scalar',
      CONTROL_CATEGORY: 'scalar',
      INHERENT_LIKELIHOOD: 'number',
      RESIDUAL_LIKELIHOOD: 'number',
      WEIGHTAGE_VALUE: 'number',
      IS_STAGE_COMPLTED: 'flag',
      IDENTIFY_RISK_UUID: 'id',
      ASSESSMENT_REFERENCE_NUMBER_UUID: 'int',
      RISK_UUID: 'id',
      EVIDENCE_NOTES: 'text',
      CONTROL_EFFECTIVENESS_RATING: 'scalar',
      ...APPROVAL_TRACKING,
    },
    defaults: { APPROVAL_STATUS: 'DRAFT', IS_STAGE_COMPLTED: 'N', ASSESSMENT_REFERENCE_NUMBER_UUID: 0 },
    serverColumns: { approved_on: 'APPROVED_ON' },
  },
  per_trn_risk_monitoring: {
    access: 'write',
    label: 'Risk monitoring',
    columns: {
      ROOT_CAUSE: 'text',
      MONITORING_TITLE: 'text',
      MONITORING_GOAL: 'text',
      CONTROLS_UUID: 'id',
      MITIGATION_OWNER: 'text',
      ESTIMATED_START_DATE: 'date',
      ESTIMATED_END_DATE: 'date',
      ACTUAL_START_DATE: 'date',
      ACTUAL_END_DATE: 'date',
      IS_STAGE_COMPLTED: 'flag',
      RISK_UUID: 'id',
      COMPLETION_PCT: 'percent',
      IDENTIFY_RISK_UUID: 'id',
      ASSESSMENT_REFERENCE_NUMBER_UUID: 'int',
      ...APPROVAL_TRACKING,
    },
    required: ['MONITORING_TITLE'],
    defaults: { APPROVAL_STATUS: 'DRAFT', IS_STAGE_COMPLTED: 'N', COMPLETION_PCT: 0 },
    serverColumns: { approved_on: 'APPROVED_ON' },
  },
  per_trn_inherent_risk_assessment: {
    access: 'write',
    label: 'Inherent risk assessment',
    columns: {
      RISK_CATEGORY_UUID: 'id',
      DESCRIPTION: 'text',
      RISK_SUB_CATEGORY_UUID: 'id',
      IS_ACTIVE: 'flag',
      RISK_CAUSAL_FACTOR_UUID: 'id',
      RISK_DATA_SOURCE_UUID: 'id',
      RISK_ROOT_CAUSE_UUID: 'id',
      RISK_OWNERS: 'text',
      RISK_LIKELIHOOD_UUID: 'id',
      RISK_CYCLE_UUID: 'id',
      RISK_IMPACT_PARTIES_UUID: 'id',
      RISK_IMPACT_DESCRIPTION: 'text',
      IS_STAGE_COMPLTED: 'flag',
      RISK_UUID: 'id',
      IDENTIFY_RISK_UUID: 'id',
      RISK_STATEMENT_UUID: 'id',
    },
  },
  per_trn_mitigation_plans: {
    access: 'write',
    label: 'Mitigation plan',
    columns: {
      PARENT_PLAN_UUID: 'id',
      PLAN_TYPE: 'text',
      PLAN_STATEMENT: 'text',
      PLAN_ACTIVITIES: 'text',
      PLAN_START_DATE: 'date',
      PLAN_END_DATE: 'date',
      IS_ACTIVE: 'flag',
      APPROVAL_DETAILS: 'text',
      OVERALL_STATUS: 'text',
    },
    required: ['PLAN_STATEMENT'],
  },
  per_trn_impact_category: {
    access: 'write',
    label: 'Impact rating',
    columns: {
      IMPACT_CATEGORY_UUID: 'id',
      INHERENT_RISK_ASSESSMENT_UUID: 'id',
      RISK_IMPACT_CATEGORY_UUID: 'id',
      RISK_IMPACT_SUB_CATEGORY_UUID: 'id',
      RISK_INHERENT_IMPACT_LEVEL: 'number',
      RISK_RESIDUAL_IMPACT_LEVEL: 'number',
    },
  },
  // ------------------------------------------------------------ ERM extension
  erm_trn_assessment_cycle: {
    access: 'write',
    label: 'Assessment cycle',
    columns: {
      CYCLE_REFERENCE: 'text',
      CYCLE_NAME: 'text',
      CYCLE_TYPE: 'text',
      CYCLE_YEAR: 'int',
      CYCLE_PERIOD: 'text',
      ORG_HIERARCHY_UUID: 'id',
      CYCLE_START_DATE: 'date',
      CYCLE_END_DATE: 'date',
      SUBMISSION_DEADLINE: 'date',
      STATUS: 'text',
      NOTES: 'text',
    },
    required: ['CYCLE_NAME'],
    serverColumns: { created_by: 'CREATED_BY', created_on: 'CREATED_ON', updated_by: 'UPDATED_BY', updated_on: 'UPDATED_ON' },
  },
  erm_mst_kpi_definition: {
    access: 'write',
    label: 'KPI definition',
    columns: {
      KPI_CODE: 'text',
      KPI_NAME: 'text',
      KPI_DESCRIPTION: 'text',
      KPI_CATEGORY: 'text',
      TARGET_VALUE: 'number',
      TARGET_DIRECTION: 'text',
      IS_ACTIVE: 'flag',
    },
    required: ['KPI_CODE', 'KPI_NAME'],
    serverColumns: { created_by: 'CREATED_BY', created_on: 'CREATED_ON' },
  },
  erm_mst_kri_definition: {
    access: 'write',
    label: 'KRI definition',
    columns: {
      KRI_CODE: 'text',
      KRI_NAME: 'text',
      KRI_DESCRIPTION: 'text',
      KRI_CATEGORY: 'text',
      GREEN_THRESHOLD: 'number',
      AMBER_THRESHOLD: 'number',
      RED_THRESHOLD: 'number',
      UNIT_OF_MEASURE: 'text',
      MEASUREMENT_FREQUENCY: 'text',
      IS_ACTIVE: 'flag',
      OWNER_NAME: 'text',
      DIRECTION: { enum: ['HIGHER_WORSE', 'LOWER_WORSE'] },
    },
    required: ['KRI_CODE', 'KRI_NAME'],
    serverColumns: { created_by: 'CREATED_BY', created_on: 'CREATED_ON' },
  },
  erm_trn_kpi_actuals: {
    access: 'write',
    label: 'KPI actual',
    columns: {
      KPI_UUID: 'id',
      PERIOD_DATE: 'date',
      ACTUAL_VALUE: 'number',
      TARGET_VALUE: 'number',
      VARIANCE: 'number',
      VARIANCE_PCT: 'number',
      NOTES: 'text',
    },
    required: ['KPI_UUID', 'ACTUAL_VALUE'],
    serverColumns: { created_by: 'ENTERED_BY', created_on: 'ENTERED_ON' },
  },
  erm_trn_kri_readings: {
    access: 'write',
    label: 'KRI reading',
    columns: {
      KRI_UUID: 'id',
      READING_DATE: 'date',
      READING_VALUE: 'number',
      TRAFFIC_LIGHT: { enum: ['GREEN', 'AMBER', 'RED'] },
      IS_BREACH: 'flag',
      BREACH_NOTES: 'text',
      ORG_HIERARCHY_UUID: 'id',
    },
    required: ['KRI_UUID', 'READING_VALUE'],
    serverColumns: { created_by: 'RECORDED_BY', created_on: 'CREATED_ON' },
  },

  // ------------------------------------------------- ERM modules (migration V3)
  erm_mst_control: {
    access: 'write',
    label: 'Control',
    columns: {
      CONTROL_CODE: 'text',
      CONTROL_NAME: 'text',
      DESCRIPTION: 'text',
      CONTROL_TYPE: { enum: ['Preventive', 'Detective', 'Corrective', 'Compensating'] },
      CONTROL_NATURE: { enum: ['Manual', 'Automated', 'Hybrid'] },
      FREQUENCY: { enum: ['Continuous', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-driven'] },
      OWNER_NAME: 'text',
      FRAMEWORKS: 'text',
      DESIGN_EFFECTIVENESS: 'rating',
      OPERATING_EFFECTIVENESS: 'rating',
      LAST_TESTED_ON: 'date',
      STATUS: { enum: ['Draft', 'Active', 'Retired'] },
    },
    required: ['CONTROL_CODE', 'CONTROL_NAME'],
    defaults: { STATUS: 'Active' },
    search: ['CONTROL_CODE', 'CONTROL_NAME', 'DESCRIPTION', 'OWNER_NAME', 'FRAMEWORKS'],
    serverColumns: AUDIT_COLUMNS,
  },
  erm_lnk_control_risk: {
    access: 'write',
    label: 'Control–risk link',
    columns: { CONTROL_UUID: 'id', RISK_UUID: 'id' },
    required: ['CONTROL_UUID', 'RISK_UUID'],
    serverColumns: { created_by: 'CREATED_BY', created_on: 'CREATED_ON' },
  },
  erm_mst_policy: {
    access: 'write',
    label: 'Policy',
    columns: {
      POLICY_CODE: 'text',
      TITLE: 'text',
      CATEGORY: 'text',
      VERSION_LABEL: 'text',
      OWNER_NAME: 'text',
      EFFECTIVE_DATE: 'date',
      NEXT_REVIEW_DATE: 'date',
      ACKNOWLEDGED_PCT: 'percent',
      STATUS: { enum: ['Draft', 'Active', 'Retired'] },
    },
    required: ['POLICY_CODE', 'TITLE'],
    defaults: { STATUS: 'Draft' },
    search: ['POLICY_CODE', 'TITLE', 'CATEGORY', 'OWNER_NAME'],
    serverColumns: AUDIT_COLUMNS,
  },
  erm_lnk_policy_control: {
    access: 'write',
    label: 'Policy–control link',
    columns: { POLICY_UUID: 'id', CONTROL_UUID: 'id' },
    required: ['POLICY_UUID', 'CONTROL_UUID'],
    serverColumns: { created_by: 'CREATED_BY', created_on: 'CREATED_ON' },
  },
  erm_trn_incident: {
    access: 'write',
    label: 'Incident',
    columns: {
      INCIDENT_REF: 'text',
      TITLE: 'text',
      DESCRIPTION: 'text',
      SEVERITY: { enum: ['Low', 'Medium', 'High', 'Critical'] },
      STATUS: { enum: ['Open', 'Investigating', 'Mitigated', 'Closed'] },
      CATEGORY: 'text',
      REPORTED_BY: 'text',
      ASSIGNED_TO: 'text',
      OCCURRED_ON: 'date',
      REPORTED_ON: 'date',
      CLOSED_ON: 'date',
      ROOT_CAUSE: 'text',
      CORRECTIVE_ACTION: 'text',
      LOSS_AMOUNT: 'number',
    },
    required: ['TITLE', 'SEVERITY'],
    defaults: { STATUS: 'Open' },
    search: ['INCIDENT_REF', 'TITLE', 'DESCRIPTION', 'CATEGORY', 'ASSIGNED_TO'],
    serverColumns: AUDIT_COLUMNS,
  },
  erm_lnk_incident_risk: {
    access: 'write',
    label: 'Incident–risk link',
    columns: { INCIDENT_UUID: 'id', RISK_UUID: 'id' },
    required: ['INCIDENT_UUID', 'RISK_UUID'],
    serverColumns: { created_by: 'CREATED_BY', created_on: 'CREATED_ON' },
  },
  erm_mst_vendor: {
    access: 'write',
    label: 'Vendor',
    columns: {
      VENDOR_NAME: 'text',
      CATEGORY: 'text',
      TIER: { enum: ['Critical', 'High', 'Medium', 'Low'] },
      COUNTRY_CODE: 'text',
      CONTRACT_VALUE: 'number',
      RISK_SCORE: { range: [1, 100] },
      LAST_ASSESSMENT_ON: 'date',
      NEXT_REVIEW_ON: 'date',
      CONTACT_EMAIL: 'email',
      OPEN_FINDINGS: 'int',
      STATUS: { enum: ['Onboarding', 'Active', 'Offboarding', 'Exited'] },
    },
    required: ['VENDOR_NAME', 'TIER'],
    defaults: { STATUS: 'Active', OPEN_FINDINGS: 0 },
    search: ['VENDOR_NAME', 'CATEGORY', 'CONTACT_EMAIL'],
    serverColumns: AUDIT_COLUMNS,
  },
  erm_mst_bcp_plan: {
    access: 'write',
    label: 'Continuity plan',
    columns: {
      PLAN_NAME: 'text',
      SCOPE: 'text',
      RTO_HOURS: 'number',
      RPO_HOURS: 'number',
      OWNER_NAME: 'text',
      LAST_TESTED_ON: 'date',
      NEXT_TEST_ON: 'date',
      STATUS: { enum: ['Draft', 'Active', 'Retired'] },
    },
    required: ['PLAN_NAME', 'RTO_HOURS', 'RPO_HOURS'],
    defaults: { STATUS: 'Draft' },
    search: ['PLAN_NAME', 'SCOPE', 'OWNER_NAME'],
    serverColumns: AUDIT_COLUMNS,
  },
  erm_mst_scenario: {
    access: 'write',
    label: 'Scenario',
    columns: {
      SCENARIO_NAME: 'text',
      DESCRIPTION: 'text',
      SCENARIO_TYPE: { enum: ['Stress Test', 'What-if', 'Reverse Stress', 'Tail Risk'] },
      CATEGORY: 'text',
      SHOCK_PCT: 'number',
      BASELINE_LOSS: 'number',
      STRESSED_LOSS: 'number',
      PROBABILITY_PCT: 'percent',
      OWNER_NAME: 'text',
      LAST_RUN_ON: 'date',
    },
    required: ['SCENARIO_NAME'],
    search: ['SCENARIO_NAME', 'DESCRIPTION', 'CATEGORY', 'OWNER_NAME'],
    serverColumns: AUDIT_COLUMNS,
  },
  erm_mst_risk_appetite: {
    access: 'write',
    label: 'Risk appetite statement',
    // Appetite is set by the board / risk committee: only approvers may change it.
    writePermission: 'approve',
    columns: {
      CATEGORY: 'text',
      STATEMENT: 'text',
      POSTURE: { enum: ['Averse', 'Cautious', 'Open', 'Hungry'] },
      TOLERANCE_SCORE: { range: [1, 25] },
      APPROVED_BY: 'text',
      APPROVED_ON: 'date',
      REVIEW_FREQUENCY: { enum: ['Quarterly', 'Semi-annual', 'Annual'] },
    },
    required: ['CATEGORY', 'STATEMENT', 'POSTURE', 'TOLERANCE_SCORE'],
    search: ['CATEGORY', 'STATEMENT'],
    serverColumns: AUDIT_COLUMNS,
  },
  // Approval requests are written only through /api/workflow (segregation-of-duties rules).
  erm_trn_approval_request: { access: 'read', label: 'Approval request', search: ['TITLE', 'BUSINESS_UNIT', 'SUBMITTED_NAME'] },
  erm_trn_approval_step: { access: 'read', label: 'Approval step' },

  // ------------------------------------------------- reference data (read-only)
  per_mst_business_process: { access: 'read', label: 'Business process' },
  per_mst_business_sub_process: { access: 'read', label: 'Business sub-process' },
  per_mst_risk_statement: { access: 'read', label: 'Risk statement library' },
  per_mst_control_category: { access: 'read', label: 'Control category' },
  per_mst_control_classification: {
    access: 'read',
    label: 'Control classification',
    upstreamCandidates: ['per_mst_control_classification', 'per_mst_control_clasification'],
  },
  per_mst_control_clasification: {
    access: 'read',
    label: 'Control classification (legacy spelling)',
    upstreamCandidates: ['per_mst_control_clasification', 'per_mst_control_classification'],
  },
  per_mst_control_design_effectiveness: { access: 'read', label: 'Control design effectiveness' },
  per_mst_control_frequency: { access: 'read', label: 'Control frequency' },
  per_mst_control_register: { access: 'read', label: 'Control register' },
  per_mst_control_type: { access: 'read', label: 'Control type' },
  per_mst_currency_type: { access: 'read', label: 'Currency' },
  per_mst_designation: { access: 'read', label: 'Designation' },
  per_mst_impact: { access: 'read', label: 'Impact scale' },
  per_mst_impact_category: { access: 'read', label: 'Impact category' },
  per_mst_impact_parties: { access: 'read', label: 'Impacted parties' },
  per_mst_impact_sub_category: { access: 'read', label: 'Impact sub-category' },
  per_mst_likelihood: { access: 'read', label: 'Likelihood scale' },
  per_mst_org_hierarchy: { access: 'read', label: 'Org hierarchy' },
  per_mst_org_level: { access: 'read', label: 'Org level' },
  per_mst_risk_category: { access: 'read', label: 'Risk category' },
  per_mst_risk_causal_factor: { access: 'read', label: 'Causal factor' },
  per_mst_risk_computation_logic: {
    access: 'read',
    label: 'Risk computation logic',
    upstreamCandidates: ['per_mst_risk_computation_logic', 'per_mst_risk_compuation_logic'],
  },
  per_mst_risk_compuation_logic: {
    access: 'read',
    label: 'Risk computation logic (legacy spelling)',
    upstreamCandidates: ['per_mst_risk_compuation_logic', 'per_mst_risk_computation_logic'],
  },
  per_mst_risk_cycle: { access: 'read', label: 'Risk cycle' },
  per_mst_risk_data_source: { access: 'read', label: 'Risk data source' },
  per_mst_risk_root_cause: { access: 'read', label: 'Root cause' },
  per_mst_risk_sub_category: { access: 'read', label: 'Risk sub-category' },
  per_mst_risk_type: { access: 'read', label: 'Risk type' },
  per_mst_computation_output: { access: 'read', label: 'Computation output' },
  per_trn_mitigation_type: { access: 'read', label: 'Mitigation type' },
  erm_risks: { access: 'read', label: 'ERM risks' },
  erm_actions: { access: 'read', label: 'ERM actions' },
  erm_controls: { access: 'read', label: 'ERM controls' },
  erm_incidents: { access: 'read', label: 'ERM incidents' },

  // ------------------------------------------- identity data (administrators only)
  per_mst_roles: { access: 'restricted', label: 'Roles' },
  per_mst_user_details: { access: 'restricted', label: 'User details' },
  per_mst_user_roles_mapping: { access: 'restricted', label: 'User role mapping' },
}

export function isWritable(def: TableDef): def is WritableTable {
  return def.access === 'write'
}
