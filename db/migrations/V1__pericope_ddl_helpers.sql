-- =============================================================================
-- V1  Pericope DDL helpers
-- Small idempotent helpers used by later migrations, so each migration can be
-- re-run safely on a schema that already has some of its objects.
-- Oracle Autonomous Database 19c+ (ORDS installed). Run as the schema owner.
-- =============================================================================

CREATE OR REPLACE PACKAGE pericope_ddl AUTHID CURRENT_USER AS
  -- Create a table from its column list, e.g. create_table('T', 'ID NUMBER PRIMARY KEY, NAME VARCHAR2(10)')
  PROCEDURE create_table(p_table VARCHAR2, p_columns CLOB);
  PROCEDURE add_column(p_table VARCHAR2, p_column VARCHAR2, p_definition VARCHAR2);
  PROCEDURE create_index(p_index VARCHAR2, p_table VARCHAR2, p_columns VARCHAR2);
  -- p_definition is everything after "ADD CONSTRAINT <name>", e.g. 'CHECK (x > 0)'
  PROCEDURE add_constraint(p_table VARCHAR2, p_constraint VARCHAR2, p_definition VARCHAR2);
  -- Expose a table/view through ORDS AutoREST with authentication required.
  PROCEDURE enable_rest(p_object VARCHAR2, p_type VARCHAR2 DEFAULT 'TABLE');
  FUNCTION table_exists(p_table VARCHAR2) RETURN BOOLEAN;
END pericope_ddl;
/

CREATE OR REPLACE PACKAGE BODY pericope_ddl AS
  FUNCTION table_exists(p_table VARCHAR2) RETURN BOOLEAN IS
    n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM user_objects
     WHERE object_name = UPPER(p_table) AND object_type IN ('TABLE', 'VIEW');
    RETURN n > 0;
  END;

  PROCEDURE create_table(p_table VARCHAR2, p_columns CLOB) IS
  BEGIN
    IF table_exists(p_table) THEN
      DBMS_OUTPUT.PUT_LINE('table ' || p_table || ' already exists');
      RETURN;
    END IF;
    EXECUTE IMMEDIATE 'CREATE TABLE ' || p_table || ' (' || p_columns || ')';
    DBMS_OUTPUT.PUT_LINE('created table ' || p_table);
  END;

  PROCEDURE add_column(p_table VARCHAR2, p_column VARCHAR2, p_definition VARCHAR2) IS
    n NUMBER;
  BEGIN
    IF NOT table_exists(p_table) THEN
      DBMS_OUTPUT.PUT_LINE('skip column ' || p_table || '.' || p_column || ': table missing');
      RETURN;
    END IF;
    SELECT COUNT(*) INTO n FROM user_tab_columns
     WHERE table_name = UPPER(p_table) AND column_name = UPPER(p_column);
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD (' || p_column || ' ' || p_definition || ')';
      DBMS_OUTPUT.PUT_LINE('added column ' || p_table || '.' || p_column);
    END IF;
  END;

  PROCEDURE create_index(p_index VARCHAR2, p_table VARCHAR2, p_columns VARCHAR2) IS
    n NUMBER;
    already_indexed EXCEPTION;
    PRAGMA EXCEPTION_INIT(already_indexed, -1408);
    no_column EXCEPTION;
    PRAGMA EXCEPTION_INIT(no_column, -904);
  BEGIN
    IF NOT table_exists(p_table) THEN
      DBMS_OUTPUT.PUT_LINE('skip index ' || p_index || ': table missing');
      RETURN;
    END IF;
    SELECT COUNT(*) INTO n FROM user_indexes WHERE index_name = UPPER(p_index);
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'CREATE INDEX ' || p_index || ' ON ' || p_table || ' (' || p_columns || ')';
      DBMS_OUTPUT.PUT_LINE('created index ' || p_index);
    END IF;
  EXCEPTION
    WHEN already_indexed THEN DBMS_OUTPUT.PUT_LINE('skip index ' || p_index || ': columns already indexed');
    WHEN no_column THEN DBMS_OUTPUT.PUT_LINE('skip index ' || p_index || ': column missing');
  END;

  PROCEDURE add_constraint(p_table VARCHAR2, p_constraint VARCHAR2, p_definition VARCHAR2) IS
    n NUMBER;
  BEGIN
    IF NOT table_exists(p_table) THEN
      DBMS_OUTPUT.PUT_LINE('skip constraint ' || p_constraint || ': table missing');
      RETURN;
    END IF;
    SELECT COUNT(*) INTO n FROM user_constraints WHERE constraint_name = UPPER(p_constraint);
    IF n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD CONSTRAINT ' || p_constraint || ' ' || p_definition;
      DBMS_OUTPUT.PUT_LINE('added constraint ' || p_constraint);
    END IF;
  EXCEPTION
    -- A constraint that can't be added (e.g. the referenced key is not unique) must not stop the
    -- migration; it is reported so it can be fixed by hand.
    WHEN OTHERS THEN
      DBMS_OUTPUT.PUT_LINE('WARNING: could not add ' || p_constraint || ' on ' || p_table || ': ' || SQLERRM);
  END;

  PROCEDURE enable_rest(p_object VARCHAR2, p_type VARCHAR2 DEFAULT 'TABLE') IS
  BEGIN
    EXECUTE IMMEDIATE q'[
      BEGIN
        ORDS.ENABLE_OBJECT(
          p_enabled        => TRUE,
          p_schema         => SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA'),
          p_object         => :obj,
          p_object_type    => :typ,
          p_object_alias   => LOWER(:obj),
          p_auto_rest_auth => TRUE);
      END;]' USING UPPER(p_object), UPPER(p_type);  -- in a PL/SQL block a repeated placeholder binds once
    DBMS_OUTPUT.PUT_LINE('REST-enabled (auth required) ' || p_object);
  EXCEPTION
    WHEN OTHERS THEN
      DBMS_OUTPUT.PUT_LINE('WARNING: could not REST-enable ' || p_object || ': ' || SQLERRM);
  END;
END pericope_ddl;
/
