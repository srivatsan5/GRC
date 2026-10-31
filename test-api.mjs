import axios from 'axios';

const BASE_URL = "https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc";
const TEST_TABLE = "per_trn_identify_risk";

async function test() {
    console.log(`Testing GET ${BASE_URL}/${TEST_TABLE}...`);
    try {
        const response = await axios.get(`${BASE_URL}/${TEST_TABLE}`, {
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });
        console.log('API Status:', response.status);
        console.log('Data Preview:', JSON.stringify(response.data).slice(0, 200));
        process.exit(0);
    } catch (err) {
        console.error('API Error:', err.message);
        if (err.response) {
            console.error('Response Data:', err.response.data);
        }
        process.exit(1);
    }
}

test();
