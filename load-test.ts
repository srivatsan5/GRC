/**
 * Load Test - Simulates realistic user behavior and workload
 * Useful for stress testing and identifying bottlenecks
 */

import axios from 'axios'

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api'

interface LoadTestScenario {
  name: string
  requests: Array<{ endpoint: string; method: 'GET' | 'POST'; data?: any; weight: number }>
}

class LoadTester {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  })

  async runScenario(
    scenario: LoadTestScenario,
    concurrency: number,
    durationSeconds: number
  ) {
    console.log(`\n🚀 Load Test Scenario: ${scenario.name}`)
    console.log(`   Concurrency: ${concurrency}`)
    console.log(`   Duration: ${durationSeconds}s`)

    const stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [] as number[],
      errors: [] as string[],
    }

    const startTime = Date.now()
    const endTime = startTime + durationSeconds * 1000

    const activeRequests: Promise<void>[] = []

    while (Date.now() < endTime) {
      // Queue up concurrent requests
      for (let i = 0; i < concurrency; i++) {
        const request = this.executeScenarioRequest(scenario, stats)
        activeRequests.push(request)
      }

      // Wait a bit before next batch
      await new Promise(resolve => setTimeout(resolve, 100))

      // Clean up completed requests from array
      for (let i = activeRequests.length - 1; i >= 0; i--) {
        if (activeRequests[i]) {
          try {
            await Promise.race([activeRequests[i], new Promise((_, r) => setTimeout(() => r('timeout'), 100))])
            activeRequests.splice(i, 1)
          } catch {
            // Request still in progress
          }
        }
      }
    }

    // Wait for remaining requests
    await Promise.allSettled(activeRequests)

    this.printScenarioResults(scenario, stats)
    return stats
  }

  private async executeScenarioRequest(scenario: LoadTestScenario, stats: any) {
    try {
      const request = this.selectRandomRequest(scenario.requests)
      const startTime = Date.now()

      if (request.method === 'GET') {
        await this.api.get(request.endpoint)
      } else {
        await this.api.post(request.endpoint, request.data || {})
      }

      const responseTime = Date.now() - startTime
      stats.responseTimes.push(responseTime)
      stats.successfulRequests++
    } catch (error: any) {
      stats.failedRequests++
      stats.errors.push(error.message)
    } finally {
      stats.totalRequests++
    }
  }

  private selectRandomRequest(requests: any[]): any {
    const totalWeight = requests.reduce((sum, r) => sum + r.weight, 0)
    let random = Math.random() * totalWeight
    for (const request of requests) {
      random -= request.weight
      if (random <= 0) return request
    }
    return requests[0]
  }

  private printScenarioResults(scenario: LoadTestScenario, stats: any) {
    const sortedTimes = [...stats.responseTimes].sort((a, b) => a - b)
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0
    const avg = stats.responseTimes.reduce((a: number, b: number) => a + b, 0) / stats.responseTimes.length || 0
    const successRate = (stats.successfulRequests / stats.totalRequests) * 100

    console.log(`
📊 Results for "${scenario.name}":
   Total Requests: ${stats.totalRequests}
   Successful: ${stats.successfulRequests} ✓
   Failed: ${stats.failedRequests} ✗
   Success Rate: ${successRate.toFixed(2)}%
   
   Response Times:
   • Min: ${sortedTimes[0]}ms
   • Avg: ${Math.round(avg)}ms
   • P95: ${p95}ms
   • P99: ${p99}ms
   • Max: ${sortedTimes[sortedTimes.length - 1]}ms
    `)

    if (stats.errors.length > 0 && stats.errors.length <= 5) {
      console.log(`   Recent Errors:`)
      stats.errors.slice(0, 5).forEach((err: string) => {
        console.log(`   • ${err}`)
      })
    }
  }
}

// Define realistic load test scenarios
const scenarios: LoadTestScenario[] = [
  {
    name: 'Dashboard View (Light Load)',
    requests: [
      { endpoint: 'dashboard/summary', method: 'GET', weight: 3 },
      { endpoint: 'dashboard/risk-trend', method: 'GET', weight: 2 },
      { endpoint: 'dashboard/risk-distribution', method: 'GET', weight: 2 },
      { endpoint: 'dashboard/control-effectiveness', method: 'GET', weight: 1 },
    ],
  },
  {
    name: 'Risk Management (Medium Load)',
    requests: [
      { endpoint: 'per_trn_identify_risk', method: 'GET', weight: 2 },
      { endpoint: 'risk-assessments', method: 'GET', weight: 2 },
      { endpoint: 'mitigation-plans', method: 'GET', weight: 1 },
      { endpoint: 'per_trn_control_implementation', method: 'GET', weight: 1 },
    ],
  },
  {
    name: 'Master Data (Heavy Cache)',
    requests: [
      { endpoint: 'per_mst_risk_category', method: 'GET', weight: 2 },
      { endpoint: 'per_mst_control_type', method: 'GET', weight: 2 },
      { endpoint: 'per_mst_business_process', method: 'GET', weight: 1 },
      { endpoint: 'likelihood', method: 'GET', weight: 1 },
      { endpoint: 'impact', method: 'GET', weight: 1 },
    ],
  },
]

async function runLoadTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              Load Testing Suite - Risk API                   ║
╚═══════════════════════════════════════════════════════════════╝

Configuration:
   • API URL: ${API_BASE_URL}
   • Test will run multiple scenarios with increasing load
  `)

  const tester = new LoadTester()

  try {
    // Warm up
    console.log('\n⚡ Warming up...')
    await tester.runScenario(scenarios[0], 5, 5)

    // Light load test
    await tester.runScenario(scenarios[0], 25, 30)

    // Medium load test
    await tester.runScenario(scenarios[1], 50, 30)

    // Heavy load test
    await tester.runScenario(scenarios[2], 100, 30)

    console.log(`
✅ Load tests completed successfully!

Recommendations:
   • If P95 > 100ms: Consider adding caching or database optimization
   • If success rate < 99%: Review error logs and retry logic
   • If throughput < 100req/s: Evaluate horizontal scaling
    `)
  } catch (error) {
    console.error('❌ Load test failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  runLoadTests().catch(console.error)
}

export { LoadTester }
