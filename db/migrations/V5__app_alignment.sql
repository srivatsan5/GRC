-- =============================================================================
-- V5  Align an existing schema with what the web app writes
--
-- The same changes a fresh install makes in db/install/04_app_alignment.sql, for a schema
-- that was set up before it (run after V1–V4). Safe to re-run.
--
-- * PER_TRN_RISK_MONITORING: IDENTIFY_RISK_UUID and ASSESSMENT_REFERENCE_NUMBER_UUID (the app
--   links an action to its risk with them), indexed and keyed like V2 intended.
-- * PER_TRN_RISK_MONITORING.ROOT_CAUSE becomes text when it is a number with no data
--   (the action-plan form saves a sentence).
-- * PER_TRN_INHERENT_RISK_ASSESSMENT: CREATED_ON / CREATED_BY, stamped by the API, so the
--   assessment history shows when and by whom each assessment was saved.
-- * The risk register's approval-status check also allows IN_REVIEW and PENDING.
-- =============================================================================
DECLARE
  n NUMBER;
BEGIN
  pericope_ddl.add_column('PER_TRN_RISK_MONITORING', 'IDENTIFY_RISK_UUID', 'NUMBER');
  pericope_ddl.add_column('PER_TRN_RISK_MONITORING', 'ASSESSMENT_REFERENCE_NUMBER_UUID', 'NUMBER');
  pericope_ddl.create_index('IX_PRM_RISK', 'PER_TRN_RISK_MONITORING', 'IDENTIFY_RISK_UUID');
  pericope_ddl.add_fk('PER_TRN_RISK_MONITORING', 'FK_PRM_RISK', 'IDENTIFY_RISK_UUID', 'PER_TRN_IDENTIFY_RISK', 'UUID', 'CASCADE');

  SELECT COUNT(*) INTO n FROM user_tab_columns
   WHERE table_name = 'PER_TRN_RISK_MONITORING' AND column_name = 'ROOT_CAUSE' AND data_type = 'NUMBER';
  IF n > 0 THEN
    EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM PER_TRN_RISK_MONITORING WHERE ROOT_CAUSE IS NOT NULL' INTO n;
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE PER_TRN_RISK_MONITORING MODIFY (ROOT_CAUSE VARCHAR2(2000 CHAR))';
      pericope_ddl.log_msg('INFO', 'PER_TRN_RISK_MONITORING.ROOT_CAUSE is now text');
    ELSE
      pericope_ddl.log_msg('WARNING', 'PER_TRN_RISK_MONITORING.ROOT_CAUSE is a number and has data: '
        || 'the action-plan form cannot save a root cause until it is converted to VARCHAR2 by hand');
    END IF;
  END IF;

  pericope_ddl.add_column('PER_TRN_INHERENT_RISK_ASSESSMENT', 'CREATED_ON', 'DATE DEFAULT SYSDATE');
  pericope_ddl.add_column('PER_TRN_INHERENT_RISK_ASSESSMENT', 'CREATED_BY', 'VARCHAR2(255 CHAR)');

  SELECT COUNT(*) INTO n FROM user_constraints
   WHERE table_name = 'PER_TRN_IDENTIFY_RISK' AND constraint_name = 'CK_IDR_APPR_STATUS'
     AND search_condition_vc NOT LIKE '%IN_REVIEW%';
  IF n > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE PER_TRN_IDENTIFY_RISK DROP CONSTRAINT CK_IDR_APPR_STATUS';
    pericope_ddl.add_constraint('PER_TRN_IDENTIFY_RISK', 'CK_IDR_APPR_STATUS',
      q'[CHECK (APPROVAL_STATUS IS NULL OR APPROVAL_STATUS IN ('DRAFT','SUBMITTED','IN_REVIEW','PENDING','APPROVED','REJECTED'))]');
  END IF;
END;
/
