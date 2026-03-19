import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

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

export const oracleService = {
  // Generic Fetcher for React Query
  fetch: async (resource: string, params = {}) => {
    try {
      const res = await api.get(resource, { params })
      return normalizeItems(res.data)
    } catch (error: any) {
      // Silently return empty array instead of throwing - prevents console errors
      return []
    }
  },

  // Dashboard APIs
  getDashboardSummary: () => oracleService.fetch('dashboard/summary'),
  getRiskTrend: () => oracleService.fetch('dashboard/risk-trend'),
  getRiskDistribution: () => oracleService.fetch('dashboard/risk-distribution'),
  getRiskByCategory: () => oracleService.fetch('dashboard/risk-by-category'),
  getRiskByProcess: () => oracleService.fetch('dashboard/risk-by-process'),
  getControlEffectiveness: () => oracleService.fetch('dashboard/control-effectiveness'),
  getMonitoringStatus: () => oracleService.fetch('dashboard/monitoring-status'),

  // Transactional APIs (CRUD)
  // Identify Risk
  getIdentifyRisks: (params = {}) => {
    return oracleService.fetch('per_trn_identify_risk', params)
  },
  createIdentifyRisk: (data: any) => api.post('per_trn_identify_risk', data).then(r => r.data),
  updateIdentifyRisk: (id: string | number, data: any) => api.put(`per_trn_identify_risk/${id}`, data).then(r => r.data),
  deleteIdentifyRisk: (id: string | number) => api.delete(`per_trn_identify_risk/${id}`).then(r => r.data),

  // Control Implementation
  getControlImplementations: () => oracleService.fetch('per_trn_control_implementation'),
  createControlImplementation: (data: any) => api.post('per_trn_control_implementation', data).then(r => r.data),
  updateControlImplementation: (id: string | number, data: any) => api.put(`per_trn_control_implementation/${id}`, data).then(r => r.data),
  deleteControlImplementation: (id: string | number) => api.delete(`per_trn_control_implementation/${id}`).then(r => r.data),

  // Inherent/Residual Assessments
  getRiskAssessments: () => oracleService.fetch('risk-assessments'),
  createRiskAssessment: (data: any) => api.post('risk-assessments', data).then(r => r.data),
  updateRiskAssessment: (id: string | number, data: any) => api.put(`risk-assessments/${id}`, data).then(r => r.data),
  deleteRiskAssessment: (id: string | number) => api.delete(`risk-assessments/${id}`).then(r => r.data),

  // Mitigation Plans
  getMitigationPlans: () => oracleService.fetch('mitigation-plans'),
  createMitigationPlan: (data: any) => api.post('mitigation-plans', data).then(r => r.data),
  updateMitigationPlan: (id: string | number, data: any) => api.put(`mitigation-plans/${id}`, data).then(r => r.data),
  deleteMitigationPlan: (id: string | number) => api.delete(`mitigation-plans/${id}`).then(r => r.data),

  // Risk Monitoring
  getRiskMonitoring: () => oracleService.fetch('per_trn_risk_monitoring'),
  createRiskMonitoring: (data: any) => api.post('per_trn_risk_monitoring', data).then(r => r.data),
  updateRiskMonitoring: (id: string | number, data: any) => api.put(`per_trn_risk_monitoring/${id}`, data).then(r => r.data),
  deleteRiskMonitoring: (id: string | number) => api.delete(`per_trn_risk_monitoring/${id}`).then(r => r.data),

  // Master Table APIs
  getBusinessProcesses: () => oracleService.fetch('per_mst_business_process'),
  getControlFrequencies: () => oracleService.fetch('control-frequency'),
  getControlTypes: () => oracleService.fetch('per_mst_control_type'),
  getImpactLevels: () => oracleService.fetch('impact'),
  getLikelihoodLevels: () => oracleService.fetch('likelihood'),
  getRiskCategories: () => oracleService.fetch('per_mst_risk_category'),
  getRiskSubcategories: () => oracleService.fetch('risk-subcategories'),

  // KRI (Key Risk Indicator) APIs
  getKriMatrix: () => oracleService.fetch('kri-matrix'),
  getKriConfiguration: () => oracleService.fetch('kri-configuration'),

  // Compatibility Helpers
  getRiskAssessmentsList: () => oracleService.getIdentifyRisks(),
  getRiskPlanningIdentify: () => oracleService.getIdentifyRisks(),
  getMonitoringRiskMonitoring: () => oracleService.getRiskMonitoring(),
  getRiskAssessmentsDashboard: () => oracleService.getIdentifyRisks(),
}
