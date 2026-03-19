import http from 'http';

const BASE_URL = 'http://localhost:5000';

const endpoints = [
  '/api/health',
  '/api/per_mst_risk_category',
  '/api/per_trn_identify_risk',
  '/api/per_trn_control_implementation',
  '/api/per_trn_risk_monitoring',
];

const testConfig = {
  iterations: 10,  // Test each endpoint 10 times
  concurrency: 2,  // 2 concurrent requests
};

const results = {
  endpoints: {},
  overall: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTime: 0,
  }
};

function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(BASE_URL + endpoint);
    
    const request = http.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          endpoint,
          status: res.statusCode,
          responseTime,
          success: res.statusCode === 200,
          size: data.length
        });
      });
    });
    
    request.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      resolve({
        endpoint,
        status: 'ERROR',
        responseTime,
        success: false,
        error: err.message
      });
    });
  });
}

async function runPerformanceTests() {
  console.log('==========================================');
  console.log('PERFORMANCE TEST SUITE');
  console.log('==========================================\n');
  console.log(`Configuration:`);
  console.log(`  - Iterations per endpoint: ${testConfig.iterations}`);
  console.log(`  - Concurrency: ${testConfig.concurrency}`);
  console.log(`  - Total requests: ${endpoints.length * testConfig.iterations}\n`);
  
  // Initialize results structure
  endpoints.forEach(ep => {
    results.endpoints[ep] = {
      responseTimes: [],
      successCount: 0,
      failureCount: 0,
    };
  });
  
  // Run tests
  console.log('Running tests...\n');
  for (let i = 0; i < testConfig.iterations; i++) {
    const promises = [];
    for (const endpoint of endpoints) {
      promises.push(makeRequest(endpoint));
    }
    
    const testResults = await Promise.all(promises);
    
    for (const result of testResults) {
      if (result.success) {
        results.endpoints[result.endpoint].responseTimes.push(result.responseTime);
        results.endpoints[result.endpoint].successCount++;
        results.overall.successfulRequests++;
      } else {
        results.endpoints[result.endpoint].failureCount++;
        results.overall.failedRequests++;
      }
      results.overall.totalRequests++;
      results.overall.totalResponseTime += result.responseTime;
    }
    
    process.stdout.write(`\rProgress: ${((i + 1) / testConfig.iterations * 100).toFixed(1)}%`);
  }
  
  console.log('\n\n==========================================');
  console.log('PERFORMANCE RESULTS');
  console.log('==========================================\n');
  
  // Calculate statistics
  const stats = {};
  for (const [endpoint, data] of Object.entries(results.endpoints)) {
    const times = data.responseTimes;
    times.sort((a, b) => a - b);
    
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    const min = times[0];
    const max = times[times.length - 1];
    
    stats[endpoint] = { mean, p50, p95, p99, min, max };
  }
  
  // Print results
  console.log('Endpoint Performance Metrics:\n');
  console.log('Endpoint'.padEnd(40) + ' | Mean   | P50    | P95    | P99    | Min    | Max');
  console.log('-'.repeat(110));
  
  for (const [endpoint, stat] of Object.entries(stats)) {
    const ep = endpoint.substring(0, 38);
    console.log(
      ep.padEnd(40) + ' | ' +
      `${stat.mean.toFixed(0)}ms`.padEnd(6) + ' | ' +
      `${stat.p50}ms`.padEnd(6) + ' | ' +
      `${stat.p95}ms`.padEnd(6) + ' | ' +
      `${stat.p99}ms`.padEnd(6) + ' | ' +
      `${stat.min}ms`.padEnd(6) + ' | ' +
      `${stat.max}ms`
    );
  }
  
  console.log('\n==========================================');
  console.log('OVERALL STATISTICS');
  console.log('==========================================');
  console.log(`Total Requests: ${results.overall.totalRequests}`);
  console.log(`Successful: ${results.overall.successfulRequests}`);
  console.log(`Failed: ${results.overall.failedRequests}`);
  console.log(`Success Rate: ${((results.overall.successfulRequests / results.overall.totalRequests) * 100).toFixed(1)}%`);
  console.log(`Avg Response Time: ${(results.overall.totalResponseTime / results.overall.totalRequests).toFixed(0)}ms`);
  
  console.log('\n==========================================');
  console.log('TARGET ANALYSIS');
  console.log('==========================================');
  const allTimes = Object.values(stats);
  const allP95s = allTimes.map(s => s.p95);
  const overallP95 = Math.max(...allP95s);
  
  console.log(`Overall P95 Response Time: ${overallP95}ms`);
  console.log(`Target P95: 100ms`);
  
  if (overallP95 <= 100) {
    console.log(`✅ PERFORMANCE TARGET MET`);
  } else {
    console.log(`⚠️  EXCEEDS TARGET (${overallP95 - 100}ms over)`);
  }
  
  console.log('\n');
}

runPerformanceTests();
