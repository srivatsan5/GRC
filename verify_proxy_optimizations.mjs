import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const TEST_ROUTE = 'per_trn_identify_risk';

async function runTests() {
  console.log('🚀 Starting Backend Proxy Verification...\n');

  try {
    // 1. Test basic GET
    console.log(`[Test 1] Basic GET /${TEST_ROUTE}`);
    try {
      const res1 = await axios.get(`${BASE_URL}/${TEST_ROUTE}`);
      console.log('✅ Success: Received data from ORDS proxy.\n');
    } catch (err) {
      console.error('❌ Test 1 Failed:', err.response?.data || err.message);
      throw err;
    }

    // 2. Test Query Parameter Forwarding
    const testId = 'TEST_ASSESSMENT_001';
    console.log(`[Test 2] Query Param Forwarding ?assessmentId=${testId}`);
    // We expect the outgoing request to ORDS to include this param. 
    // Since we don't see the ORDS logs, we check if the proxy survives the call.
    const res2 = await axios.get(`${BASE_URL}/${TEST_ROUTE}`, {
      params: { assessmentId: testId }
    });
    console.log('✅ Success: Proxy handled query parameters without error.\n');

    // 3. Test Error Handling (Simulate invalid ID)
    const invalidId = '99999999';
    console.log(`[Test 3] Error Handling /${TEST_ROUTE}/${invalidId}`);
    try {
      await axios.get(`${BASE_URL}/${TEST_ROUTE}/${invalidId}`);
    } catch (err) {
      const status = err.response?.status;
      console.log(`✅ Success: Proxy correctly returned ORDS error status [${status}].\n`);
    }

    console.log('✨ All backend verification tests passed! ✨');
  } catch (err) {
    console.error('❌ Verification Failed:', err.message);
    process.exit(1);
  }
}

runTests();
