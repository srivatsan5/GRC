import axios from 'axios';

const PROXY_URL = "http://localhost:5000/api/per_trn_identify_risk";

async function testProxy() {
  console.log(`Fetching from Proxy: ${PROXY_URL}...`);
  try {
    const res = await axios.get(PROXY_URL);
    console.log("Status:", res.status);
    console.log("Item Count:", res.data?.items?.length || 0);
  } catch (err) {
    console.error("Error:", err.response?.status, JSON.stringify(err.response?.data || err.message, null, 2));
  }
}

testProxy();
