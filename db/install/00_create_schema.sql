-- =============================================================================
-- 00  Create the PERICOPE_ERM schema (run ONCE, as ADMIN)
--
-- Creates the database user that owns Pericope's tables and turns on REST (ORDS) for it,
-- so you can sign in to Database Actions as PERICOPE_ERM and the API can reach
-- https://<host>/ords/pericope_erm/...
--
-- Before running: replace CHANGE_ME_Strong_Passw0rd below with a strong password
-- (12–30 characters, upper and lower case and a number; no double quotes).
-- Skip this file if the schema already exists.
-- =============================================================================

CREATE USER PERICOPE_ERM IDENTIFIED BY "CHANGE_ME_Strong_Passw0rd"
  DEFAULT TABLESPACE DATA QUOTA UNLIMITED ON DATA;

GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE,
      CREATE TRIGGER, CREATE TYPE, CREATE SYNONYM TO PERICOPE_ERM;

-- Lets the schema be used from Database Actions and serve REST endpoints.
BEGIN
  ORDS_ADMIN.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => 'PERICOPE_ERM',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'pericope_erm',
    p_auto_rest_auth      => TRUE);
  COMMIT;
END;
/
