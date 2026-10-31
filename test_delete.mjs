import axios from 'axios';

const testDelete = async () => {
    try {
        console.log("Testing DELETE on per_trn_identify_risk/999 (Non-existent)");
        // Using a non-existent ID to see the error type (404 vs 405 vs 500)
        const res = await axios.delete("http://localhost:5000/api/per_trn_identify_risk/999");
        console.log("Response:", res.status, res.data);
    } catch (err) {
        console.error("Delete failed:");
        console.error("Status:", err.response?.status);
        console.error("Data:", JSON.stringify(err.response?.data, null, 2));
    }
};

testDelete();
