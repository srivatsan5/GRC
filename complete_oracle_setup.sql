-- ============================================================================
-- COMPLETE ORACLE ORDS API IMPLEMENTATION SCRIPT
-- For: Risk Management System
-- Database: Oracle Autonomous Database (ORDS)
-- ============================================================================
-- Execute this script in SQL Developer to create all missing API endpoints
-- ============================================================================

-- SECTION 1: DASHBOARD VIEWS
-- ============================================================================

-- 1.1 Dashboard Summary View
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
  (SELECT COUNT(*) FROM per_trn_identify_risk) AS total_risks,
  (SELECT COUNT(*) FROM per_trn_risk_monitoring WHERE status = 'ACTIVE') AS active_monitoring,
  (SELECT COUNT(*) FROM per_trn_control_implementation) AS total_controls,
  SYSDATE AS last_updated
FROM dual;

-- 1.2 Risk Trend View (Month-over-Month)
CREATE OR REPLACE VIEW risk_trend AS
SELECT 
  TRUNC(CREATED_DATE, 'MONTH') AS month,
  COUNT(*) AS risk_count,
  ROUND(AVG(RISK_LEVEL), 2) AS avg_risk_level
FROM per_trn_identify_risk
WHERE CREATED_DATE >= ADD_MONTHS(SYSDATE, -12)
GROUP BY TRUNC(CREATED_DATE, 'MONTH')
ORDER BY month DESC;

-- 1.3 Risk Distribution View
CREATE OR REPLACE VIEW risk_distribution AS
SELECT 
  NVL(status, 'Unknown') AS status,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM per_trn_identify_risk), 2) AS percentage
FROM per_trn_identify_risk
GROUP BY status;

-- 1.4 Risk by Category View
CREATE OR REPLACE VIEW risk_by_category AS
SELECT 
  NVL(c.category_name, 'Uncategorized') AS category_name,
  COUNT(r.risk_id) AS risk_count
FROM per_trn_identify_risk r
LEFT JOIN per_mst_risk_category c ON r.category_id = c.category_id
GROUP BY c.category_name;

-- 1.5 Risk by Process View
CREATE OR REPLACE VIEW risk_by_process AS
SELECT 
  NVL(p.process_name, 'Unassigned') AS process_name,
  COUNT(r.risk_id) AS risk_count
FROM per_trn_identify_risk r
LEFT JOIN per_mst_business_process p ON r.process_id = p.process_id
GROUP BY p.process_name;

-- 1.6 Control Effectiveness View
CREATE OR REPLACE VIEW control_effectiveness AS
SELECT 
  NVL(c.control_name, 'Unnamed Control') AS control_name,
  COUNT(m.monitoring_id) AS monitoring_count,
  ROUND(COUNT(CASE WHEN m.effectiveness = 'EFFECTIVE' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(m.monitoring_id), 0), 2) AS effectiveness_percentage
FROM per_trn_control_implementation c
LEFT JOIN per_trn_risk_monitoring m ON c.control_id = m.control_id
GROUP BY c.control_name;

-- 1.7 Monitoring Status View
CREATE OR REPLACE VIEW monitoring_status AS
SELECT 
  NVL(status, 'Unknown') AS status,
  COUNT(*) AS count
FROM per_trn_risk_monitoring
GROUP BY status;

COMMIT;

-- SECTION 2: REFERENCE DATA TABLES
-- ============================================================================

-- 2.1 Control Frequency Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE control_frequency';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE control_frequency (
  frequency_id NUMBER PRIMARY KEY,
  frequency_name VARCHAR2(100),
  frequency_days NUMBER,
  description VARCHAR2(500),
  is_active VARCHAR2(1) DEFAULT 'Y'
);

INSERT INTO control_frequency VALUES (1, 'Daily', 1, 'Daily frequency', 'Y');
INSERT INTO control_frequency VALUES (2, 'Weekly', 7, 'Weekly frequency', 'Y');
INSERT INTO control_frequency VALUES (3, 'Monthly', 30, 'Monthly frequency', 'Y');
INSERT INTO control_frequency VALUES (4, 'Quarterly', 90, 'Quarterly frequency', 'Y');
INSERT INTO control_frequency VALUES (5, 'Annually', 365, 'Annual frequency', 'Y');

-- 2.2 Impact Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE impact';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE impact (
  impact_id NUMBER PRIMARY KEY,
  impact_name VARCHAR2(50),
  impact_score NUMBER,
  impact_level VARCHAR2(100),
  is_active VARCHAR2(1) DEFAULT 'Y'
);

INSERT INTO impact VALUES (1, 'Low', 1, 'Minor financial/operational impact', 'Y');
INSERT INTO impact VALUES (2, 'Medium', 2, 'Moderate financial/operational impact', 'Y');
INSERT INTO impact VALUES (3, 'High', 3, 'Significant financial/operational impact', 'Y');
INSERT INTO impact VALUES (4, 'Critical', 4, 'Severe financial/operational impact', 'Y');

-- 2.3 Likelihood Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE likelihood';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE likelihood (
  likelihood_id NUMBER PRIMARY KEY,
  likelihood_name VARCHAR2(50),
  likelihood_score NUMBER,
  likelihood_percentage NUMBER,
  is_active VARCHAR2(1) DEFAULT 'Y'
);

INSERT INTO likelihood VALUES (1, 'Remote', 1, 5, 'Y');
INSERT INTO likelihood VALUES (2, 'Low', 2, 25, 'Y');
INSERT INTO likelihood VALUES (3, 'Medium', 3, 50, 'Y');
INSERT INTO likelihood VALUES (4, 'High', 4, 75, 'Y');
INSERT INTO likelihood VALUES (5, 'Almost Certain', 5, 95, 'Y');

-- 2.4 Risk Subcategories Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE risk_subcategories';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE risk_subcategories (
  subcategory_id NUMBER PRIMARY KEY,
  category_id NUMBER NOT NULL,
  subcategory_name VARCHAR2(200),
  description VARCHAR2(500),
  is_active VARCHAR2(1) DEFAULT 'Y',
  FOREIGN KEY (category_id) REFERENCES per_mst_risk_category(category_id)
);

INSERT INTO risk_subcategories VALUES (1, 1, 'System Failure', 'IT system outages', 'Y');
INSERT INTO risk_subcategories VALUES (2, 1, 'Data Breach', 'Unauthorized data access', 'Y');
INSERT INTO risk_subcategories VALUES (3, 1, 'Cyber Attack', 'Malware/ransomware attacks', 'Y');

COMMIT;

-- SECTION 3: TRANSACTIONAL TABLES
-- ============================================================================

-- 3.1 Risk Assessments Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE risk_assessments';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE risk_assessments (
  assessment_id NUMBER PRIMARY KEY,
  risk_id NUMBER NOT NULL,
  assessment_type VARCHAR2(50),
  inherent_rating VARCHAR2(20),
  residual_rating VARCHAR2(20),
  assessment_date DATE DEFAULT SYSDATE,
  assessor_name VARCHAR2(100),
  notes CLOB,
  created_by VARCHAR2(50),
  created_date DATE DEFAULT SYSDATE,
  updated_by VARCHAR2(50),
  updated_date DATE,
  FOREIGN KEY (risk_id) REFERENCES per_trn_identify_risk(risk_id)
);

CREATE SEQUENCE risk_assessments_seq START WITH 1 INCREMENT BY 1;

-- 3.2 Mitigation Plans Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE mitigation_plans';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE mitigation_plans (
  plan_id NUMBER PRIMARY KEY,
  risk_id NUMBER NOT NULL,
  plan_name VARCHAR2(200),
  description CLOB,
  target_completion_date DATE,
  priority VARCHAR2(20),
  status VARCHAR2(50) DEFAULT 'DRAFT',
  responsible_owner VARCHAR2(100),
  created_by VARCHAR2(50),
  created_date DATE DEFAULT SYSDATE,
  updated_by VARCHAR2(50),
  updated_date DATE,
  FOREIGN KEY (risk_id) REFERENCES per_trn_identify_risk(risk_id)
);

CREATE SEQUENCE mitigation_plans_seq START WITH 1 INCREMENT BY 1;

-- 3.3 KRI Matrix Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE kri_matrix';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE kri_matrix (
  kri_id NUMBER PRIMARY KEY,
  risk_id NUMBER NOT NULL,
  kri_name VARCHAR2(200),
  kri_description CLOB,
  target_value NUMBER,
  threshold_value NUMBER,
  current_value NUMBER,
  measurement_frequency VARCHAR2(50),
  last_measured_date DATE,
  status VARCHAR2(20),
  created_date DATE DEFAULT SYSDATE,
  FOREIGN KEY (risk_id) REFERENCES per_trn_identify_risk(risk_id)
);

-- 3.4 KRI Configuration Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE kri_configuration';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE kri_configuration (
  config_id NUMBER PRIMARY KEY,
  config_name VARCHAR2(200),
  measurement_unit VARCHAR2(50),
  calculation_method CLOB,
  responsible_party VARCHAR2(100),
  reporting_frequency VARCHAR2(50),
  is_active VARCHAR2(1) DEFAULT 'Y',
  created_date DATE DEFAULT SYSDATE
);

COMMIT;

-- SECTION 4: ASSESSMENT TABLES
-- ============================================================================

-- 4.1 Appetite Framework Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE appetite_framework';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE appetite_framework (
  framework_id NUMBER PRIMARY KEY,
  framework_name VARCHAR2(200),
  description CLOB,
  risk_categories VARCHAR2(500),
  created_date DATE DEFAULT SYSDATE,
  is_active VARCHAR2(1) DEFAULT 'Y'
);

INSERT INTO appetite_framework VALUES (1, 'Standard Risk Appetite', 
  'Standard framework for enterprise risk management', 
  'Strategic,Operational,Financial,Compliance', SYSDATE, 'Y');

-- 4.2 Risk Appetite Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE risk_appetite';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE risk_appetite (
  appetite_id NUMBER PRIMARY KEY,
  category VARCHAR2(100),
  risk_level VARCHAR2(50),
  appetite_percentage NUMBER,
  appetite_statement CLOB,
  is_active VARCHAR2(1) DEFAULT 'Y'
);

INSERT INTO risk_appetite VALUES (1, 'Strategic', 'Low', 15, 'We have low appetite for strategic risks', 'Y');
INSERT INTO risk_appetite VALUES (2, 'Operational', 'Medium', 50, 'We have medium appetite for operational risks', 'Y');
INSERT INTO risk_appetite VALUES (3, 'Financial', 'Low', 20, 'We have low appetite for financial risks', 'Y');
INSERT INTO risk_appetite VALUES (4, 'Compliance', 'Very Low', 5, 'We have very low appetite for compliance risks', 'Y');

-- 4.3 Assessments Access Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE assessments_access';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE assessments_access (
  access_id NUMBER PRIMARY KEY,
  assessment_id NUMBER NOT NULL,
  user_id VARCHAR2(100),
  access_level VARCHAR2(20),
  access_date DATE DEFAULT SYSDATE,
  FOREIGN KEY (assessment_id) REFERENCES risk_assessments(assessment_id)
);

-- 4.4 Assessments Controls Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE assessments_controls';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE assessments_controls (
  assessment_control_id NUMBER PRIMARY KEY,
  assessment_id NUMBER NOT NULL,
  control_id NUMBER NOT NULL,
  control_rating VARCHAR2(50),
  effectiveness_rating VARCHAR2(50),
  last_tested_date DATE,
  next_test_date DATE,
  notes CLOB,
  updated_date DATE DEFAULT SYSDATE,
  FOREIGN KEY (assessment_id) REFERENCES risk_assessments(assessment_id),
  FOREIGN KEY (control_id) REFERENCES per_trn_control_implementation(control_id)
);

-- 4.5 Assessments Residual Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE assessments_residual';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE assessments_residual (
  residual_id NUMBER PRIMARY KEY,
  assessment_id NUMBER NOT NULL,
  residual_risk_rating VARCHAR2(50),
  residual_risk_score NUMBER,
  residual_notes CLOB,
  assessment_date DATE DEFAULT SYSDATE,
  FOREIGN KEY (assessment_id) REFERENCES risk_assessments(assessment_id)
);

COMMIT;

-- SECTION 5: MONITORING & TRACKING TABLES
-- ============================================================================

-- 5.1 Monitoring Action Plan Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE monitoring_action_plan';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE monitoring_action_plan (
  action_id NUMBER PRIMARY KEY,
  risk_id NUMBER NOT NULL,
  action_description CLOB,
  responsible_person VARCHAR2(100),
  target_completion_date DATE,
  status VARCHAR2(50),
  priority VARCHAR2(20),
  created_date DATE DEFAULT SYSDATE,
  updated_date DATE,
  FOREIGN KEY (risk_id) REFERENCES per_trn_identify_risk(risk_id)
);

-- 5.2 Monitoring Actions Hierarchy Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE monitoring_actions_hierarchy';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE monitoring_actions_hierarchy (
  hierarchy_id NUMBER PRIMARY KEY,
  parent_action_id NUMBER,
  child_action_id NUMBER,
  sequence_number NUMBER,
  created_date DATE DEFAULT SYSDATE,
  FOREIGN KEY (parent_action_id) REFERENCES monitoring_action_plan(action_id),
  FOREIGN KEY (child_action_id) REFERENCES monitoring_action_plan(action_id)
);

COMMIT;

-- SECTION 6: AUDIT & ADMINISTRATIVE TABLES
-- ============================================================================

-- 6.1 Assets Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE assets';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE assets (
  asset_id NUMBER PRIMARY KEY,
  asset_name VARCHAR2(200),
  asset_type VARCHAR2(100),
  asset_location VARCHAR2(200),
  current_value NUMBER,
  condition VARCHAR2(50),
  last_audit_date DATE,
  created_date DATE DEFAULT SYSDATE,
  updated_date DATE
);

-- 6.2 Audit Trail Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE audit_trail';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE audit_trail (
  audit_id NUMBER PRIMARY KEY,
  table_name VARCHAR2(100),
  record_id NUMBER,
  action VARCHAR2(20),
  old_value CLOB,
  new_value CLOB,
  changed_by VARCHAR2(50),
  changed_date DATE DEFAULT SYSDATE,
  ip_address VARCHAR2(50)
);

-- 6.3 Reports Table
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE reports';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE TABLE reports (
  report_id NUMBER PRIMARY KEY,
  report_name VARCHAR2(200),
  report_description CLOB,
  report_type VARCHAR2(50),
  created_by VARCHAR2(50),
  created_date DATE DEFAULT SYSDATE,
  last_run_date DATE,
  report_data CLOB
);

COMMIT;

-- ============================================================================
-- SECTION 7: ENABLE ORDS REST ENDPOINTS FOR ALL TABLES & VIEWS
-- ============================================================================
-- Execute these commands one by one in SQL Developer to enable REST endpoints

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'DASHBOARD_SUMMARY',
    p_object_type => 'VIEW',
    p_object_alias => 'dashboard/summary',
    p_read_only_methods => 'GET'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'RISK_TREND',
    p_object_type => 'VIEW',
    p_object_alias => 'dashboard/risk-trend',
    p_read_only_methods => 'GET'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'RISK_DISTRIBUTION',
    p_object_type => 'VIEW',
    p_object_alias => 'dashboard/risk-distribution',
    p_read_only_methods => 'GET'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'RISK_BY_CATEGORY',
    p_object_type => 'VIEW',
    p_object_alias => 'dashboard/risk-by-category',
    p_read_only_methods => 'GET'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'RISK_BY_PROCESS',
    p_object_type => 'VIEW',
    p_object_alias => 'dashboard/risk-by-process',
    p_read_only_methods => 'GET'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'CONTROL_EFFECTIVENESS',
    p_object_type => 'VIEW',
    p_object_alias => 'dashboard/control-effectiveness',
    p_read_only_methods => 'GET'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'MONITORING_STATUS',
    p_object_type => 'VIEW',
    p_object_alias => 'dashboard/monitoring-status',
    p_read_only_methods => 'GET'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'CONTROL_FREQUENCY',
    p_object_type => 'TABLE',
    p_object_alias => 'control-frequency'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'IMPACT',
    p_object_type => 'TABLE',
    p_object_alias => 'impact'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'LIKELIHOOD',
    p_object_type => 'TABLE',
    p_object_alias => 'likelihood'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'RISK_SUBCATEGORIES',
    p_object_type => 'TABLE',
    p_object_alias => 'risk-subcategories'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'RISK_ASSESSMENTS',
    p_object_type => 'TABLE',
    p_object_alias => 'risk-assessments'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'MITIGATION_PLANS',
    p_object_type => 'TABLE',
    p_object_alias => 'mitigation-plans'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'KRI_MATRIX',
    p_object_type => 'TABLE',
    p_object_alias => 'kri-matrix'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'KRI_CONFIGURATION',
    p_object_type => 'TABLE',
    p_object_alias => 'kri-configuration'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'APPETITE_FRAMEWORK',
    p_object_type => 'TABLE',
    p_object_alias => 'appetite/framework'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'RISK_APPETITE',
    p_object_type => 'TABLE',
    p_object_alias => 'appetite/risk-appetite'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'ASSESSMENTS_ACCESS',
    p_object_type => 'TABLE',
    p_object_alias => 'assessments/access'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'ASSESSMENTS_CONTROLS',
    p_object_type => 'TABLE',
    p_object_alias => 'assessments/controls'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'ASSESSMENTS_RESIDUAL',
    p_object_type => 'TABLE',
    p_object_alias => 'assessments/residual'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'MONITORING_ACTION_PLAN',
    p_object_type => 'TABLE',
    p_object_alias => 'monitoring/action-plan'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'MONITORING_ACTIONS_HIERARCHY',
    p_object_type => 'TABLE',
    p_object_alias => 'monitoring/actions-hierarchy'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'ASSETS',
    p_object_type => 'TABLE',
    p_object_alias => 'assets'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'AUDIT_TRAIL',
    p_object_type => 'TABLE',
    p_object_alias => 'audit-trail'
  );
  COMMIT;
END;
/

BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'REPORTS',
    p_object_type => 'TABLE',
    p_object_alias => 'reports'
  );
  COMMIT;
END;
/

-- ============================================================================
-- DONE! All tables and views have been created and ORDS endpoints enabled
-- ============================================================================
-- To verify everything worked:
-- 1. Go back to your terminal
-- 2. Run: node test-all-apis.js
-- 3. All 40+ endpoints should now work!
-- ============================================================================
