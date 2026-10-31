import axios from 'axios';

const BASE_URL = "https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc";
const TEST_TABLE = "per_trn_identify_risk";

async function testPost() {
    const fullUrl = `${BASE_URL}/${TEST_TABLE}/`;
    console.log(`FULL URL: [${fullUrl}]`);
    
    const testData = {
        risk_name: "AI Test Risk",
        risk_description: "Checking persistence",
        risk_category: "Operational",
        inherent_probability: "Medium",
        inherent_impact: "High"
    };

    try {
        const response = await axios.post(fullUrl, testData, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('SUCCESS:', response.status);
    } catch (err) {
        console.error('ERROR:', err.message);
        if (err.response) {
            console.error('STATUS:', err.response.status);
            console.error('BODY:', JSON.stringify(err.response.data));
        }
    }
}

testPost();
