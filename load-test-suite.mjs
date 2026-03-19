import http from 'http';

const BASE_URL = 'http://localhost:5000';

const endpoints = [
  '/api/health',
  '/api/per_mst_risk_category',
  '/api/per_trn_identify_risk',
];

const loadConfig = {
  duration: 30000,  // 30 seconds
  requestsPerSecond: 5,  // 5 requests per second (30 total per endpoint)
};

const results = {
  total: 0,
  successful: 0,
  failed: 0,
  errors: {},
  responseTimes: [],
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
          success: res.statusCode === 200,
          responseTime,
          status: res.statusCode
        });
      });
    });
    
    request.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      resolve({
        success: false,
        responseTime,
        error: err.message
      });
    });
  });
}

async function runLoadTest() {
  console.log('==========================================');
  console.log('LOAD TEST SUITE');
  console.log('==========================================\n');
  console.log(`Configuration:`);
  console.log(`  - Duration: ${loadConfig.duration / 1000} seconds`);
  console.log(`  - Requests/second: ${loadConfig.requestsPerSecond}`);
  console.log(`  - Endpoints: ${endpoints.length}`);
  console.log(`  - Expected total requests: ${(loadConfig.duration / 1000) * loadConfig.requestsPerSecond * endpoints.length}\n`);
  
  console.log('Running load test...\n');
  
  const startTime = Date.now();
  let endTime = startTime + loadConfig.duration;
  let requestCount = 0;
  
  while (Date.now() < endTime) {
    const batchStartTime = Date.now();
    const promises = [];
    
    // Fire loadConfig.requestsPerSecond requests per endpoint
    for (const endpoint of endpoints) {
      promises.push(makeRequest(endpoint));
    }
    
    const batchResults = await Promise.all(promises);
    
    for (const result of batchResults) {
      results.total++;
      results.responseTimes.push(result.responseTime);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        const errorType = result.error || 'HTTP Error';
        results.errors[errorType] = (results.errors[errorType] || 0) + 1;
      }
    }
    
    requestCount++;
    
    // Rate limiting - maintain requestsPerSecond rate
    const batchDuration = Date.now() - batchStartTime;
    const requiredDelay = (1000 / loadConfig.requestsPerSecond) - batchDuration;
    if (requiredDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, requiredDelay));
    }
    
    // Progress indicator
    const elapsedTime = Date.now() - startTime;
    const progress = (elapsedTime / loadConfig.duration * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${progress}% | Requests: ${results.total} | Successful: ${results.successful} | Failed: ${results.failed}`);
  }
  
  console.log('\n\n==========================================');
  console.log('LOAD TEST RESULTS');
  console.log('==========================================\n');
  
  // Calculate statistics
  results.responseTimes.sort((a, b) => a - b);
  
  const mean = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
  const p50 = results.responseTimes[Math.floor(results.responseTimes.length * 0.5)];
  const p95 = results.responseTimes[Math.floor(results.responseTimes.length * 0.95)];
  const p99 = results.responseTimes[Math.floor(results.responseTimes.length * 0.99)];
  const min = results.responseTimes[0];
  const max = results.responseTimes[results.responseTimes.length - 1];
  
  const testDuration = (Date.now() - startTime) / 1000;
  const throughput = (results.total / testDuration).toFixed(2);
  
  console.log('Statistics:');
  console.log(`  Total Requests: ${results.total}`);
  console.log(`  Successful: ${results.successful}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Success Rate: ${((results.successful / results.total) * 100).toFixed(2)}%`);
  console.log(`  Test Duration: ${testDuration.toFixed(1)}s`);
  console.log(`  Throughput: ${throughput} req/s`);
  
  console.log('\nResponse Times:');
  console.log(`  Min: ${min}ms`);
  console.log(`  Mean: ${mean.toFixed(0)}ms`);
  console.log(`  P50: ${p50}ms`);
  console.log(`  P95: ${p95}ms`);
  console.log(`  P99: ${p99}ms`);
  console.log(`  Max: ${max}ms`);
  
  if (Object.keys(results.errors).length > 0) {
    console.log('\nErrors:');
    for (const [error, count] of Object.entries(results.errors)) {
      console.log(`  ${error}: ${count}`);
    }
  }
  
  console.log('\n==========================================');
  console.log('LOAD TEST VERDICT');
  console.log('==========================================');
  
  const healthScore = results.successful / results.total > 0.99 ? '✅' : '⚠️';
  const performanceScore = p95 < 500 ? '✅' : '⚠️';
  
  console.log(`System Stability: ${healthScore} ${((results.successful / results.total) * 100).toFixed(1)}% success rate`);
  console.log(`Performance: ${performanceScore} P95 = ${p95}ms`);
  console.log(`Throughput: ${throughput} req/s`);
  
  console.log('\n');
}

runLoadTest();
