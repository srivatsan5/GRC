-- =============================================================================
-- V2  Risk scoring columns, foreign-key indexes and referential integrity
--
-- * Adds explicit 1–5 likelihood / impact ratings (inherent and residual) to the
--   risk register, so scores are stored instead of being guessed from the SLE.
-- * Indexes the columns used to join records.
-- * Adds foreign keys ENABLE NOVALIDATE: new and changed rows are checked, old rows
--   that already point nowhere are left alone (find them with db/scripts/find_orphans.sql).
-- Safe to re-run.
-- =============================================================================
SET SERVEROUTPUT ON

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
  pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'CHK_PIR_SLE',   'CHECK (INHERENT_SLE >= 0) ENABLE NOVALIDATE');

  -- Monitoring progress is a percentage
  pericope_ddl.add_constraint('PER_TRN_RISK_MONITORING', 'CHK_PRM_PCT', 'CHECK (COMPLETION_PCT BETWEEN 0 AND 100) ENABLE NOVALIDATE');

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

  -- Referential integrity (assumes each table's primary key column is UUID, as the API sees it)
  pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'FK_PIR_CYCLE',
    'FOREIGN KEY (ASSESSMENT_CYCLE_UUID) REFERENCES ERM_TRN_ASSESSMENT_CYCLE (UUID) ENABLE NOVALIDATE');
  pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'FK_PIR_PARENT',
    'FOREIGN KEY (IDENTIFY_RISK_UUID) REFERENCES PER_TRN_IDENTIFY_RISK (UUID) ENABLE NOVALIDATE');
  pericope_ddl.add_constraint('PER_TRN_CONTROL_IMPLEMENTATION', 'FK_PCI_RISK',
    'FOREIGN KEY (IDENTIFY_RISK_UUID) REFERENCES PER_TRN_IDENTIFY_RISK (UUID) ENABLE NOVALIDATE');
  pericope_ddl.add_constraint('PER_TRN_RISK_MONITORING', 'FK_PRM_RISK',
    'FOREIGN KEY (IDENTIFY_RISK_UUID) REFERENCES PER_TRN_IDENTIFY_RISK (UUID) ENABLE NOVALIDATE');
  pericope_ddl.add_constraint('PER_TRN_INHERENT_RISK_ASSESSMENT', 'FK_PIRA_RISK',
    'FOREIGN KEY (IDENTIFY_RISK_UUID) REFERENCES PER_TRN_IDENTIFY_RISK (UUID) ENABLE NOVALIDATE');
  pericope_ddl.add_constraint('PER_TRN_MITIGATION_PLANS', 'FK_PMP_PARENT',
    'FOREIGN KEY (PARENT_PLAN_UUID) REFERENCES PER_TRN_MITIGATION_PLANS (UUID) ENABLE NOVALIDATE');
  pericope_ddl.add_constraint('ERM_TRN_KRI_READINGS', 'FK_KRIR_KRI',
    'FOREIGN KEY (KRI_UUID) REFERENCES ERM_MST_KRI_DEFINITION (UUID) ENABLE NOVALIDATE');
  pericope_ddl.add_constraint('ERM_TRN_KPI_ACTUALS', 'FK_KPIA_KPI',
    'FOREIGN KEY (KPI_UUID) REFERENCES ERM_MST_KPI_DEFINITION (UUID) ENABLE NOVALIDATE');
END;
/
