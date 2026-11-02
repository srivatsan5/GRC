-- =============================================================================
-- 04  Make the exported schema match what the web app writes
--
-- Run after 03_foreign_keys.sql and before the migrations (db/migrations V1–V4).
-- Each change is skipped if it is already in place, so this file is safe to re-run.
--
-- 1. PER_TRN_RISK_MONITORING gets IDENTIFY_RISK_UUID and ASSESSMENT_REFERENCE_NUMBER_UUID:
--    the app links an action to its risk with them (V2 then indexes and keys the first one).
-- 2. PER_TRN_RISK_MONITORING.ROOT_CAUSE becomes text: the action-plan form saves a sentence,
--    which a NUMBER column rejects.
-- 3. PER_TRN_INHERENT_RISK_ASSESSMENT gets CREATED_ON / CREATED_BY, so the assessment history
--    shows when and by whom each assessment was saved.
-- 4. The risk register's approval-status check also allows IN_REVIEW and PENDING, the
--    in-between states the approval workflow uses.
-- =============================================================================
SET SERVEROUTPUT ON
DECLARE
  n NUMBER;
  PROCEDURE add_column(p_table VARCHAR2, p_column VARCHAR2, p_definition VARCHAR2) IS
  BEGIN
    SELECT COUNT(*) INTO n FROM user_tab_columns WHERE table_name = p_table AND column_name = p_column;
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD (' || p_column || ' ' || p_definition || ')';
      DBMS_OUTPUT.PUT_LINE('Added ' || p_table || '.' || p_column);
    END IF;
  END;
BEGIN
  -- 1
  add_column('PER_TRN_RISK_MONITORING', 'IDENTIFY_RISK_UUID', 'NUMBER');
  add_column('PER_TRN_RISK_MONITORING', 'ASSESSMENT_REFERENCE_NUMBER_UUID', 'NUMBER');

  -- 2 (only while the column is still a number and empty; the table is empty on a fresh install)
  SELECT COUNT(*) INTO n FROM user_tab_columns
   WHERE table_name = 'PER_TRN_RISK_MONITORING' AND column_name = 'ROOT_CAUSE' AND data_type = 'NUMBER';
  IF n > 0 THEN
    EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM PER_TRN_RISK_MONITORING WHERE ROOT_CAUSE IS NOT NULL' INTO n;
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE PER_TRN_RISK_MONITORING MODIFY (ROOT_CAUSE VARCHAR2(2000 CHAR))';
      DBMS_OUTPUT.PUT_LINE('PER_TRN_RISK_MONITORING.ROOT_CAUSE is now text');
    ELSE
      DBMS_OUTPUT.PUT_LINE('WARNING: PER_TRN_RISK_MONITORING.ROOT_CAUSE has data, left as a number');
    END IF;
  END IF;

  -- 3
  add_column('PER_TRN_INHERENT_RISK_ASSESSMENT', 'CREATED_ON', 'DATE DEFAULT SYSDATE');
  add_column('PER_TRN_INHERENT_RISK_ASSESSMENT', 'CREATED_BY', 'VARCHAR2(255 CHAR)');

  -- 4
  SELECT COUNT(*) INTO n FROM user_constraints WHERE table_name = 'PER_TRN_IDENTIFY_RISK' AND constraint_name = 'CK_IDR_APPR_STATUS';
  IF n > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE PER_TRN_IDENTIFY_RISK DROP CONSTRAINT CK_IDR_APPR_STATUS';
  END IF;
  EXECUTE IMMEDIATE q'[ALTER TABLE PER_TRN_IDENTIFY_RISK ADD CONSTRAINT CK_IDR_APPR_STATUS
    CHECK (APPROVAL_STATUS IS NULL OR APPROVAL_STATUS IN ('DRAFT','SUBMITTED','IN_REVIEW','PENDING','APPROVED','REJECTED'))]';
  DBMS_OUTPUT.PUT_LINE('Approval statuses: DRAFT, SUBMITTED, IN_REVIEW, PENDING, APPROVED, REJECTED');
END;
/
