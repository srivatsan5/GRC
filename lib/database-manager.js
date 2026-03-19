/**
 * Database Connection Management and Query Optimization
 * Implements connection pooling, caching, and query optimization strategies
 */

const axios = require('axios')

/**
 * Connection Pool for managing Oracle ORDS connections
 * Reduces overhead of creating new connections for each request
 */
class ConnectionPool {
  constructor(maxConnections = 100, maxWaitTime = 30000) {
    this.maxConnections = maxConnections
    this.maxWaitTime = maxWaitTime
    this.availableConnections = []
    this.inUseConnections = new Set()
    this.waitingRequests = []
  }

  async getConnection() {
    // Return available connection if exists
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.pop()
      this.inUseConnections.add(connection)
      return connection
    }

    // Create new connection if under limit
    if (this.inUseConnections.size < this.maxConnections) {
      const connection = { id: Math.random(), createdAt: Date.now() }
      this.inUseConnections.add(connection)
      return connection
    }

    // Wait for connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'))
      }, this.maxWaitTime)

      this.waitingRequests.push({ resolve, reject, timeout })
    })
  }

  releaseConnection(connection) {
    this.inUseConnections.delete(connection)

    // Serve waiting request if any
    if (this.waitingRequests.length > 0) {
      const { resolve, reject, timeout } = this.waitingRequests.shift()
      clearTimeout(timeout)

      this.inUseConnections.add(connection)
      resolve(connection)
    } else {
      this.availableConnections.push(connection)
    }
  }

  getStats() {
    return {
      availableConnections: this.availableConnections.length,
      inUseConnections: this.inUseConnections.size,
      waitingRequests: this.waitingRequests.length,
      utilization: (this.inUseConnections.size / this.maxConnections) * 100,
    }
  }

  close() {
    this.waitingRequests.forEach(({ timeout }) => clearTimeout(timeout))
    this.availableConnections = []
    this.inUseConnections.clear()
    this.waitingRequests = []
  }
}

/**
 * Query Result Cache with TTL (Time To Live)
 * Stores frequently accessed query results
 */
class QueryCache {
  constructor(maxSize = 1000, defaultTTL = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
    this.cache = new Map()
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    }
  }

  /**
   * Get cached query result
   */
  get(key) {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return entry.data
  }

  /**
   * Cache query result
   */
  set(key, data, ttl = this.defaultTTL) {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
      this.stats.evictions++
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Invalidate specific cache entries
   */
  invalidate(pattern) {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: hitRate.toFixed(2) + '%',
    }
  }
}

/**
 * Database query optimizer with automatic performance tracking
 */
class QueryOptimizer {
  constructor() {
    this.queryMetrics = new Map()
    this.slowQueryThreshold = 1000 // 1 second
  }

  /**
   * Track query performance
   */
  trackQuery(query, executionTime, success = true) {
    if (!this.queryMetrics.has(query)) {
      this.queryMetrics.set(query, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
      })
    }

    const metrics = this.queryMetrics.get(query)
    metrics.count++
    metrics.totalTime += executionTime

    if (executionTime < metrics.minTime) metrics.minTime = executionTime
    if (executionTime > metrics.maxTime) metrics.maxTime = executionTime
    if (!success) metrics.errors++

    // Log slow queries for optimization
    if (executionTime > this.slowQueryThreshold) {
      console.warn(`[SLOW QUERY] ${query.substring(0, 100)}... took ${executionTime}ms`)
    }
  }

  /**
   * Get performance analysis for all tracked queries
   */
  getAnalysis() {
    const analysis = {
      totalQueries: this.queryMetrics.size,
      totalExecutions: 0,
      averageTime: 0,
      slowestQueries: [],
    }

    let totalTime = 0

    this.queryMetrics.forEach((metrics, query) => {
      analysis.totalExecutions += metrics.count
      totalTime += metrics.totalTime

      if (metrics.maxTime > this.slowQueryThreshold) {
        analysis.slowestQueries.push({
          query: query.substring(0, 150),
          avgTime: Math.round(metrics.totalTime / metrics.count),
          maxTime: metrics.maxTime,
          executions: metrics.count,
          errors: metrics.errors,
        })
      }
    })

    analysis.averageTime = Math.round(totalTime / analysis.totalExecutions)
    analysis.slowestQueries.sort((a, b) => b.avgTime - a.avgTime)
    analysis.slowestQueries = analysis.slowestQueries.slice(0, 10)

    return analysis
  }

  /**
   * Reset metrics
   */
  reset() {
    this.queryMetrics.clear()
  }
}

/**
 * Database Manager - Coordinates connection pooling, caching, and optimization
 */
class DatabaseManager {
  constructor(ordsBaseUrl, maxConnections = 100) {
    this.ordsBaseUrl = ordsBaseUrl
    this.connectionPool = new ConnectionPool(maxConnections)
    this.queryCache = new QueryCache()
    this.queryOptimizer = new QueryOptimizer()
  }

  /**
   * Execute query with caching and optimization tracking
   */
  async executeQuery(endpoint, method = 'GET', data = null, options = {}) {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(data || {})}`

    // Check cache first for GET requests
    if (method === 'GET' && !options.skipCache) {
      const cached = this.queryCache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    const connection = await this.connectionPool.getConnection()
    const startTime = Date.now()

    try {
      let response

      if (method === 'GET') {
        response = await axios.get(`${this.ordsBaseUrl}${endpoint}`, {
          params: data,
          timeout: 30000,
        })
      } else if (method === 'POST') {
        response = await axios.post(`${this.ordsBaseUrl}${endpoint}`, data, {
          timeout: 30000,
        })
      } else if (method === 'PUT') {
        response = await axios.put(`${this.ordsBaseUrl}${endpoint}`, data, {
          timeout: 30000,
        })
      } else if (method === 'DELETE') {
        response = await axios.delete(`${this.ordsBaseUrl}${endpoint}`, {
          timeout: 30000,
        })
      }

      const executionTime = Date.now() - startTime
      this.queryOptimizer.trackQuery(endpoint, executionTime, true)

      // Cache successful GET responses
      if (method === 'GET' && !options.skipCache) {
        this.queryCache.set(cacheKey, response.data, options.cacheTTL || 5 * 60 * 1000)
      }

      return response.data
    } catch (error) {
      const executionTime = Date.now() - startTime
      this.queryOptimizer.trackQuery(endpoint, executionTime, false)
      throw error
    } finally {
      this.connectionPool.releaseConnection(connection)
    }
  }

  /**
   * Get system health information
   */
  getHealthInfo() {
    return {
      connectionPool: this.connectionPool.getStats(),
      queryCache: this.queryCache.getStats(),
      queryPerformance: this.queryOptimizer.getAnalysis(),
    }
  }

  /**
   * Invalidate cache for specific endpoint
   */
  invalidateCache(pattern) {
    return this.queryCache.invalidate(pattern)
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.queryCache.clear()
  }

  /**
   * Close database connections
   */
  close() {
    this.connectionPool.close()
    this.queryCache.clear()
  }
}

module.exports = {
  ConnectionPool,
  QueryCache,
  QueryOptimizer,
  DatabaseManager,
}
