-- =============================================================================
-- V2  Risk scoring columns, foreign-key indexes and referential integrity
--
-- * Adds explicit 1–5 likelihood / impact ratings (inherent and residual) to the
--   risk register, so scores are stored instead of being guessed from the SLE.
-- * Indexes the columns used to join records.
-- * Adds fully validated foreign keys. Where existing rows already point at missing
--   parents the key is skipped with a WARNING in PERICOPE_MIGRATION_LOG (fix the rows with
--   db/scripts/find_orphans.sql, then re-run). Keys are never added "NOVALIDATE", because the
--   API updates whole rows and would then fail on every edit of such a legacy row.
-- * Children of a risk (applied controls, action plans, assessment records, KRI readings)
--   are deleted with their parent.
-- Safe to re-run.
-- =============================================================================

BEGIN
  -- Likelihood × impact ratings on the risk register
  pericope_ddl.add_column('PER_TRN_IDENTIFY_RISK', 'INHERENT_LIKELIHOOD', 'NUMBER(1)');
  pericope_ddl.add_column('PER_TRN_IDENTIFY_RISK', 'INHERENT_IMPACT',     'NUMBER(1)');
  pericope_ddl.add_column('PER_TRN_IDENTIFY_RISK', 'RESIDUAL_LIKELIHOOD', 'NUMBER(1)');
  pericope_ddl.add_column('PER_TRN_IDENTIFY_RISK', 'RESIDUAL_IMPACT',     'NUMBER(1)');
  pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'CHK_PIR_INH_L', 'CHECK (INHERENT_LIKELIHOOD BETWEEN 1 AND 5)');
  pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'CHK_PIR_INH_I', 'CHECK (INHERENT_IMPACT BETWEEN 1 AND 5)');
  pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'CHK_PIR_RES_L', 'CHECK (RESIDUAL_LIKELIHOOD BETWEEN 1 AND 5)');
  pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'CHK_PIR_RES_I', 'CHECK (RESIDUAL_IMPACT BETWEEN 1 AND 5)');
  pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'CHK_PIR_SLE',   'CHECK (INHERENT_SLE >= 0)');

  -- Monitoring progress is a percentage
  pericope_ddl.add_constraint('PER_TRN_RISK_MONITORING', 'CHK_PRM_PCT', 'CHECK (COMPLETION_PCT BETWEEN 0 AND 100)');

  -- KRI definitions: owner and which direction is bad
  pericope_ddl.add_column('ERM_MST_KRI_DEFINITION', 'OWNER_NAME', 'VARCHAR2(200)');
  pericope_ddl.add_column('ERM_MST_KRI_DEFINITION', 'DIRECTION',  q'[VARCHAR2(20) DEFAULT 'HIGHER_WORSE']');
  pericope_ddl.add_constraint('ERM_MST_KRI_DEFINITION', 'CHK_KRI_DIRECTION', q'[CHECK (DIRECTION IN ('HIGHER_WORSE', 'LOWER_WORSE'))]');

  -- Indexes on join columns
  pericope_ddl.create_index('IX_PIR_CYCLE',       'PER_TRN_IDENTIFY_RISK',            'ASSESSMENT_CYCLE_UUID');
  pericope_ddl.create_index('IX_PIR_PARENT',      'PER_TRN_IDENTIFY_RISK',            'IDENTIFY_RISK_UUID');
  pericope_ddl.create_index('IX_PCI_RISK',        'PER_TRN_CONTROL_IMPLEMENTATION',   'IDENTIFY_RISK_UUID');
  pericope_ddl.create_index('IX_PCI_RISK2',       'PER_TRN_CONTROL_IMPLEMENTATION',   'RISK_UUID');
  pericope_ddl.create_index('IX_PRM_RISK',        'PER_TRN_RISK_MONITORING',          'IDENTIFY_RISK_UUID');
  pericope_ddl.create_index('IX_PRM_RISK2',       'PER_TRN_RISK_MONITORING',          'RISK_UUID');
  pericope_ddl.create_index('IX_PIRA_RISK',       'PER_TRN_INHERENT_RISK_ASSESSMENT', 'IDENTIFY_RISK_UUID');
  pericope_ddl.create_index('IX_PIC_ASSESSMENT',  'PER_TRN_IMPACT_CATEGORY',          'INHERENT_RISK_ASSESSMENT_UUID');
  pericope_ddl.create_index('IX_PMP_PARENT',      'PER_TRN_MITIGATION_PLANS',         'PARENT_PLAN_UUID');
  pericope_ddl.create_index('IX_KRIR_KRI_DATE',   'ERM_TRN_KRI_READINGS',             'KRI_UUID, READING_DATE');
  pericope_ddl.create_index('IX_KPIA_KPI_DATE',   'ERM_TRN_KPI_ACTUALS',              'KPI_UUID, PERIOD_DATE');

  -- Referential integrity (each table's primary key column is UUID, as the API sees it)
  pericope_ddl.add_fk('PER_TRN_IDENTIFY_RISK',            'FK_PIR_CYCLE',  'ASSESSMENT_CYCLE_UUID', 'ERM_TRN_ASSESSMENT_CYCLE', 'UUID', 'SET NULL');
  pericope_ddl.add_fk('PER_TRN_IDENTIFY_RISK',            'FK_PIR_PARENT', 'IDENTIFY_RISK_UUID',    'PER_TRN_IDENTIFY_RISK',    'UUID', 'SET NULL');
  pericope_ddl.add_fk('PER_TRN_CONTROL_IMPLEMENTATION',   'FK_PCI_RISK',   'IDENTIFY_RISK_UUID',    'PER_TRN_IDENTIFY_RISK',    'UUID', 'CASCADE');
  pericope_ddl.add_fk('PER_TRN_RISK_MONITORING',          'FK_PRM_RISK',   'IDENTIFY_RISK_UUID',    'PER_TRN_IDENTIFY_RISK',    'UUID', 'CASCADE');
  pericope_ddl.add_fk('PER_TRN_INHERENT_RISK_ASSESSMENT', 'FK_PIRA_RISK',  'IDENTIFY_RISK_UUID',    'PER_TRN_IDENTIFY_RISK',    'UUID', 'CASCADE');
  pericope_ddl.add_fk('PER_TRN_MITIGATION_PLANS',         'FK_PMP_PARENT', 'PARENT_PLAN_UUID',      'PER_TRN_MITIGATION_PLANS', 'UUID', 'SET NULL');
  pericope_ddl.add_fk('ERM_TRN_KRI_READINGS',             'FK_KRIR_KRI',   'KRI_UUID',              'ERM_MST_KRI_DEFINITION',   'UUID', 'CASCADE');
  pericope_ddl.add_fk('ERM_TRN_KPI_ACTUALS',              'FK_KPIA_KPI',   'KPI_UUID',              'ERM_MST_KPI_DEFINITION',   'UUID', 'CASCADE');
END;
/
