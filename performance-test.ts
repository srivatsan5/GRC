/**
 * Performance Testing Suite for Risk Management API
 * Tests response times, throughput, error rates, and load handling
 */

import axios from 'axios'

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api'
const CONCURRENT_REQUESTS = process.env.CONCURRENT || '50'
const DURATION_SECONDS = process.env.DURATION || '30'

interface TestResult {
  endpoint: string
  method: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  throughput: number // requests per second
  errorRate: number // percentage
}

class PerformanceTester {
  private results: TestResult[] = []
  private startTime = Date.now()

  async testEndpoint(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
    duration = parseInt(DURATION_SECONDS)
  ): Promise<TestResult> {
    const responseTimes: number[] = []
    const startTime = Date.now()
    const endTime = startTime + duration * 1000
    let successful = 0
    let failed = 0

    console.log(`\n📊 Testing ${method} ${endpoint}...`)
    console.log(`⏱️  Duration: ${duration}s | Concurrency: ${CONCURRENT_REQUESTS}`)

    const requests: Promise<any>[] = []

    while (Date.now() < endTime) {
      const batchSize = parseInt(CONCURRENT_REQUESTS)

      for (let i = 0; i < batchSize; i++) {
        const request = this.makeRequest(endpoint, method, data, responseTimes, (success) => {
          if (success) successful++
          else failed++
        })

        requests.push(request)
      }

      // Wait a bit before next batch
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Wait for all remaining requests to complete
    await Promise.allSettled(requests)

    const totalRequests = successful + failed
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0
    const sortedTimes = [...responseTimes].sort((a, b) => a - b)
    const p95Index = Math.floor(sortedTimes.length * 0.95)
    const p99Index = Math.floor(sortedTimes.length * 0.99)

    const result: TestResult = {
      endpoint,
      method,
      totalRequests,
      successfulRequests: successful,
      failedRequests: failed,
      avgResponseTime: Math.round(avgResponseTime),
      minResponseTime: sortedTimes[0] || 0,
      maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      throughput: Math.round((totalRequests / duration) * 10) / 10,
      errorRate: Math.round((failed / totalRequests) * 100 * 100) / 100,
    }

    this.results.push(result)
    this.printResult(result)

    return result
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    data: any,
    responseTimes: number[],
    callback: (success: boolean) => void
  ) {
    const startTime = Date.now()

    try {
      if (method === 'GET') {
        await axios.get(`${API_BASE_URL}/${endpoint}`, { timeout: 10000 })
      } else {
        await axios.post(`${API_BASE_URL}/${endpoint}`, data || {}, { timeout: 10000 })
      }

      const duration = Date.now() - startTime
      responseTimes.push(duration)
      callback(true)
    } catch (error) {
      callback(false)
    }
  }

  private printResult(result: TestResult) {
    console.log(`
✅ Results for ${result.method} ${result.endpoint}:
   • Total Requests: ${result.totalRequests}
   • Successful: ${result.successfulRequests} ✓
   • Failed: ${result.failedRequests} ✗
   • Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%
   • Avg Response: ${result.avgResponseTime}ms
   • Min Response: ${result.minResponseTime}ms
   • Max Response: ${result.maxResponseTime}ms
   • P95 Response: ${result.p95ResponseTime}ms
   • P99 Response: ${result.p99ResponseTime}ms
   • Throughput: ${result.throughput} req/s
    `)
  }

  printSummary() {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              PERFORMANCE TEST SUMMARY                         ║
╚═══════════════════════════════════════════════════════════════╝
    `)

    console.log('| Endpoint | Requests | Success Rate | Avg (ms) | P95 (ms) | Throughput |')
    console.log('|----------|----------|--------------|----------|----------|-----------|')

    this.results.forEach(r => {
      const successRate = ((r.successfulRequests / r.totalRequests) * 100).toFixed(1)
      console.log(
        `| ${r.endpoint.padEnd(20)} | ${r.totalRequests.toString().padEnd(8)} | ${successRate.padEnd(12)}% | ${r.avgResponseTime
          .toString()
          .padEnd(8)} | ${r.p95ResponseTime.toString().padEnd(8)} | ${r.throughput.toString().padEnd(9)} |`
      )
    })

    const totalRequests = this.results.reduce((sum, r) => sum + r.totalRequests, 0)
    const totalSuccessful = this.results.reduce((sum, r) => sum + r.successfulRequests, 0)
    const avgResponseTime =
      this.results.reduce((sum, r) => sum + r.avgResponseTime * r.totalRequests, 0) / totalRequests

    console.log(`
📈 Overall Statistics:
   • Total Requests: ${totalRequests}
   • Overall Success Rate: ${((totalSuccessful / totalRequests) * 100).toFixed(2)}%
   • Average Response Time: ${Math.round(avgResponseTime)}ms
   • Total Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s

🎯 Performance Targets:
   • Response Time < 100ms: ${avgResponseTime < 100 ? '✅ PASS' : '❌ FAIL'}
   • Success Rate > 99%: ${(totalSuccessful / totalRequests) * 100 > 99 ? '✅ PASS' : '❌ FAIL'}
   • Error Rate < 1%: ${((totalRequests - totalSuccessful) / totalRequests) * 100 < 1 ? '✅ PASS' : '❌ FAIL'}
    `)
  }
}

// Run tests
async function runPerformanceTests() {
  const tester = new PerformanceTester()

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║       Risk Management API - Performance Test Suite            ║
╚═══════════════════════════════════════════════════════════════╝

Configuration:
   • API URL: ${API_BASE_URL}
   • Concurrent Requests: ${CONCURRENT_REQUESTS}
   • Test Duration: ${DURATION_SECONDS}s
  `)

  try {
    // Test health endpoint
    await tester.testEndpoint('health', 'GET', undefined, 10)

    // Test dashboard endpoints
    await tester.testEndpoint('dashboard/summary', 'GET', undefined, 20)
    await tester.testEndpoint('dashboard/risk-trend', 'GET', undefined, 20)
    await tester.testEndpoint('dashboard/risk-distribution', 'GET', undefined, 20)

    // Test data endpoints
    await tester.testEndpoint('per_trn_identify_risk', 'GET', undefined, 20)
    await tester.testEndpoint('risk-assessments', 'GET', undefined, 20)

    // Print summary
    tester.printSummary()
  } catch (error) {
    console.error('❌ Performance test failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  runPerformanceTests().catch(console.error)
}

export { PerformanceTester }
