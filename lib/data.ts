/**
 * React Query hooks for database tables exposed by the API.
 *
 *   const risks = useRows('per_trn_identify_risk')                       // all rows (charts, totals)
 *   const page  = useRowPage('per_trn_identify_risk', { page, pageSize: 25, search, sort: 'created_on', order: 'desc' })
 *   const create = useCreateRow('erm_mst_vendor')                         // create.mutateAsync({...})
 *
 * There is one cache (React Query). Every hook for a table shares the key prefix
 * ['table', <name>], and every mutation invalidates it (plus any `alsoInvalidate`
 * tables), so all pages showing that table refresh together. Errors are thrown,
 * never replaced with empty data; render them with <DataState>.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { http } from './apiClient'

export type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface PageParams {
  page?: number
  pageSize?: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  filter?: Record<string, string | number | boolean | null | (string | number | boolean | null)[]>
}

export interface RowPage<T = Row> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  truncated: boolean
}

export const tableKey = (table: string) => ['table', table] as const

function lowerKeys(row: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = v
  return out
}

function pageParams(p: PageParams) {
  return {
    page: p.page ?? 1,
    pageSize: p.pageSize ?? 50,
    sort: p.sort,
    order: p.order,
    search: p.search?.trim() || undefined,
    filter: p.filter && Object.keys(p.filter).length ? JSON.stringify(p.filter) : undefined,
  }
}

/** Every row of a table (up to the API cap), optionally filtered. For totals, charts and lookups. */
export async function fetchAllRows(table: string, filter?: PageParams['filter']): Promise<Row[]> {
  const { data } = await http.get<RowPage>(`/api/${table}`, {
    params: { all: 1, filter: filter && Object.keys(filter).length ? JSON.stringify(filter) : undefined },
  })
  if (data.truncated) {
    console.warn(`[data] ${table}: more rows than the API listing cap; totals cover the first ${data.items.length}`)
  }
  return data.items.map(lowerKeys)
}

export function useRows<T = Row>(
  table: string,
  opts: { filter?: PageParams['filter']; enabled?: boolean; select?: (rows: Row[]) => T[] } = {},
) {
  return useQuery({
    queryKey: [...tableKey(table), 'all', opts.filter ?? null],
    queryFn: () => fetchAllRows(table, opts.filter),
    enabled: opts.enabled,
    select: opts.select as UseQueryOptions<Row[], Error, T[]>['select'],
  })
}

/** One page of a table, with server-side search / sort / filter and a real total. */
export function useRowPage(table: string, params: PageParams, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...tableKey(table), 'page', params],
    queryFn: async () => {
      const { data } = await http.get<RowPage>(`/api/${table}`, { params: pageParams(params) })
      return { ...data, items: data.items.map(lowerKeys) }
    },
    placeholderData: prev => prev, // keep the previous page visible while the next one loads
    enabled: opts.enabled,
  })
}

export function useRow(table: string, id: number | string | null | undefined) {
  return useQuery({
    queryKey: [...tableKey(table), 'one', String(id)],
    queryFn: async () => lowerKeys((await http.get<Row>(`/api/${table}/${encodeURIComponent(String(id))}`)).data),
    enabled: id !== null && id !== undefined && id !== '',
  })
}

function useInvalidate(table: string, also: string[] = []) {
  const qc = useQueryClient()
  return () => Promise.all([table, ...also].map(t => qc.invalidateQueries({ queryKey: tableKey(t) })))
}

export function useCreateRow(table: string, opts: { alsoInvalidate?: string[] } = {}) {
  const invalidate = useInvalidate(table, opts.alsoInvalidate)
  return useMutation({
    mutationFn: async (values: Row) => lowerKeys((await http.post<Row>(`/api/${table}`, values)).data),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateRow(table: string, opts: { alsoInvalidate?: string[] } = {}) {
  const invalidate = useInvalidate(table, opts.alsoInvalidate)
  return useMutation({
    mutationFn: async ({ id, values }: { id: number | string; values: Row }) =>
      lowerKeys((await http.patch<Row>(`/api/${table}/${encodeURIComponent(String(id))}`, values)).data),
    onSuccess: () => invalidate(),
  })
}

export function useDeleteRow(table: string, opts: { alsoInvalidate?: string[] } = {}) {
  const invalidate = useInvalidate(table, opts.alsoInvalidate)
  return useMutation({
    mutationFn: async (id: number | string) => {
      await http.delete(`/api/${table}/${encodeURIComponent(String(id))}`)
    },
    onSuccess: () => invalidate(),
  })
}
