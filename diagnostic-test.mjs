import axios from 'axios';

const TEST_SERVER = "http://localhost:5000";
const TEST_TABLE = "per_mst_business_process";

async function runDiagnostics() {
  console.log("=== API Diagnostic Test ===");
  
  // 1. Check Health (and auth status)
  console.log(`\n1. Checking Server Health (${TEST_SERVER}/health)...`);
  try {
    const health = await axios.get(`${TEST_SERVER}/health`);
    console.log("   ✅ Health Check Passed:", health.data);
  } catch (err) {
    console.error("   ❌ Health Check Failed:", err.response?.status || err.message);
    console.log("      Ensure you have CLIENT_ID and CLIENT_SECRET in your .env and the server is running.");
  }

  // 2. Check GET ALL
  console.log(`\n2. Checking GET ALL ${TEST_TABLE}...`);
  try {
    const response = await axios.get(`${TEST_SERVER}/api/${TEST_TABLE}`);
    console.log(`   ✅ GET ALL Passed: Found ${response.data.items?.length || response.data.length || 0} items`);
  } catch (err) {
    console.error(`   ❌ GET ALL Failed:`, err.response?.status, err.response?.data);
  }

  // 3. Test POST with lowercase keys (Case Transformation Check)
  console.log(`\n3. Checking POST with lowercase keys...`);
  const testData = {
    business_process_name: "Diagnostic Test " + Date.now(),
    description: "Testing case transformation logic"
  };
  
  try {
    const response = await axios.post(`${TEST_SERVER}/api/${TEST_TABLE}`, testData);
    console.log("   ✅ POST Passed (Case transformation worked!)");
    console.log("      Created ID:", response.data.id || response.data.uuid || "Unknown");
    
    const newId = response.data.id || response.data.uuid;
    if (newId) {
      // 4. Test DELETE
      console.log(`\n4. Checking DELETE for ID ${newId}...`);
      await axios.delete(`${TEST_SERVER}/api/${TEST_TABLE}/${newId}`);
      console.log("   ✅ DELETE Passed");
    }
  } catch (err) {
    console.error("   ❌ POST Failed:", err.response?.status, JSON.stringify(err.response?.data));
    console.log("      If you see 'Invalid Column', the case transformation or schema mapping is still mismatched.");
  }

  console.log("\n=== Diagnostics Complete ===");
}

runDiagnostics();
