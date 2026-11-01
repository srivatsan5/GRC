import { TABLES, isWritable, APPROVAL_STATUSES, type ColumnType } from './tables/registry.js'
import { ROLES } from './auth/permissions.js'
import { AUDIT_ACTIONS } from './audit/log.js'

const columnSchema: Record<ColumnType, object> = {
  id: { type: 'integer', minimum: 1 },
  int: { type: 'integer', minimum: 0 },
  number: { type: 'number' },
  percent: { type: 'number', minimum: 0, maximum: 100 },
  flag: { type: 'string', enum: ['Y', 'N'] },
  date: { type: 'string', format: 'date-time' },
  text: { type: 'string', maxLength: 4000 },
  approval: { type: 'string', enum: [...APPROVAL_STATUSES] },
  scalar: { oneOf: [{ type: 'string' }, { type: 'number' }] },
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema: object) => ({ content: { 'application/json': { schema } } })
const errorResponses = {
  '400': { description: 'Validation failed', ...json(ref('Error')) },
  '401': { description: 'Not signed in', ...json(ref('Error')) },
  '403': { description: 'Not allowed for your role', ...json(ref('Error')) },
  '422': { description: 'Rejected by the database', ...json(ref('Error')) },
  '503': { description: 'Database unavailable', ...json(ref('Error')) },
}
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }

/** Build the OpenAPI 3.1 document from the same registry that drives validation. */
export function buildOpenApi(): Record<string, unknown> {
  const schemas: Record<string, object> = {
    Error: {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
        },
      },
    },
    Role: { type: 'string', enum: [...ROLES] },
    User: {
      type: 'object',
      required: ['id', 'email', 'name', 'role', 'department', 'active', 'createdAt', 'updatedAt', 'lastLoginAt'],
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        role: ref('Role'),
        department: { type: 'string' },
        active: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        lastLoginAt: { type: ['string', 'null'], format: 'date-time' },
      },
    },
    Session: {
      type: 'object',
      required: ['user', 'permissions'],
      properties: { user: ref('User'), permissions: { type: 'array', items: { type: 'string' } } },
    },
    AuditEntry: {
      type: 'object',
      required: ['seq', 'id', 'timestamp', 'actor_id', 'actor_name', 'actor_email', 'actor_role', 'action', 'entity', 'entity_id', 'description', 'result', 'source', 'prev_hash', 'hash'],
      properties: {
        seq: { type: 'integer' },
        id: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        actor_id: { type: 'string' },
        actor_name: { type: 'string' },
        actor_email: { type: 'string' },
        actor_role: { type: 'string' },
        action: { type: 'string', enum: [...AUDIT_ACTIONS] },
        entity: { type: 'string' },
        entity_id: { type: ['string', 'null'] },
        description: { type: 'string' },
        result: { type: 'string', enum: ['SUCCESS', 'FAILURE'] },
        source: { type: 'string', enum: ['api', 'ui'] },
        ip: { type: ['string', 'null'] },
        changes: { type: ['object', 'null'] },
        prev_hash: { type: 'string' },
        hash: { type: 'string' },
      },
    },
    Row: { type: 'object', additionalProperties: true, description: 'A database row; keys are lower-case column names.' },
    RowList: {
      type: 'object',
      required: ['items', 'count', 'hasMore', 'limit', 'offset'],
      properties: {
        items: { type: 'array', items: ref('Row') },
        count: { type: 'integer' },
        hasMore: { type: 'boolean' },
        limit: { type: 'integer' },
        offset: { type: 'integer' },
      },
    },
  }

  const paths: Record<string, object> = {
    '/health': { get: { tags: ['System'], summary: 'Liveness probe', security: [], responses: { '200': { description: 'Process is up' } } } },
    '/ready': { get: { tags: ['System'], summary: 'Readiness probe (checks the database)', security: [], responses: { '200': { description: 'Ready' }, '503': { description: 'Database unavailable' } } } },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in; sets an httpOnly session cookie',
        security: [],
        requestBody: json({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } }),
        responses: { '200': { description: 'Signed in', ...json(ref('Session')) }, '401': errorResponses['401'], '423': { description: 'Account locked', ...json(ref('Error')) }, '429': { description: 'Too many attempts' } },
      },
    },
    '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Sign out (invalidates all sessions of this user)', responses: { '204': { description: 'Signed out' } } } },
    '/api/auth/me': { get: { tags: ['Auth'], summary: 'Current session', responses: { '200': { description: 'OK', ...json(ref('Session')) }, '401': errorResponses['401'] } } },
    '/api/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change own password',
        requestBody: json({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 12 } } }),
        responses: { '200': { description: 'Changed', ...json(ref('Session')) }, '400': errorResponses['400'] },
      },
    },
    '/api/users': {
      get: { tags: ['Users'], summary: 'List users (Administrator)', responses: { '200': { description: 'OK', ...json({ type: 'object', required: ['items'], properties: { items: { type: 'array', items: ref('User') } } }) }, '403': errorResponses['403'] } },
      post: {
        tags: ['Users'],
        summary: 'Create user (Administrator)',
        requestBody: json({ type: 'object', required: ['email', 'name', 'role', 'password'], properties: { email: { type: 'string', format: 'email' }, name: { type: 'string' }, role: ref('Role'), department: { type: 'string' }, password: { type: 'string', minLength: 12 } } }),
        responses: { '201': { description: 'Created', ...json(ref('User')) }, '400': errorResponses['400'], '409': { description: 'Email already used', ...json(ref('Error')) } },
      },
    },
    '/api/users/{id}': {
      patch: {
        tags: ['Users'],
        summary: 'Update user (Administrator)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: json({ type: 'object', properties: { name: { type: 'string' }, role: ref('Role'), department: { type: 'string' }, active: { type: 'boolean' } } }),
        responses: { '200': { description: 'Updated', ...json(ref('User')) }, '409': { description: 'Would remove the last admin, or self-demotion', ...json(ref('Error')) } },
      },
    },
    '/api/users/{id}/reset-password': {
      post: {
        tags: ['Users'],
        summary: 'Set a new password for a user (Administrator)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: json({ type: 'object', required: ['password'], properties: { password: { type: 'string', minLength: 12 } } }),
        responses: { '204': { description: 'Reset' } },
      },
    },
    '/api/audit': {
      get: {
        tags: ['Audit'],
        summary: 'Query the audit trail (Administrator, Risk Manager, Auditor)',
        parameters: ['limit', 'offset', 'action', 'actor', 'entity', 'from', 'to', 'search'].map(name => ({ name, in: 'query', schema: { type: ['limit', 'offset'].includes(name) ? 'integer' : 'string' } })),
        responses: { '200': { description: 'OK', ...json({ type: 'object', required: ['items', 'total'], properties: { items: { type: 'array', items: ref('AuditEntry') }, total: { type: 'integer' } } }) } },
      },
      post: {
        tags: ['Audit'],
        summary: 'Record a UI event (actor is taken from the session)',
        requestBody: json({ type: 'object', required: ['action', 'entity', 'description'], properties: { action: { type: 'string' }, entity: { type: 'string' }, entity_id: { type: ['string', 'number', 'null'] }, description: { type: 'string' }, result: { type: 'string', enum: ['SUCCESS', 'FAILURE'] } } }),
        responses: { '201': { description: 'Recorded', ...json(ref('AuditEntry')) } },
      },
    },
    '/api/audit/verify': {
      get: { tags: ['Audit'], summary: 'Verify the hash chain', responses: { '200': { description: 'Result', ...json({ type: 'object', required: ['valid', 'entries'], properties: { valid: { type: 'boolean' }, entries: { type: 'integer' }, brokenAt: { type: 'integer' }, reason: { type: 'string' } } }) } } },
    },
  }

  for (const [table, def] of Object.entries(TABLES)) {
    const tag = isWritable(def) ? 'Records' : def.access === 'restricted' ? 'Identity (admin only)' : 'Reference data'
    const listOp = {
      tags: [tag],
      summary: `List ${def.label}`,
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10000, default: 1000 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'ORDS filter JSON, e.g. {"status":"Y"}' },
      ],
      responses: { '200': { description: 'OK', ...json(ref('RowList')) }, ...errorResponses },
    }
    const getOp = { tags: [tag], summary: `Get one ${def.label}`, parameters: [idParam], responses: { '200': { description: 'OK', ...json(ref('Row')) }, '404': { description: 'Not found' }, ...errorResponses } }

    if (!isWritable(def)) {
      paths[`/api/${table}`] = { get: listOp }
      paths[`/api/${table}/{id}`] = { get: getOp }
      continue
    }

    const name = table.replace(/(^|_)(\w)/g, (_m, _s, c: string) => c.toUpperCase())
    schemas[`${name}Input`] = {
      type: 'object',
      description: `Writable columns of ${table}. Keys are case-insensitive. Unknown keys are ignored and listed in the X-Ignored-Fields response header.`,
      properties: Object.fromEntries(Object.entries(def.columns).map(([col, type]) => [col.toLowerCase(), columnSchema[type]])),
      required: (def.required ?? []).map(c => c.toLowerCase()),
    }
    const body = json(ref(`${name}Input`))
    paths[`/api/${table}`] = {
      get: listOp,
      post: { tags: [tag], summary: `Create ${def.label}`, requestBody: body, responses: { '201': { description: 'Created', ...json(ref('Row')) }, ...errorResponses } },
    }
    paths[`/api/${table}/{id}`] = {
      get: getOp,
      put: { tags: [tag], summary: `Update ${def.label} (partial)`, parameters: [idParam], requestBody: body, responses: { '200': { description: 'Updated', ...json(ref('Row')) }, ...errorResponses } },
      patch: { tags: [tag], summary: `Update ${def.label} (partial)`, parameters: [idParam], requestBody: body, responses: { '200': { description: 'Updated', ...json(ref('Row')) }, ...errorResponses } },
      delete: { tags: [tag], summary: `Delete ${def.label}`, parameters: [idParam], responses: { '204': { description: 'Deleted' }, ...errorResponses } },
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Pericope ERM API',
      version: '4.0.0',
      description: 'Authenticated API over the Pericope Oracle schema. Sign in with POST /api/auth/login; the session is an httpOnly cookie. State-changing requests must send `X-Requested-With: XMLHttpRequest`.',
    },
    components: {
      schemas,
      securitySchemes: {
        session: { type: 'apiKey', in: 'cookie', name: 'pericope_session' },
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ session: [] }, { bearer: [] }],
    paths,
  }
}
