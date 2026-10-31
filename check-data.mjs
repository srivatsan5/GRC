import axios from 'axios';

// Use credentials from .env if possible, but let's try direct open access first as proxy does.
const BASE_URL = "https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc";
const TABLE = "per_trn_identify_risk";

async function fetchData() {
  console.log(`Fetching from ${BASE_URL}/${TABLE}/...`);
  try {
    const res = await axios.get(`${BASE_URL}/${TABLE}/`);
    console.log("Status:", res.status);
    console.log("Item Count:", res.data?.items?.length || 0);
    console.log("Sample Item:", JSON.stringify(res.data?.items?.[0] || {}, null, 2));
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

fetchData();
