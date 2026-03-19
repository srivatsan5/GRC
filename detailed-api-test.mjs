import http from 'http';

const BASE_URL = 'http://localhost:5000';

const endpoints = [
  { name: 'Health Check', path: '/api/health' },
  { name: 'Risk Categories', path: '/api/per_mst_risk_category' },
  { name: 'Identified Risks', path: '/api/per_trn_identify_risk' },
  { name: 'Control Implementation', path: '/api/per_trn_control_implementation' },
  { name: 'Risk Monitoring', path: '/api/per_trn_risk_monitoring' },
  { name: 'Risk Assessments', path: '/api/risk-assessments' },
  { name: 'Mitigation Plans', path: '/api/mitigation-plans' },
  { name: 'Assets', path: '/api/assets' },
];

let completedTests = 0;
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(BASE_URL + endpoint.path);
    
    const startTime = Date.now();
    const request = http.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        const status = res.statusCode;
        
        let recordCount = 0;
        try {
          const json = JSON.parse(data);
          if (json.data && Array.isArray(json.data)) {
            recordCount = json.data.length;
          }
        } catch (e) {}
        
        const result = {
          name: endpoint.name,
          path: endpoint.path,
          status: status,
          responseTime: responseTime,
          records: recordCount,
          passed: status === 200
        };
        
        results.total++;
        if (status === 200) {
          results.passed++;
        } else {
          results.failed++;
        }
        results.details.push(result);
        
        resolve(result);
      });
    });
    
    request.on('error', (err) => {
      const result = {
        name: endpoint.name,
        path: endpoint.path,
        status: 'ERROR',
        responseTime: 0,
        records: 0,
        error: err.message,
        passed: false
      };
      
      results.total++;
      results.failed++;
      results.details.push(result);
      resolve(result);
    });
    
    request.on('timeout', () => {
      request.destroy();
      const result = {
        name: endpoint.name,
        path: endpoint.path,
        status: 'TIMEOUT',
        responseTime: 5000,
        records: 0,
        passed: false
      };
      
      results.total++;
      results.failed++;
      results.details.push(result);
      resolve(result);
    });
  });
}

async function runAllTests() {
  console.log('==========================================');
  console.log('RISK MANAGEMENT API - DETAILED TEST SUITE');
  console.log('==========================================\n');
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    
    const status = result.passed ? '✅' : '❌';
    const time = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    const records = result.records ? ` | Records: ${result.records}` : '';
    
    console.log(`${status} ${result.name.padEnd(25)} | Status: ${String(result.status).padEnd(6)} | ${time.padStart(6)}${records}`);
  }
  
  console.log('\n==========================================');
  console.log('TEST SUMMARY');
  console.log('==========================================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ✅ ${results.passed}`);
  console.log(`Failed: ❌ ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('==========================================\n');
  
  console.log('DETAILED RESULTS:');
  results.details.forEach((r, i) => {
    console.log(`${i + 1}. ${r.name}`);
    console.log(`   Path: ${r.path}`);
    console.log(`   Status: ${r.status}`);
    console.log(`   Response Time: ${r.responseTime}ms`);
    if (r.records) console.log(`   Records Retrieved: ${r.records}`);
    if (r.error) console.log(`   Error: ${r.error}`);
    console.log('');
  });
}

runAllTests();
