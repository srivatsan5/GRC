-- Optional, one-off: the old web app saved RCSA *assessment cycles* as rows in
-- PER_TRN_IDENTIFY_RISK (statements like 'RCSA assessment cycle for Finance' or
-- 'RCSA: Finance'). The app now keeps cycles in ERM_TRN_ASSESSMENT_CYCLE.
--
-- STEP 1 (read-only): review what would be moved.
SELECT UUID, ASSESSMENT_REFERENCE_NUMBER, PROCESS_NAME, RISK_STATEMENT, START_DATE, END_DATE
  FROM PER_TRN_IDENTIFY_RISK
 WHERE RISK_STATEMENT LIKE 'RCSA assessment cycle for %'
    OR RISK_STATEMENT LIKE 'RCSA cycle for %'
    OR RISK_STATEMENT LIKE 'RCSA: %';

-- STEP 2: copy them into ERM_TRN_ASSESSMENT_CYCLE and re-point linked risks.
-- Nothing is deleted; after checking the result you can remove the old rows yourself.
/*
DECLARE
  v_cycle NUMBER;
BEGIN
  FOR a IN (SELECT * FROM PER_TRN_IDENTIFY_RISK
             WHERE RISK_STATEMENT LIKE 'RCSA assessment cycle for %'
                OR RISK_STATEMENT LIKE 'RCSA cycle for %'
                OR RISK_STATEMENT LIKE 'RCSA: %') LOOP
    INSERT INTO ERM_TRN_ASSESSMENT_CYCLE (CYCLE_REFERENCE, CYCLE_NAME, CYCLE_TYPE, CYCLE_START_DATE, CYCLE_END_DATE, STATUS, NOTES, CREATED_BY, CREATED_ON)
    VALUES (NVL(a.ASSESSMENT_REFERENCE_NUMBER, 'LEGACY-' || a.UUID), NVL(a.PROCESS_NAME, 'Legacy cycle ' || a.UUID), 'RCSA',
            a.START_DATE, a.END_DATE, CASE a.IS_STAGE_COMPLTED WHEN 'Y' THEN 'Completed' ELSE 'In Progress' END,
            'Migrated from PER_TRN_IDENTIFY_RISK.UUID ' || a.UUID, 'migration', SYSTIMESTAMP)
    RETURNING UUID INTO v_cycle;
    UPDATE PER_TRN_IDENTIFY_RISK SET ASSESSMENT_CYCLE_UUID = v_cycle WHERE IDENTIFY_RISK_UUID = a.UUID;
  END LOOP;
  COMMIT;
END;
/
*/
