import axios, { AxiosError } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
})

/**
 * Cache management for GET requests
 */
class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTTL = 5 * 60 * 1000 // 5 minutes default

  set(key: string, data: any, ttl?: number) {
    this.cache.set(key, { data, timestamp: Date.now() })
    if (ttl) {
      setTimeout(() => this.cache.delete(key), ttl)
    }
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    const age = Date.now() - entry.timestamp
    if (age > this.cacheTTL) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  clear() {
    this.cache.clear()
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }
}

/**
 * Request queue for managing concurrent requests
 */
class RequestQueue {
  private queue: Array<() => Promise<any>> = []
  private activeRequests = 0
  private maxConcurrent = 10

  async enqueue(request: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.process()
    })
  }

  private async process() {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) return

    this.activeRequests++
    const request = this.queue.shift()

    try {
      await request?.()
    } finally {
      this.activeRequests--
      this.process()
    }
  }
}

/**
 * Retry logic with exponential backoff
 */
const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxAttempts = 3,
  initialDelayMs = 500,
  backoffFactor = 2
): Promise<any> => {
  let lastError: any
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // Don't retry on 4xx errors (client errors)
      if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
        throw error
      }
      
      if (attempt < maxAttempts) {
        const delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * Normalizes ORDS response items.
 */
const normalizeItems = (data: any) => {
  if (!data) return []
  // The new backend returns data.items or the array directly
  const items = Array.isArray(data) ? data : (data?.items || (typeof data === 'object' ? [data] : []))
  return items.map((item: any) => {
    if (!item || typeof item !== 'object') return item
    const normalized: any = {}
    Object.keys(item).forEach(key => {
      normalized[key.toLowerCase()] = item[key]
    })
    return normalized
  })
}

/**
 * Error handler for API errors
 * Suppresses expected errors: 404s and network errors for DELETE/PUT operations
 */
const handleApiError = (error: any, endpoint: string) => {
  const errorData: any = {
    endpoint,
    timestamp: new Date().toISOString(),
    message: 'API request failed',
  }

  const isDeleteOrUpdate = endpoint.includes('DELETE') || endpoint.includes('PUT')
  const isNetworkError = error.code === 'ERR_NETWORK' || (error.response && error.response.status === 0)
  const is404 = error.response?.status === 404

  if (error.response) {
    errorData.status = error.response.status
    errorData.statusText = error.response.statusText
    errorData.data = error.response.data
    
    // Suppress 404s and network errors for DELETE/PUT (these are expected)
    if (is404 || (isNetworkError && isDeleteOrUpdate)) {
      // Silently suppress these expected errors
      return errorData
    }
    
    // Log real errors (5xx, 4xx except 404, etc.)
    console.error(`[OracleService Error] ${endpoint}:`, errorData)
  } else if (error.request) {
    errorData.message = 'No response from server'
    errorData.code = error.code
    
    // Suppress network errors for DELETE/PUT operations
    if (isNetworkError && isDeleteOrUpdate) {
      return errorData
    }
    
    console.warn(`[OracleService Warning] ${endpoint}: No response from server`)
  } else {
    errorData.message = error.message
    
    // Only warn about unexpected errors
    if (!isDeleteOrUpdate) {
      console.warn(`[OracleService Warning] ${endpoint}:`, errorData)
    }
  }

  return errorData
}

const requestCache = new RequestCache()
const requestQueue = new RequestQueue()

export const oracleService = {
  // Generic Fetcher for React Query with retry and caching
  fetch: async (resource: string, params = {}, options: any = {}) => {
    const cacheKey = `${resource}?${JSON.stringify(params)}`
    
    // Check cache first for GET requests
    if (!options.skipCache) {
      const cached = requestCache.get(cacheKey)
      if (cached !== null) {
        return cached
      }
    }

    try {
      const result = await retryWithBackoff(async () => {
        const res = await api.get(resource, { params })
        return res.data
      }, options.maxRetries || 3)

      const normalized = normalizeItems(result)
      
      // Cache successful GET responses
      if (!options.skipCache) {
        requestCache.set(cacheKey, normalized, options.cacheTTL)
      }

      return normalized
    } catch (error: any) {
      handleApiError(error, resource)
      // Return empty array to prevent UI errors
      return []
    }
  },

  // Dashboard APIs
  // Note: These endpoints return cached empty arrays if the database views don't exist
  getDashboardSummary: async () => {
    try {
      return await oracleService.fetch('dashboard/summary', {}, { cacheTTL: 2 * 60 * 1000 })
    } catch {
      return { summary: 'Not available', data: [] }
    }
  },
  getRiskTrend: async () => {
    try {
      return await oracleService.fetch('dashboard/risk-trend', {}, { cacheTTL: 2 * 60 * 1000 })
    } catch {
      return []
    }
  },
  getRiskDistribution: async () => {
    try {
      return await oracleService.fetch('dashboard/risk-distribution', {}, { cacheTTL: 2 * 60 * 1000 })
    } catch {
      return []
    }
  },
  getRiskByCategory: async () => {
    try {
      return await oracleService.fetch('dashboard/risk-by-category', {}, { cacheTTL: 2 * 60 * 1000 })
    } catch {
      return []
    }
  },
  getRiskByProcess: async () => {
    try {
      return await oracleService.fetch('dashboard/risk-by-process', {}, { cacheTTL: 2 * 60 * 1000 })
    } catch {
      return []
    }
  },
  getControlEffectiveness: async () => {
    try {
      return await oracleService.fetch('dashboard/control-effectiveness', {}, { cacheTTL: 2 * 60 * 1000 })
    } catch {
      return []
    }
  },
  getMonitoringStatus: async () => {
    try {
      return await oracleService.fetch('dashboard/monitoring-status', {}, { cacheTTL: 2 * 60 * 1000 })
    } catch {
      return []
    }
  },

  // Transactional APIs (CRUD)
  // Identify Risk
  getIdentifyRisks: (params = {}) => {
    return oracleService.fetch('per_trn_identify_risk', params)
  },
  createIdentifyRisk: async (data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.post('per_trn_identify_risk', data)
        // Invalidate cache after mutation
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, 'POST per_trn_identify_risk')
      throw error
    }
  },
  updateIdentifyRisk: async (id: string | number, data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.put(`per_trn_identify_risk/${id}`, data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `PUT per_trn_identify_risk/${id}`)
      throw error
    }
  },
  deleteIdentifyRisk: async (id: string | number) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.delete(`per_trn_identify_risk/${id}`)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `DELETE per_trn_identify_risk/${id}`)
      throw error
    }
  },

  // Control Implementation
  getControlImplementations: () => oracleService.fetch('per_trn_control_implementation'),
  createControlImplementation: async (data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.post('per_trn_control_implementation', data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, 'POST per_trn_control_implementation')
      throw error
    }
  },
  updateControlImplementation: async (id: string | number, data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.put(`per_trn_control_implementation/${id}`, data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `PUT per_trn_control_implementation/${id}`)
      throw error
    }
  },
  deleteControlImplementation: async (id: string | number) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.delete(`per_trn_control_implementation/${id}`)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `DELETE per_trn_control_implementation/${id}`)
      throw error
    }
  },

  // Inherent/Residual Assessments
  getRiskAssessments: () => oracleService.fetch('risk-assessments'),
  createRiskAssessment: async (data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.post('risk-assessments', data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, 'POST risk-assessments')
      throw error
    }
  },
  updateRiskAssessment: async (id: string | number, data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.put(`risk-assessments/${id}`, data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `PUT risk-assessments/${id}`)
      throw error
    }
  },
  deleteRiskAssessment: async (id: string | number) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.delete(`risk-assessments/${id}`)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `DELETE risk-assessments/${id}`)
      throw error
    }
  },

  // Mitigation Plans
  getMitigationPlans: () => oracleService.fetch('mitigation-plans'),
  createMitigationPlan: async (data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.post('mitigation-plans', data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, 'POST mitigation-plans')
      throw error
    }
  },
  updateMitigationPlan: async (id: string | number, data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.put(`mitigation-plans/${id}`, data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `PUT mitigation-plans/${id}`)
      throw error
    }
  },
  deleteMitigationPlan: async (id: string | number) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.delete(`mitigation-plans/${id}`)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `DELETE mitigation-plans/${id}`)
      throw error
    }
  },

  // Risk Monitoring
  getRiskMonitoring: () => oracleService.fetch('per_trn_risk_monitoring'),
  createRiskMonitoring: async (data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.post('per_trn_risk_monitoring', data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, 'POST per_trn_risk_monitoring')
      throw error
    }
  },
  updateRiskMonitoring: async (id: string | number, data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.put(`per_trn_risk_monitoring/${id}`, data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `PUT per_trn_risk_monitoring/${id}`)
      throw error
    }
  },
  deleteRiskMonitoring: async (id: string | number) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.delete(`per_trn_risk_monitoring/${id}`)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `DELETE per_trn_risk_monitoring/${id}`)
      throw error
    }
  },

  // Master Table APIs (with longer cache since they change infrequently)
  getBusinessProcesses: () => oracleService.fetch('per_mst_business_process', {}, { cacheTTL: 10 * 60 * 1000 }),
  getControlFrequencies: () => oracleService.fetch('control-frequency', {}, { cacheTTL: 10 * 60 * 1000 }),
  getControlTypes: () => oracleService.fetch('per_mst_control_type', {}, { cacheTTL: 10 * 60 * 1000 }),
  getImpactLevels: () => oracleService.fetch('impact', {}, { cacheTTL: 10 * 60 * 1000 }),
  getLikelihoodLevels: () => oracleService.fetch('likelihood', {}, { cacheTTL: 10 * 60 * 1000 }),
  getRiskCategories: () => oracleService.fetch('per_mst_risk_category', {}, { cacheTTL: 10 * 60 * 1000 }),
  getRiskSubcategories: () => oracleService.fetch('risk-subcategories', {}, { cacheTTL: 10 * 60 * 1000 }),

  // KRI (Key Risk Indicator) APIs (with moderate cache)
  getKriMatrix: () => oracleService.fetch('kri-matrix', {}, { cacheTTL: 5 * 60 * 1000 }),
  getKriConfiguration: () => oracleService.fetch('kri-configuration', {}, { cacheTTL: 5 * 60 * 1000 }),

  // Assessment APIs (Appetite, Access, Controls, Residual)
  getAppetiteFramework: () => oracleService.fetch('appetite/framework', {}, { cacheTTL: 10 * 60 * 1000 }),
  getAppetiteRiskAppetite: () => oracleService.fetch('appetite/risk-appetite', {}, { cacheTTL: 10 * 60 * 1000 }),
  getAssessmentsAccess: () => oracleService.fetch('assessments/access', {}, { cacheTTL: 5 * 60 * 1000 }),
  getAssessmentsControls: () => oracleService.fetch('assessments/controls', {}, { cacheTTL: 5 * 60 * 1000 }),
  updateControlAssessment: async (id: string | number, data: any) => {
    try {
      return await retryWithBackoff(async () => {
        const res = await api.put(`assessments/controls/${id}`, data)
        requestCache.clear()
        return res.data
      }, 3)
    } catch (error: any) {
      handleApiError(error, `PUT assessments/controls/${id}`)
      throw error
    }
  },
  getAssessmentsResidual: () => oracleService.fetch('assessments/residual', {}, { cacheTTL: 5 * 60 * 1000 }),

  // Asset Management and Audit APIs
  getAssets: () => oracleService.fetch('assets', {}, { cacheTTL: 10 * 60 * 1000 }),
  getAuditTrail: (params = {}) => oracleService.fetch('audit-trail', params),

  // Monitoring Action Plans
  getMonitoringActionPlan: () => oracleService.fetch('monitoring/action-plan', {}, { cacheTTL: 5 * 60 * 1000 }),
  getMonitoringActionsHierarchy: () => oracleService.fetch('monitoring/actions-hierarchy', {}, { cacheTTL: 5 * 60 * 1000 }),

  // Reports API
  getReports: (params = {}) => oracleService.fetch('reports', params),

  // Utility functions
  clearCache: () => requestCache.clear(),
  getCacheStats: () => ({
    timestamp: new Date().toISOString(),
    message: 'Cache cleared. Next requests will be fresh from server.',
  }),

  // Compatibility Helpers
  getRiskAssessmentsList: () => oracleService.getIdentifyRisks(),
  getRiskPlanningIdentify: () => oracleService.getIdentifyRisks(),
  getMonitoringRiskMonitoring: () => oracleService.getRiskMonitoring(),
  getRiskAssessmentsDashboard: () => oracleService.getIdentifyRisks(),
}
