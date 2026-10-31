import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const audit = async () => {
  console.log('--- PERICOPE ERM CRUD AUDIT START ---');

  const testTable = async (endpoint, data, updateData = null) => {
    console.log(`\n[Audit] Testing endpoint: ${endpoint}`);
    try {
      // 1. CREATE (POST)
      console.log(`[Audit] POST ${endpoint}...`);
      const postRes = await axios.post(`${API_URL}/${endpoint}`, data);
      const uuid = postRes.data.uuid || postRes.data.identify_risk_uuid || postRes.data.id;
      console.log(`[Audit] SUCCESS: Created with ID ${uuid}`);

      // 2. READ (GET)
      console.log(`[Audit] GET ${endpoint}/${uuid}...`);
      const getRes = await axios.get(`${API_URL}/${endpoint}/${uuid}`);
      console.log(`[Audit] SUCCESS: Retrieved record`);

      // 3. UPDATE (PUT)
      if (updateData) {
        console.log(`[Audit] PUT ${endpoint}/${uuid}...`);
        await axios.put(`${API_URL}/${endpoint}/${uuid}`, updateData);
        console.log(`[Audit] SUCCESS: Updated record`);
      }

      // 4. DELETE (DELETE)
      console.log(`[Audit] DELETE ${endpoint}/${uuid}...`);
      await axios.delete(`${API_URL}/${endpoint}/${uuid}`);
      console.log(`[Audit] SUCCESS: Deleted record`);

      return true;
    } catch (err) {
      console.error(`[Audit] FAILED: ${endpoint} | ${err.response?.status || err.code}`);
      if (err.response?.data) console.error(`[Audit] Error Detail:`, JSON.stringify(err.response.data));
      return false;
    }
  };

  // Test Identify Risk
  await testTable('per_trn_identify_risk', {
    risk_statement: 'AUDIT_TEST_RISK',
    risk_type: 'Audit',
    inherent_sle: 50000,
    risk_owner: 'System Audit',
    is_stage_complted: 'N'
  }, {
    is_stage_complted: 'Y'
  });

  // Test Control Implementation
  await testTable('per_trn_control_implementation', {
    identify_risk_uuid: 1,
    control_id: 'CTRL-AUDIT-001',
    control_owner: 'Audit Team',
    control_design_effectiveness: 85,
    is_stage_complted: 'N'
  }, {
    control_design_effectiveness: 95
  });

  // Test Risk Monitoring
  await testTable('per_trn_risk_monitoring', {
    monitoring_title: 'AUDIT_MONITOR_001',
    monitoring_goal: 'Test Persistence',
    mitigation_owner: 'Audit Bot',
    is_stage_complted: 'N'
  }, {
    completion_pct: 100
  });

  // Test KPI Definition
  await testTable('erm_mst_kpi_definition', {
    kpi_code: 'KPI_AUDIT_001',
    kpi_name: 'Audit KPI',
    kpi_category: 'System',
    target_value: 100
  });

  console.log('\n--- PERICOPE ERM CRUD AUDIT COMPLETE ---');
};

audit();
