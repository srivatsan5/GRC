/**
 * Typed client for the Pericope API. Types are generated from api/openapi.json
 * (`npm run api:types`), so a change in the API shows up here as a type error.
 */
import axios, { AxiosError } from 'axios'
import type { components } from './api-types'

export type ApiUser = components['schemas']['User']
export type ApiRole = components['schemas']['Role']
export type ApiSession = components['schemas']['Session']
export type ApiAuditEntry = components['schemas']['AuditEntry']

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '')

/** Shared axios instance: sends the session cookie and the CSRF header on every call. */
export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
})

export const UNAUTHORIZED_EVENT = 'pericope:unauthorized'

http.interceptors.response.use(
  res => res,
  (error: AxiosError) => {
    // Give every caller the API's readable message (existing code shows err.message in toasts).
    if (error.response?.data) error.message = apiErrorMessage(error, error.message)
    const url = error.config?.url ?? ''
    // A 401 anywhere except the sign-in/session probes means the session ended.
    if (error.response?.status === 401 && typeof window !== 'undefined' && !/api\/auth\/(login|me)$/.test(url)) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    return Promise.reject(error)
  },
)

/** Human-readable message from any API error. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const err = error as AxiosError<{ error?: { message?: string; details?: { field: string; message: string }[] } }>
  const body = err?.response?.data?.error
  if (body?.details?.length) {
    return `${body.message ?? 'Invalid input'}: ${body.details.map(d => `${d.field.toLowerCase()} ${d.message}`).join('; ')}`
  }
  if (body?.message) return body.message
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond'
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the Pericope API'
  return fallback
}

export const authApi = {
  login: (email: string, password: string) => http.post<ApiSession>('/api/auth/login', { email, password }).then(r => r.data),
  /** allDevices=false ends only this browser's session (used by the idle timeout). */
  logout: (allDevices = true) => http.post('/api/auth/logout', { allDevices }).then(() => undefined),
  me: () => http.get<ApiSession>('/api/auth/me').then(r => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    http.post<ApiSession>('/api/auth/change-password', { currentPassword, newPassword }).then(r => r.data),
}

export const usersApi = {
  list: () => http.get<{ items: ApiUser[] }>('/api/users').then(r => r.data.items),
  create: (input: { email: string; name: string; role: ApiRole; department?: string; password: string }) =>
    http.post<ApiUser>('/api/users', input).then(r => r.data),
  update: (id: string, patch: Partial<Pick<ApiUser, 'name' | 'role' | 'department' | 'active'>>) =>
    http.patch<ApiUser>(`/api/users/${encodeURIComponent(id)}`, patch).then(r => r.data),
  resetPassword: (id: string, password: string) =>
    http.post(`/api/users/${encodeURIComponent(id)}/reset-password`, { password }).then(() => undefined),
}

export interface AuditQuery {
  limit?: number
  offset?: number
  action?: string
  actor?: string
  entity?: string
  from?: string
  to?: string
  search?: string
}

export const auditApi = {
  list: (q: AuditQuery = {}) => http.get<{ items: ApiAuditEntry[]; total: number }>('/api/audit', { params: q }).then(r => r.data),
  verify: () => http.get<{ valid: boolean; entries: number; brokenAt?: number; reason?: string }>('/api/audit/verify').then(r => r.data),
  record: (e: { action: string; entity: string; entity_id?: string | number | null; description: string; result?: 'SUCCESS' | 'FAILURE' }) =>
    http.post<ApiAuditEntry>('/api/audit', e).then(r => r.data),
}

export type ApiWorkflowItem = components['schemas']['WorkflowItem']
export type ApiWorkflowStep = components['schemas']['WorkflowStep']
export type ApiOrgSettings = components['schemas']['OrgSettings']
export type ApiRowPage = components['schemas']['RowPage']

export const workflowApi = {
  list: (q: { status?: string; mine?: 'submitted' | 'to-decide' } = {}) =>
    http.get<{ items: ApiWorkflowItem[]; total: number }>('/api/workflow', { params: q }).then(r => r.data),
  submit: (input: {
    title: string
    request_type: ApiWorkflowItem['request_type']
    business_unit?: string
    amount?: number
    details?: string
    approver_roles: ('Risk Manager' | 'Administrator')[]
  }) => http.post<ApiWorkflowItem>('/api/workflow', input).then(r => r.data),
  decide: (id: number, decision: 'Approved' | 'Rejected', comment?: string) =>
    http.post<ApiWorkflowItem>(`/api/workflow/${id}/decision`, { decision, comment }).then(r => r.data),
  withdraw: (id: number) => http.post<ApiWorkflowItem>(`/api/workflow/${id}/withdraw`).then(r => r.data),
}

export const settingsApi = {
  get: () => http.get<{ settings: ApiOrgSettings; stored: boolean; reason?: string }>('/api/settings').then(r => r.data),
  save: (settings: ApiOrgSettings) => http.put<{ settings: ApiOrgSettings; stored: boolean }>('/api/settings', settings).then(r => r.data),
}

/** Error code from an API error response (e.g. 'NOT_PROVISIONED', 'FORBIDDEN'). */
export function apiErrorCode(error: unknown): string | null {
  return (error as AxiosError<{ error?: { code?: string } }>)?.response?.data?.error?.code ?? null
}
