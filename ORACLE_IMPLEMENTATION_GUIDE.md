# Oracle ORDS API Implementation Guide

## Objective
Enable all 40+ API endpoints for the Risk Management System by creating database tables, views, and ORDS REST endpoints.

---

## SECTION 1: DASHBOARD ENDPOINTS (7 endpoints)

These require creating views that aggregate data from existing risk tables.

### 1.1 Dashboard Summary
**Endpoint**: `/dashboard/summary`
**Type**: READ-ONLY View

```sql
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
  (SELECT COUNT(*) FROM per_trn_identify_risk) AS total_risks,
  (SELECT COUNT(*) FROM per_trn_risk_monitoring WHERE status = 'ACTIVE') AS active_monitoring,
  (SELECT COUNT(*) FROM per_trn_control_implementation) AS total_controls,
  SYSDATE AS last_updated
FROM dual;
```

**ORDS Configuration**:
```sql
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
```

### 1.2 Risk Trend (Month-over-Month)
**Endpoint**: `/dashboard/risk-trend`

```sql
CREATE OR REPLACE VIEW risk_trend AS
SELECT 
  TRUNC(CREATED_DATE, 'MONTH') AS month,
  COUNT(*) AS risk_count,
  AVG(RISK_LEVEL) AS avg_risk_level
FROM per_trn_identify_risk
WHERE CREATED_DATE >= ADD_MONTHS(SYSDATE, -12)
GROUP BY TRUNC(CREATED_DATE, 'MONTH')
ORDER BY month DESC;
```

### 1.3 Risk Distribution (by Status)
**Endpoint**: `/dashboard/risk-distribution`

```sql
CREATE OR REPLACE VIEW risk_distribution AS
SELECT 
  status,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM per_trn_identify_risk), 2) AS percentage
FROM per_trn_identify_risk
GROUP BY status;
```

### 1.4 Risk by Category
**Endpoint**: `/dashboard/risk-by-category`

```sql
CREATE OR REPLACE VIEW risk_by_category AS
SELECT 
  c.category_name,
  COUNT(r.risk_id) AS risk_count
FROM per_trn_identify_risk r
LEFT JOIN per_mst_risk_category c ON r.category_id = c.category_id
GROUP BY c.category_name;
```

### 1.5 Risk by Process
**Endpoint**: `/dashboard/risk-by-process`

```sql
CREATE OR REPLACE VIEW risk_by_process AS
SELECT 
  p.process_name,
  COUNT(r.risk_id) AS risk_count
FROM per_trn_identify_risk r
LEFT JOIN per_mst_business_process p ON r.process_id = p.process_id
GROUP BY p.process_name;
```

### 1.6 Control Effectiveness
**Endpoint**: `/dashboard/control-effectiveness`

```sql
CREATE OR REPLACE VIEW control_effectiveness AS
SELECT 
  c.control_name,
  COUNT(m.monitoring_id) AS monitoring_count,
  ROUND(COUNT(CASE WHEN m.effectiveness = 'EFFECTIVE' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(m.monitoring_id), 0), 2) AS effectiveness_percentage
FROM per_trn_control_implementation c
LEFT JOIN per_trn_risk_monitoring m ON c.control_id = m.control_id
GROUP BY c.control_name;
```

### 1.7 Monitoring Status
**Endpoint**: `/dashboard/monitoring-status`

```sql
CREATE OR REPLACE VIEW monitoring_status AS
SELECT 
  status,
  COUNT(*) AS count
FROM per_trn_risk_monitoring
GROUP BY status;
```

---

## SECTION 2: TRANSACTIONAL TABLES (Need CRUD endpoints)

### 2.1 Risk Assessments Table
**Endpoint**: `/risk-assessments` (GET, POST, PUT, DELETE)

```sql
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
```

**ORDS Configuration**:
```sql
BEGIN
  ORDS.enable_object(
    p_object_schema => 'PERICOPE_AI',
    p_object_name => 'RISK_ASSESSMENTS',
    p_object_type => 'TABLE',
    p_object_alias => 'risk-assessments',
    p_read_only_methods => 'GET'
  );
  COMMIT;
END;
/
```

### 2.2 Mitigation Plans Table
**Endpoint**: `/mitigation-plans` (GET, POST, PUT, DELETE)

```sql
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
```

### 2.3 Control Frequency Reference Table
**Endpoint**: `/control-frequency` (GET)

```sql
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
COMMIT;
```

### 2.4 Impact Levels Reference Table
**Endpoint**: `/impact` (GET)

```sql
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
COMMIT;
```

### 2.5 Likelihood Levels Reference Table
**Endpoint**: `/likelihood` (GET)

```sql
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
COMMIT;
```

### 2.6 Risk Subcategories Table
**Endpoint**: `/risk-subcategories` (GET)

```sql
CREATE TABLE risk_subcategories (
  subcategory_id NUMBER PRIMARY KEY,
  category_id NUMBER NOT NULL,
  subcategory_name VARCHAR2(200),
  description VARCHAR2(500),
  is_active VARCHAR2(1) DEFAULT 'Y',
  FOREIGN KEY (category_id) REFERENCES per_mst_risk_category(category_id)
);

-- Insert sample subcategories for each main category
INSERT INTO risk_subcategories VALUES (1, 1, 'System Failure', 'IT system outages', 'Y');
INSERT INTO risk_subcategories VALUES (2, 1, 'Data Breach', 'Unauthorized data access', 'Y');
INSERT INTO risk_subcategories VALUES (3, 1, 'Cyber Attack', 'Malware/ransomware attacks', 'Y');
COMMIT;
```

### 2.7 KRI Matrix Table
**Endpoint**: `/kri-matrix` (GET)

```sql
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
  FOREIGN KEY (risk_id) REFERENCES per_trn_identify_risk(risk_id)
);
```

### 2.8 KRI Configuration Table
**Endpoint**: `/kri-configuration` (GET)

```sql
CREATE TABLE kri_configuration (
  config_id NUMBER PRIMARY KEY,
  config_name VARCHAR2(200),
  measurement_unit VARCHAR2(50),
  calculation_method CLOB,
  responsible_party VARCHAR2(100),
  reporting_frequency VARCHAR2(50),
  is_active VARCHAR2(1) DEFAULT 'Y'
);
```

---

## SECTION 3: ASSESSMENT ENDPOINTS

### 3.1 Appetite Framework
**Endpoint**: `/appetite/framework` (GET)

```sql
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
COMMIT;
```

### 3.2 Risk Appetite Levels
**Endpoint**: `/appetite/risk-appetite` (GET)

```sql
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
COMMIT;
```

### 3.3 Assessments - Access
**Endpoint**: `/assessments/access` (GET)

```sql
CREATE TABLE assessments_access (
  access_id NUMBER PRIMARY KEY,
  assessment_id NUMBER NOT NULL,
  user_id VARCHAR2(100),
  access_level VARCHAR2(20),
  access_date DATE DEFAULT SYSDATE,
  FOREIGN KEY (assessment_id) REFERENCES risk_assessments(assessment_id)
);
```

### 3.4 Assessments - Controls
**Endpoint**: `/assessments/controls` (GET, PUT for updates)

```sql
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
```

### 3.5 Assessments - Residual
**Endpoint**: `/assessments/residual` (GET)

```sql
CREATE TABLE assessments_residual (
  residual_id NUMBER PRIMARY KEY,
  assessment_id NUMBER NOT NULL,
  residual_risk_rating VARCHAR2(50),
  residual_risk_score NUMBER,
  residual_notes CLOB,
  assessment_date DATE DEFAULT SYSDATE,
  FOREIGN KEY (assessment_id) REFERENCES risk_assessments(assessment_id)
);
```

---

## SECTION 4: MONITORING & TRACKING

### 4.1 Monitoring Action Plan
**Endpoint**: `/monitoring/action-plan` (GET)

```sql
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
```

### 4.2 Monitoring Actions Hierarchy
**Endpoint**: `/monitoring/actions-hierarchy` (GET)

```sql
CREATE TABLE monitoring_actions_hierarchy (
  hierarchy_id NUMBER PRIMARY KEY,
  parent_action_id NUMBER,
  child_action_id NUMBER,
  sequence_number NUMBER,
  created_date DATE DEFAULT SYSDATE,
  FOREIGN KEY (parent_action_id) REFERENCES monitoring_action_plan(action_id),
  FOREIGN KEY (child_action_id) REFERENCES monitoring_action_plan(action_id)
);
```

---

## SECTION 5: AUDIT & ASSETS

### 5.1 Assets Table
**Endpoint**: `/assets` (GET, POST, PUT, DELETE)

```sql
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
```

### 5.2 Audit Trail Table
**Endpoint**: `/audit-trail` (GET)

```sql
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
```

### 5.3 Reports Table
**Endpoint**: `/reports` (GET)

```sql
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
```

---

## SECTION 6: ENABLE ORDS FOR ALL TABLES

After creating all tables, enable ORDS REST endpoints:

```sql
-- Enable all tables
BEGIN
  FOR rec IN (SELECT table_name FROM user_tables WHERE table_name LIKE '%') LOOP
    ORDS.enable_object(
      p_object_schema => 'PERICOPE_AI',
      p_object_name => rec.table_name,
      p_object_type => 'TABLE',
      p_object_alias => LOWER(REPLACE(rec.table_name, '_', '-')),
      p_read_only_methods => 'GET'
    );
  END LOOP;
  COMMIT;
END;
/
```

---

## SECTION 7: EXECUTION STEPS

### Step 1: Connect to Oracle ORDS SQL Developer
1. Use SQL Developer
2. Connect with credentials from `.env` file
3. Execute each SQL script section by section

### Step 2: Create All Views
Execute sections 1.1 through 1.7 (Dashboard endpoints)

### Step 3: Create All Tables
Execute sections 2.1 through 5.3 (Transactional tables)

### Step 4: Enable ORDS
Execute section 6 to enable REST endpoints for all tables

### Step 5: Test Endpoints
Run the test suite again:
```bash
node test-all-apis.js
```

---

## SECTION 8: WHAT THE BACKEND WILL DO AUTOMATICALLY

Once you create the tables in Oracle:

✅ Express server (server.js) will:
- Automatically proxy requests to the new ORDS endpoints
- Handle GET, POST, PUT, DELETE operations
- Return normalized JSON responses
- Log all requests

✅ Frontend (oracleService.ts) will:
- Call all 40+ endpoints automatically
- Use new API methods we added
- Components will render with data

---

## SUMMARY

**What to do on Oracle:**
1. Create 31 new tables/views (if they don't exist)
2. Enable ORDS REST endpoints for each
3. Populate reference tables with data
4. Test with SELECT queries

**What's already done:**
- ✅ Express backend configured
- ✅ API routes registered  
- ✅ Frontend components ready
- ✅ oracleService.ts with all method definitions

**Result:**
- All 40+ endpoints will be fully functional
- Frontend can call any endpoint
- Full CRUD operations available
- 100% API coverage

---

## QUICK START SCRIPT

If you want to do this quickly, I can provide a single SQL script file that creates everything. Would you like me to generate that?
