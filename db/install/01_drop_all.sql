-- =============================================================================
-- 01  Erase everything in the current schema
--
-- Drops every table (with its data), view, sequence, package, procedure, function,
-- trigger and type owned by the schema you are signed in as. This cannot be undone.
--
-- Run it as PERICOPE_ERM (the schema the app uses). It refuses to run as ADMIN, so it can
-- never wipe the database's administrator schema by mistake.
-- =============================================================================
SET SERVEROUTPUT ON
DECLARE
  v_schema VARCHAR2(128) := SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA');
  n        PLS_INTEGER := 0;
  v_ts     VARCHAR2(128);
  PROCEDURE run(p_sql VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
    n := n + 1;
  EXCEPTION
    WHEN OTHERS THEN DBMS_OUTPUT.PUT_LINE('Could not run: ' || p_sql || ' - ' || SQLERRM);
  END;
BEGIN
  IF v_schema IN ('ADMIN', 'SYS', 'SYSTEM') THEN
    DBMS_OUTPUT.PUT_LINE('Not erasing anything: you are signed in as ' || v_schema
      || '. Sign in to Database Actions as PERICOPE_ERM and run this again.');
    RETURN;
  END IF;
  DBMS_OUTPUT.PUT_LINE('Erasing schema ' || v_schema || ' ...');

  FOR o IN (SELECT view_name FROM user_views) LOOP
    run('DROP VIEW "' || o.view_name || '"');
  END LOOP;
  FOR o IN (SELECT table_name FROM user_tables
             WHERE nested = 'NO' AND secondary = 'N' AND iot_type IS NULL
               AND table_name NOT LIKE 'DBTOOLS$%' AND table_name NOT LIKE 'BIN$%') LOOP
    run('DROP TABLE "' || o.table_name || '" CASCADE CONSTRAINTS PURGE');
  END LOOP;
  FOR o IN (SELECT object_name, object_type FROM user_objects
             WHERE object_type IN ('SEQUENCE', 'PACKAGE', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TYPE', 'SYNONYM')
               AND object_name NOT LIKE 'ISEQ$$%' AND object_name NOT LIKE 'DBTOOLS$%'
               AND object_name NOT LIKE 'SYS_PLSQL_%') LOOP
    run('DROP ' || o.object_type || ' "' || o.object_name || '"' || CASE WHEN o.object_type = 'TYPE' THEN ' FORCE' END);
  END LOOP;

  DBMS_OUTPUT.PUT_LINE('Dropped ' || n || ' objects from ' || v_schema || '.');

  -- The install needs room for ~220 tables and their demo rows. A user created with a small
  -- storage quota fails later with ORA-01536, so warn now.
  SELECT default_tablespace INTO v_ts FROM user_users;
  SELECT (SELECT COUNT(*) FROM user_ts_quotas WHERE tablespace_name = v_ts AND max_bytes = -1)
       + (SELECT COUNT(*) FROM session_privs WHERE privilege = 'UNLIMITED TABLESPACE')
    INTO n FROM dual;
  IF n = 0 THEN
    DBMS_OUTPUT.PUT_LINE('WARNING: ' || v_schema || ' does not have unlimited space in tablespace ' || v_ts || '.');
    DBMS_OUTPUT.PUT_LINE('         Inserts will fail with ORA-01536. Sign in as ADMIN and run:');
    DBMS_OUTPUT.PUT_LINE('           ALTER USER ' || v_schema || ' QUOTA UNLIMITED ON ' || v_ts || ';');
    DBMS_OUTPUT.PUT_LINE('         then run this install again.');
  END IF;
END;
/
