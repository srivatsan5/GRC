const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testEndpoint(method, path, data = null) {
  try {
    const res = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data
    });
    console.log(`[PASS] ${method} ${path} - Status: ${res.status}`);
    return res.data;
  } catch (err) {
    console.error(`[FAIL] ${method} ${path} - Status: ${err.response?.status || 'N/A'}`);
    console.error(`       Error: ${JSON.stringify(err.response?.data) || err.message}`);
    return null;
  }
}

async function verifyAll() {
  console.log('--- STARTING COMPREHENSIVE NEW API VERIFICATION ---\n');

  // HEALTH
  await testEndpoint('GET', '/health');

  // DASHBOARD
  console.log('\n--- TESTING DASHBOARD APIs ---');
  const dashboardApis = [
    'summary', 'risk-trend', 'risk-distribution', 'control-effectiveness', 
    'risk-by-process', 'risk-by-category', 'monitoring-status'
  ];
  for (const api of dashboardApis) {
    await testEndpoint('GET', `/dashboard/${api}`);
  }

  // TRANSACTIONAL & MASTER TABLES
  console.log('\n--- TESTING TRANSACTIONAL & MASTER TABLES (GET) ---');
  const riskTables = [
    'per_trn_identify_risk', 'per_trn_control_implementation', 'per_trn_risk_monitoring',
    'risk-assessments', 'mitigation-plans', 'per_mst_business_process', 
    'per_mst_control_type', 'per_mst_risk_category', 'control-frequency', 
    'impact', 'likelihood', 'risk-subcategories'
  ];
  for (const table of riskTables) {
    await testEndpoint('GET', `/${table}`);
  }

  // TRANSACTIONAL (POST)
  console.log('\n--- TESTING TRANSACTIONAL POST (per_trn_identify_risk) ---');
  const postPayload = {
    "HIERARCHY_LEVEL": 1,
    "HIERARCHY_NAME": "NEW_API_TEST",
    "ASSESSMENT_REGISTERED_DATE": new Date().toISOString(),
    "ASSESSOR": "Verification Script",
    "RISK_STATEMENT": "Test Risk Statement via New API Architecture",
    "IS_SOP_AVAILABLE": "Y",
    "LIKELIHOOD": "1 - Rare",
    "IMPACT": "1 - Insignificant",
    "INHERENT_SLE": 0
  };
  await testEndpoint('POST', '/per_trn_identify_risk', postPayload);

  console.log('\n--- VERIFICATION COMPLETE ---');
}

verifyAll();
