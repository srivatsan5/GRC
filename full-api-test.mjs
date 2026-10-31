import axios from 'axios';

const BASE_URL = "https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc";
const TABLES = [
  "per_trn_identify_risk",
  "per_trn_risk_monitoring",
  "per_trn_control_implementation",
  "per_mst_business_process",
  "per_mst_control_type",
  "per_mst_risk_category"
];

async function runTests() {
    console.log(`--- PERICOPE ERM: COMPREHENSIVE API TEST ---`);
    console.log(`Base URL: ${BASE_URL}\n`);
    
    let allSuccess = true;
    for (const table of TABLES) {
        process.stdout.write(`Testing [${table}]... `);
        try {
            const response = await axios.get(`${BASE_URL}/${table}`, { timeout: 10000 });
            console.log(`SUCCESS (Status: ${response.status}, Count: ${response.data.items?.length || 0})`);
        } catch (err) {
            console.log(`FAILED (${err.message})`);
            allSuccess = false;
        }
    }
    
    console.log(`\n--- TEST COMPLETE: ${allSuccess ? 'ALL PASSED' : 'SOME FAILED'} ---`);
    process.exit(allSuccess ? 0 : 1);
}

runTests();
