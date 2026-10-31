import fetch from 'node-fetch';

async function verify() {
    try {
        const res = await fetch('http://localhost:3000/api/per_trn_risk_monitoring');
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Total Records:", data.items ? data.items.length : data.length);
        if (data.items && data.items.length > 0) {
            console.log("Latest Record Keys:", Object.keys(data.items[data.items.length - 1]));
            console.log("Latest Record:", data.items[data.items.length - 1]);
        } else if (data.length > 0) {
            console.log("Latest Record Keys:", Object.keys(data[data.length - 1]));
            console.log("Latest Record:", data[data.length - 1]);
        } else {
            console.log(data);
        }
    } catch(err) {
        console.error(err);
    }
}
verify();
