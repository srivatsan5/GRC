/**
 * Minimal Oracle ORDS AutoREST client.
 *
 * - OAuth2 client-credentials token, cached until shortly before expiry.
 * - A failed token request is retried on later calls (after a short cooldown);
 *   it never silently falls back to anonymous access.
 * - Every failure becomes an OrdsError; callers decide how to report it.
 *   Nothing here fabricates success.
 */

export type OrdsErrorKind = 'not_configured' | 'auth_failed' | 'timeout' | 'unreachable' | 'rejected' | 'not_found' | 'server_error'

export class OrdsError extends Error {
  constructor(
    public readonly kind: OrdsErrorKind,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message)
  }
}

export interface OrdsRow {
  [column: string]: unknown
}

export interface OrdsListResult {
  items: OrdsRow[]
  hasMore: boolean
  limit?: number
  offset?: number
}

export interface OrdsClientOptions {
  baseUrl?: string
  tokenUrl?: string
  clientId?: string
  clientSecret?: string
  allowAnonymous: boolean
  timeoutMs: number
  fetchImpl?: typeof fetch
}

const TOKEN_RETRY_COOLDOWN_MS = 5_000

export class OrdsClient {
  private token: string | null = null
  private tokenExpiresAt = 0
  private lastTokenFailureAt = 0
  private readonly fetchImpl: typeof fetch

  constructor(private readonly opts: OrdsClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  get configured(): boolean {
    return Boolean(this.opts.baseUrl && (this.hasCredentials || this.opts.allowAnonymous))
  }

  get authMode(): 'oauth2' | 'anonymous' | 'unconfigured' {
    if (!this.configured) return 'unconfigured'
    return this.hasCredentials ? 'oauth2' : 'anonymous'
  }

  private get hasCredentials(): boolean {
    return Boolean(this.opts.clientId && this.opts.clientSecret && this.opts.tokenUrl)
  }

  private async getToken(): Promise<string | null> {
    if (!this.hasCredentials) {
      if (this.opts.allowAnonymous) return null
      throw new OrdsError('not_configured', 'Database credentials are not configured')
    }
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) return this.token
    if (Date.now() - this.lastTokenFailureAt < TOKEN_RETRY_COOLDOWN_MS) {
      throw new OrdsError('auth_failed', 'Database authentication is failing; retrying shortly')
    }
    const basic = Buffer.from(`${this.opts.clientId}:${this.opts.clientSecret}`).toString('base64')
    let res: Response
    try {
      res = await this.fetchImpl(this.opts.tokenUrl!, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      })
    } catch (err) {
      this.lastTokenFailureAt = Date.now()
      throw toNetworkError(err)
    }
    if (!res.ok) {
      this.lastTokenFailureAt = Date.now()
      throw new OrdsError('auth_failed', 'Database rejected the API credentials', res.status)
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!body.access_token) {
      this.lastTokenFailureAt = Date.now()
      throw new OrdsError('auth_failed', 'Database token response was invalid')
    }
    this.token = body.access_token
    this.tokenExpiresAt = Date.now() + (body.expires_in ?? 3600) * 1000
    return this.token
  }

  private invalidateToken() {
    this.token = null
    this.tokenExpiresAt = 0
  }

  private async request(method: string, path: string, body?: unknown, retryOnAuth = true): Promise<unknown> {
    if (!this.opts.baseUrl) throw new OrdsError('not_configured', 'Database URL is not configured')
    const token = await this.getToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`

    let res: Response
    try {
      res = await this.fetchImpl(`${this.opts.baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      })
    } catch (err) {
      throw toNetworkError(err)
    }

    if (res.status === 401 && token && retryOnAuth) {
      this.invalidateToken()
      return this.request(method, path, body, false)
    }
    if (res.status === 404) throw new OrdsError('not_found', 'Record not found', 404)
    if (res.status >= 400 && res.status < 500) {
      throw new OrdsError('rejected', await safeUpstreamMessage(res), res.status)
    }
    if (res.status >= 500) throw new OrdsError('server_error', 'The database returned an error', res.status)
    if (res.status === 204) return null
    const text = await res.text()
    return text ? JSON.parse(text) : null
  }

  async list(table: string, params: { limit: number; offset: number; q?: string }): Promise<OrdsListResult> {
    const qs = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) })
    if (params.q) qs.set('q', params.q)
    const data = (await this.request('GET', `/${table}/?${qs}`)) as { items?: OrdsRow[]; hasMore?: boolean } | null
    return { items: (data?.items ?? []).map(stripLinks), hasMore: Boolean(data?.hasMore), limit: params.limit, offset: params.offset }
  }

  async get(table: string, id: number): Promise<OrdsRow> {
    const data = (await this.request('GET', `/${table}/${id}`)) as OrdsRow
    return stripLinks(data)
  }

  async create(table: string, row: OrdsRow): Promise<OrdsRow> {
    const data = (await this.request('POST', `/${table}/`, row)) as OrdsRow | null
    return stripLinks(data ?? {})
  }

  /**
   * ORDS AutoREST PUT replaces the entire row (omitted columns become NULL),
   * so a partial update is done as read → merge → write.
   */
  async update(table: string, id: number, patch: OrdsRow, writableColumns: readonly string[]): Promise<OrdsRow> {
    const current = await this.get(table, id)
    const merged: OrdsRow = {}
    for (const col of writableColumns) {
      const key = col.toLowerCase()
      if (key in current) merged[col] = current[key]
    }
    Object.assign(merged, patch)
    const data = (await this.request('PUT', `/${table}/${id}`, merged)) as OrdsRow | null
    return stripLinks(data ?? { ...current, ...lowerKeys(patch) })
  }

  async remove(table: string, id: number): Promise<void> {
    await this.request('DELETE', `/${table}/${id}`)
  }

  /** Cheap reachability probe used by /ready. */
  async ping(table: string): Promise<void> {
    await this.request('GET', `/${table}/?limit=1`)
  }
}

function stripLinks(row: OrdsRow): OrdsRow {
  if (!row || typeof row !== 'object') return row
  const { links: _links, ...rest } = row as OrdsRow & { links?: unknown }
  return rest
}

function lowerKeys(row: OrdsRow): OrdsRow {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]))
}

function toNetworkError(err: unknown): OrdsError {
  const name = (err as { name?: string })?.name
  if (name === 'TimeoutError' || name === 'AbortError') return new OrdsError('timeout', 'The database did not respond in time')
  return new OrdsError('unreachable', 'The database could not be reached')
}

/** Pull a short, non-sensitive reason out of an ORDS 4xx body (e.g. "ORA-02291 ..."). */
async function safeUpstreamMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; title?: string }
    const raw = String(body.message ?? body.title ?? '')
    const ora = raw.match(/ORA-\d{5}/)?.[0]
    const hints: Record<string, string> = {
      'ORA-02291': 'A linked record does not exist (foreign key)',
      'ORA-02292': 'This record is still referenced by other records',
      'ORA-00001': 'A record with the same unique value already exists',
      'ORA-01400': 'A required field is missing',
      'ORA-12899': 'A value is too long for its field',
      'ORA-01722': 'A field expected a number',
      'ORA-02290': 'A value is outside the allowed range',
    }
    if (ora) return hints[ora] ?? `The database rejected the change (${ora})`
  } catch {
    /* fall through */
  }
  return 'The database rejected the request'
}
