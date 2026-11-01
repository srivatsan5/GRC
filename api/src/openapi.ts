import { TABLES, isWritable, APPROVAL_STATUSES, type ColumnSpec, type ColumnType } from './tables/registry.js'
import { ROLES } from './auth/permissions.js'
import { AUDIT_ACTIONS } from './audit/log.js'
import { CURRENCIES } from './settings/routes.js'

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
  rating: { type: 'integer', minimum: 1, maximum: 5 },
  email: { type: 'string', format: 'email' },
}

const specSchema = (spec: ColumnSpec): object => {
  if (typeof spec === 'string') return columnSchema[spec]
  if ('range' in spec) return { type: 'integer', minimum: spec.range[0], maximum: spec.range[1] }
  return { type: 'string', enum: [...spec.enum] }
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
    WorkflowStep: {
      type: 'object',
      required: ['uuid', 'step_no', 'approver_role', 'decision', 'decided_by', 'decided_name', 'decided_on', 'comments'],
      properties: {
        uuid: { type: 'integer' },
        step_no: { type: 'integer' },
        approver_role: { type: 'string', enum: ['Risk Manager', 'Administrator'] },
        decision: { type: ['string', 'null'], enum: ['Approved', 'Rejected', null] },
        decided_by: { type: ['string', 'null'] },
        decided_name: { type: ['string', 'null'] },
        decided_on: { type: ['string', 'null'] },
        comments: { type: ['string', 'null'] },
      },
    },
    WorkflowItem: {
      type: 'object',
      additionalProperties: true,
      required: ['uuid', 'status', 'submitted_by', 'steps', 'next_step', 'can_decide', 'blocked_reason'],
      properties: {
        uuid: { type: 'integer' },
        title: { type: 'string' },
        request_type: { type: 'string', enum: ['Risk Assessment', 'Mitigation Plan', 'Control Change', 'Policy Update', 'Risk Acceptance'] },
        business_unit: { type: ['string', 'null'] },
        amount: { type: ['number', 'null'] },
        details: { type: ['string', 'null'] },
        status: { type: 'string', enum: ['Pending', 'In Review', 'Approved', 'Rejected', 'Withdrawn'] },
        submitted_by: { type: 'string' },
        submitted_name: { type: ['string', 'null'] },
        submitted_on: { type: ['string', 'null'] },
        closed_on: { type: ['string', 'null'] },
        steps: { type: 'array', items: ref('WorkflowStep') },
        next_step: { type: ['integer', 'null'] },
        can_decide: { type: 'boolean' },
        blocked_reason: { type: ['string', 'null'] },
      },
    },
    OrgSettings: {
      type: 'object',
      required: ['orgName', 'industry', 'currency', 'idleTimeoutMinutes', 'riskBands'],
      properties: {
        orgName: { type: 'string', maxLength: 120 },
        industry: { type: 'string', maxLength: 80 },
        currency: { type: 'string', enum: [...CURRENCIES] },
        idleTimeoutMinutes: { type: 'integer', minimum: 5, maximum: 480 },
        riskBands: {
          type: 'object',
          required: ['moderate', 'high', 'critical'],
          properties: { moderate: { type: 'integer' }, high: { type: 'integer' }, critical: { type: 'integer' } },
          description: 'A likelihood × impact score at or above a threshold falls in that band.',
        },
      },
    },
    SettingsResponse: {
      type: 'object',
      required: ['settings', 'stored'],
      properties: { settings: ref('OrgSettings'), stored: { type: 'boolean' }, reason: { type: 'string', enum: ['not_provisioned', 'unavailable'] } },
    },
    RowPage: {
      type: 'object',
      required: ['items', 'total', 'page', 'pageSize', 'pageCount', 'truncated'],
      properties: {
        items: { type: 'array', items: ref('Row') },
        total: { type: 'integer' },
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
        pageCount: { type: 'integer' },
        truncated: { type: 'boolean', description: 'True when the table exceeded the listing cap.' },
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
        parameters: ['limit', 'offset', 'action', 'actor', 'entity', 'entityId', 'from', 'to', 'search'].map(name => ({ name, in: 'query', schema: { type: ['limit', 'offset'].includes(name) ? 'integer' : 'string' } })),
        responses: { '200': { description: 'OK', ...json({ type: 'object', required: ['items', 'total'], properties: { items: { type: 'array', items: ref('AuditEntry') }, total: { type: 'integer' } } }) } },
      },
      post: {
        tags: ['Audit'],
        summary: 'Record a UI event (actor is taken from the session)',
        requestBody: json({ type: 'object', required: ['action', 'entity', 'description'], properties: { action: { type: 'string' }, entity: { type: 'string' }, entity_id: { type: ['string', 'number', 'null'] }, description: { type: 'string' }, result: { type: 'string', enum: ['SUCCESS', 'FAILURE'] } } }),
        responses: { '201': { description: 'Recorded', ...json(ref('AuditEntry')) } },
      },
    },
    '/api/workflow': {
      get: {
        tags: ['Workflow'],
        summary: 'Approval requests with their steps',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['Pending', 'In Review', 'Approved', 'Rejected', 'Withdrawn'] } },
          { name: 'mine', in: 'query', schema: { type: 'string', enum: ['submitted', 'to-decide'] } },
        ],
        responses: { '200': { description: 'OK', ...json({ type: 'object', required: ['items', 'total'], properties: { items: { type: 'array', items: ref('WorkflowItem') }, total: { type: 'integer' } } }) } },
      },
      post: {
        tags: ['Workflow'],
        summary: 'Submit a request for approval (submitter = signed-in user)',
        requestBody: json({
          type: 'object',
          required: ['title', 'request_type'],
          properties: {
            title: { type: 'string' },
            request_type: { type: 'string', enum: ['Risk Assessment', 'Mitigation Plan', 'Control Change', 'Policy Update', 'Risk Acceptance'] },
            business_unit: { type: 'string' },
            amount: { type: 'number' },
            details: { type: 'string' },
            approver_roles: { type: 'array', items: { type: 'string', enum: ['Risk Manager', 'Administrator'] }, minItems: 1, maxItems: 3 },
          },
        }),
        responses: { '201': { description: 'Submitted', ...json(ref('WorkflowItem')) }, ...errorResponses },
      },
    },
    '/api/workflow/{id}': { get: { tags: ['Workflow'], summary: 'One request', parameters: [idParam], responses: { '200': { description: 'OK', ...json(ref('WorkflowItem')) } } } },
    '/api/workflow/{id}/decision': {
      post: {
        tags: ['Workflow'],
        summary: 'Approve or reject the next step (segregation-of-duties rules apply)',
        parameters: [idParam],
        requestBody: json({ type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['Approved', 'Rejected'] }, comment: { type: 'string' } } }),
        responses: { '200': { description: 'Decided', ...json(ref('WorkflowItem')) }, '403': errorResponses['403'], '409': { description: 'Already decided by someone else', ...json(ref('Error')) } },
      },
    },
    '/api/workflow/{id}/withdraw': { post: { tags: ['Workflow'], summary: 'Withdraw your own open request', parameters: [idParam], responses: { '200': { description: 'Withdrawn', ...json(ref('WorkflowItem')) } } } },
    '/api/settings': {
      get: { tags: ['Settings'], summary: 'Organisation settings (defaults if not stored yet)', responses: { '200': { description: 'OK', ...json(ref('SettingsResponse')) } } },
      put: { tags: ['Settings'], summary: 'Save organisation settings (Administrator)', requestBody: json(ref('OrgSettings')), responses: { '200': { description: 'Saved', ...json(ref('SettingsResponse')) }, ...errorResponses } },
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
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Managed listing: any of page/pageSize/sort/search/filter returns a RowPage with totals' },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 50 } },
        { name: 'sort', in: 'query', schema: { type: 'string' }, description: 'Column name' },
        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Case-insensitive text search over the table\'s search columns' },
        { name: 'filter', in: 'query', schema: { type: 'string' }, description: 'JSON object of column → value or list of values' },
      ],
      responses: { '200': { description: 'OK', ...json({ oneOf: [ref('RowList'), ref('RowPage')] }) }, ...errorResponses },
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
      properties: Object.fromEntries(Object.entries(def.columns).map(([col, spec]) => [col.toLowerCase(), specSchema(spec)])),
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
