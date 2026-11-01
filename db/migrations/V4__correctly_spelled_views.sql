-- =============================================================================
-- V4  Correctly spelled names for two legacy tables
--
-- The original schema has PER_MST_CONTROL_CLASIFICATION and
-- PER_MST_RISK_COMPUATION_LOGIC. Renaming them would break the APEX app, so a view
-- with the correct spelling is created over whichever one exists (read-only,
-- REST-enabled with authentication). New code should use the correct names.
-- Columns keep their legacy names (e.g. IS_STAGE_COMPLTED) because the existing
-- APEX application reads them; the API maps them for clients.
-- =============================================================================

DECLARE
  PROCEDURE alias_view(p_correct VARCHAR2, p_legacy VARCHAR2) IS
  BEGIN
    IF pericope_ddl.table_exists(p_correct) THEN
      pericope_ddl.log_msg('INFO', p_correct || ' already exists');
    ELSIF pericope_ddl.table_exists(p_legacy) THEN
      EXECUTE IMMEDIATE 'CREATE VIEW ' || p_correct || ' AS SELECT * FROM ' || p_legacy || ' WITH READ ONLY';
      pericope_ddl.log_msg('INFO', 'created view ' || p_correct || ' over ' || p_legacy);
      pericope_ddl.enable_rest(p_correct, 'VIEW');
    ELSE
      pericope_ddl.log_msg('INFO', 'neither ' || p_correct || ' nor ' || p_legacy || ' exists');
    END IF;
  END;
BEGIN
  alias_view('PER_MST_CONTROL_CLASSIFICATION', 'PER_MST_CONTROL_CLASIFICATION');
  alias_view('PER_MST_RISK_COMPUTATION_LOGIC', 'PER_MST_RISK_COMPUATION_LOGIC');
END;
/
