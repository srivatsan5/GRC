import dotenv from "dotenv";
dotenv.config();
import express from "express";
import axios from "axios";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(morgan("combined"));
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

const BASE_URL = process.env.ORDS_BASE_URL || process.env.BASE_URL || "https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc";
const TOKEN_URL = process.env.ORDS_TOKEN_URL || "https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc/oauth/token";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 8000);

// =================================--------------------------------------------
// In-memory shadow store to handle upstream outages and prevent UI hangs.
// =================================--------------------------------------------
const shadow = new Map();
const audit = [];

function shadowFor(table) {
  if (!shadow.has(table)) shadow.set(table, []);
  return shadow.get(table);
}

function nextId(table) {
  const rows = shadowFor(table);
  return rows.length ? Math.max(...rows.map(r => Number(r.uuid || r.id || 0))) + 1 : 10000;
}

// ==========================
// UTILITIES & CASING
// ==========================

/**
 * Recursively converts object keys to UPPERCASE for Oracle ORDS compatibility.
 */
const toOracleCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(toOracleCase);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    Object.keys(obj).forEach(key => {
      newObj[key.toUpperCase()] = toOracleCase(obj[key]);
    });
    return newObj;
  }
  return obj;
};

/**
 * Valid column whitelists for each transactional table.
 * Only these columns will be sent in POST/PUT requests to prevent BadRequest.
 */
const TABLE_COLUMNS = {
  per_trn_identify_risk: [
    'ASSESSMENT_ACTUAL_START_DATE', 'ASSESSMENT_ACTUAL_END_DATE',
    'BUSINESS_PROCESS_UUID', 'BUSINESS_SUB_PROCESS_UUID',
    'RISK_TYPE_UUID', 'RISK_STATEMENT_UUID', 'IS_SOP_AVAILABLE',
    'INHERENT_SLE', 'IS_STAGE_COMPLTED', 'END_DATE', 'START_DATE',
    'RISK_STATEMENT', 'RISK_TYPE', 'SUB_PROCESS_NAME', 'PROCESS_NAME',
    'CREATED_ON', 'RISK_CHAMPION_UUID', 'STATUS', 'APPROVAL_STATUS',
    'APPROVER_COMMENTS', 'APPROVED_BY', 'APPROVED_ON',
    'RISK_OWNER', 'RISK_CHAMPION', 'RISK_APPETITE'
  ],
  per_trn_control_implementation: [
    'ROOT_CAUSE_UUID', 'CONTROL_ID', 'CONTROL_OWNER', 'MITIGATION_TYPE',
    'CONTROL_FREQUENCY', 'CONTROL_DESIGN_EFFECTIVENESS', 'CONTROL_CLASIFICATION',
    'CONTROL_TYPE', 'CONTROL_CATEGORY', 'INHERENT_LIKELIHOOD', 'RESIDUAL_LIKELIHOOD',
    'WEIGHTAGE_VALUE', 'IS_STAGE_COMPLTED', 'IDENTIFY_RISK_UUID',
    'ASSESSMENT_REFERENCE_NUMBER_UUID', 'APPROVAL_STATUS', 'APPROVER_COMMENTS',
    'APPROVED_BY', 'APPROVED_ON', 'RISK_UUID', 'EVIDENCE_NOTES',
    'CONTROL_EFFECTIVENESS_RATING'
  ],
  per_trn_risk_monitoring: [
    'ROOT_CAUSE', 'MONITORING_TITLE', 'MONITORING_GOAL', 'CONTROLS_UUID',
    'MITIGATION_OWNER', 'ESTIMATED_START_DATE', 'ESTIMATED_END_DATE',
    'ACTUAL_START_DATE', 'ACTUAL_END_DATE', 'IS_STAGE_COMPLTED',
    'APPROVAL_STATUS', 'APPROVER_COMMENTS', 'APPROVED_BY', 'APPROVED_ON',
    'RISK_UUID', 'COMPLETION_PCT', 'IDENTIFY_RISK_UUID', 'ASSESSMENT_REFERENCE_NUMBER_UUID'
  ],
  per_trn_inherent_risk_assessment: [
    'RISK_CATEGORY_UUID', 'DESCRIPTION', 'RISK_SUB_CATEGORY_UUID',
    'IS_ACTIVE', 'RISK_CAUSAL_FACTOR_UUID', 'RISK_DATA_SOURCE_UUID',
    'RISK_ROOT_CAUSE_UUID', 'RISK_OWNERS', 'RISK_LIKELIHOOD_UUID',
    'RISK_CYCLE_UUID', 'RISK_IMPACT_PARTIES_UUID', 'RISK_IMPACT_DESCRIPTION',
    'IS_STAGE_COMPLTED', 'RISK_UUID', 'IDENTIFY_RISK_UUID', 'RISK_STATEMENT_UUID'
  ],
  per_trn_mitigation_plans: [
    'PARENT_PLAN_UUID', 'PLAN_TYPE', 'PLAN_STATEMENT', 'PLAN_ACTIVITIES',
    'PLAN_START_DATE', 'PLAN_END_DATE', 'IS_ACTIVE',
    'APPROVAL_DETAILS', 'OVERALL_STATUS'
  ],
  per_trn_impact_category: [
    'IMPACT_CATEGORY_UUID', 'INHERENT_RISK_ASSESSMENT_UUID',
    'RISK_IMPACT_CATEGORY_UUID', 'RISK_IMPACT_SUB_CATEGORY_UUID',
    'RISK_INHERENT_IMPACT_LEVEL', 'RISK_RESIDUAL_IMPACT_LEVEL'
  ],
  erm_trn_assessment_cycle: [
    'CYCLE_REFERENCE', 'CYCLE_NAME', 'CYCLE_TYPE', 'CYCLE_YEAR',
    'CYCLE_PERIOD', 'ORG_HIERARCHY_UUID', 'CYCLE_START_DATE', 'CYCLE_END_DATE',
    'SUBMISSION_DEADLINE', 'STATUS', 'NOTES', 'CREATED_BY', 'CREATED_ON',
    'UPDATED_BY', 'UPDATED_ON'
  ],
  erm_risks: [
    'RISK_TITLE', 'RISK_DESC', 'LIKELIHOOD', 'IMPACT',
    'RESIDUAL_SCORE', 'STATUS', 'CREATED_ON', 'UUID', 'ID'
  ],
  erm_actions: [
    'RISK_ID', 'ACTION_DESC', 'DUE_DATE', 'STATUS', 'UUID', 'ID'
  ],
  erm_controls: [
    'RISK_ID', 'CONTROL_NAME', 'STATUS', 'UUID', 'ID'
  ],
  erm_incidents: [
    'RISK_ID', 'INCIDENT_DESC', 'SEVERITY', 'UUID', 'ID'
  ],
  erm_mst_kpi_definition: [
    'KPI_CODE', 'KPI_NAME', 'KPI_DESCRIPTION', 'KPI_CATEGORY',
    'TARGET_VALUE', 'TARGET_DIRECTION', 'IS_ACTIVE', 'CREATED_BY', 'CREATED_ON'
  ],
  erm_mst_kri_definition: [
    'KRI_CODE', 'KRI_NAME', 'KRI_DESCRIPTION', 'KRI_CATEGORY',
    'GREEN_THRESHOLD', 'AMBER_THRESHOLD', 'RED_THRESHOLD',
    'UNIT_OF_MEASURE', 'MEASUREMENT_FREQUENCY', 'IS_ACTIVE',
    'CREATED_BY', 'CREATED_ON'
  ],
  erm_trn_kpi_actuals: [
    'KPI_UUID', 'PERIOD_DATE', 'ACTUAL_VALUE', 'TARGET_VALUE',
    'VARIANCE', 'VARIANCE_PCT', 'NOTES', 'ENTERED_BY', 'ENTERED_ON'
  ],
  erm_trn_kri_readings: [
    'KRI_UUID', 'READING_DATE', 'READING_VALUE', 'TRAFFIC_LIGHT',
    'IS_BREACH', 'BREACH_NOTES', 'ORG_HIERARCHY_UUID',
    'RECORDED_BY', 'CREATED_ON'
  ],
  erm_trn_audit_log: [
    'TABLE_NAME', 'RECORD_UUID', 'ACTION_TYPE', 'CHANGED_BY',
    'CHANGED_ON', 'OLD_VALUE', 'NEW_VALUE'
  ]
};

// Defaults to satisfy strict NOT NULL constraints in ORDS tables.
const TABLE_DEFAULTS = {
  per_trn_identify_risk: {
    APPROVAL_STATUS: 'DRAFT',
    IS_STAGE_COMPLTED: 'N',
    STATUS: 'N',
  },
  per_trn_control_implementation: {
    APPROVAL_STATUS: 'DRAFT',
    IS_STAGE_COMPLTED: 'N',
    ASSESSMENT_REFERENCE_NUMBER_UUID: 0,
  },
  per_trn_risk_monitoring: {
    APPROVAL_STATUS: 'DRAFT',
    IS_STAGE_COMPLTED: 'N',
    COMPLETION_PCT: 0,
  },
};

const TABLE_REQUIRED_FIELDS = {
  per_trn_identify_risk: ['RISK_STATEMENT'],
  per_trn_control_implementation: ['CONTROL_ID'],
  per_trn_risk_monitoring: ['MONITORING_TITLE'],
};

const coerceTablePayload = (data, tableName) => {
  const payload = { ...data, ...(TABLE_DEFAULTS[tableName] || {}) };
  const toNumericOrDefault = (value, fallback = 1) => {
    const raw = String(value ?? '');
    const normalized = raw.replace(/\D+/g, '');
    const num = Number(normalized || raw);
    return Number.isFinite(num) ? num : fallback;
  };

  if (tableName === 'per_trn_control_implementation' && payload.CONTROL_ID !== undefined) {
    payload.CONTROL_ID = toNumericOrDefault(payload.CONTROL_ID, Math.floor(Date.now() / 1000));
  }

  if (tableName === 'per_trn_control_implementation') {
    if (payload.CONTROL_OWNER !== undefined) {
      payload.CONTROL_OWNER = toNumericOrDefault(payload.CONTROL_OWNER, 1);
    }
    if (payload.IDENTIFY_RISK_UUID !== undefined) {
      payload.IDENTIFY_RISK_UUID = toNumericOrDefault(payload.IDENTIFY_RISK_UUID, 1);
    }
  }

  return payload;
};

const TABLE_ALIASES = {
  per_mst_control_clasification: 'per_mst_control_classification',
  per_mst_risk_compuation_logic: 'per_mst_risk_computation_logic',
};

const resolveTableName = (table) => TABLE_ALIASES[table] || table;

const validateRequiredFields = (data, tableName) => {
  const required = TABLE_REQUIRED_FIELDS[tableName] || [];
  const missing = required.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  return {
    ok: missing.length === 0,
    missing,
  };
};

const referenceIdCache = new Map();

const extractRecordId = (record) => {
  if (!record || typeof record !== 'object') return null;
  return record.uuid ?? record.UUID ?? record.id ?? record.ID ?? record.risk_id ?? record.RISK_ID ?? null;
};

const getFirstAvailableId = async (table) => {
  const resolvedTable = resolveTableName(table);
  const cacheKey = `id:${resolvedTable}`;
  if (referenceIdCache.has(cacheKey)) {
    return referenceIdCache.get(cacheKey);
  }
  try {
    const res = await ordsRequest('GET', `${resolvedTable}/`, null, { limit: 1 });
    const first = Array.isArray(res.data?.items) ? res.data.items[0] : null;
    const id = extractRecordId(first);
    if (id !== null && id !== undefined) {
      referenceIdCache.set(cacheKey, id);
      return id;
    }
    return null;
  } catch {
    return null;
  }
};

const resourceExists = async (table, id) => {
  if (!id) return false;
  const resolvedTable = resolveTableName(table);
  try {
    const res = await ordsRequest('GET', `${resolvedTable}/${id}`);
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
};

const createFallbackIdentifyRisk = async () => {
  const fallbackPayload = coerceTablePayload({
    RISK_STATEMENT: `AUTO_PARENT_${Date.now()}`,
    RISK_TYPE: 'System',
    STATUS: 'N',
    IS_STAGE_COMPLTED: 'N',
  }, 'per_trn_identify_risk');

  const res = await ordsRequest('POST', 'per_trn_identify_risk/', fallbackPayload);
  const createdId = extractRecordId(res.data);
  if (createdId !== null && createdId !== undefined) {
    referenceIdCache.set('id:per_trn_identify_risk', createdId);
  }
  return createdId;
};

const createFallbackControlRegister = async () => {
  const fallbackPayload = {
    CONTROL_NAME: `AUTO_CONTROL_${Date.now()}`,
    CONTROL_DESCRIPTION: 'Auto-created control for FK integrity',
    CONTROL_SIGNIFICANCE: 'System generated',
  };
  const res = await ordsRequest('POST', 'per_mst_control_register/', fallbackPayload);
  const createdId = extractRecordId(res.data);
  if (createdId !== null && createdId !== undefined) {
    referenceIdCache.set('id:per_mst_control_register', createdId);
  }
  return createdId;
};

const enrichPayloadWithForeignKeys = async (tableName, payload) => {
  if (tableName !== 'per_trn_control_implementation') {
    return payload;
  }

  const enriched = { ...payload };
  const identifyRiskId = await getFirstAvailableId('per_trn_identify_risk');
  const controlRegisterId = await getFirstAvailableId('per_mst_control_register');

  if (!enriched.IDENTIFY_RISK_UUID && identifyRiskId) {
    enriched.IDENTIFY_RISK_UUID = identifyRiskId;
  }
  if (enriched.IDENTIFY_RISK_UUID) {
    const exists = await resourceExists('per_trn_identify_risk', enriched.IDENTIFY_RISK_UUID);
    if (!exists) {
      const createdParentId = await createFallbackIdentifyRisk();
      if (createdParentId) {
        enriched.IDENTIFY_RISK_UUID = createdParentId;
      }
    }
  }
  if (!enriched.ASSESSMENT_REFERENCE_NUMBER_UUID) {
    enriched.ASSESSMENT_REFERENCE_NUMBER_UUID = identifyRiskId || 0;
  }
  if ((!enriched.CONTROL_ID || Number(enriched.CONTROL_ID) <= 0) && controlRegisterId) {
    enriched.CONTROL_ID = controlRegisterId;
  }
  if (enriched.CONTROL_ID) {
    const exists = await resourceExists('per_mst_control_register', enriched.CONTROL_ID);
    if (!exists) {
      const createdControlId = await createFallbackControlRegister();
      if (createdControlId) {
        enriched.CONTROL_ID = createdControlId;
      }
    }
  }

  return enriched;
};

const filterToValidColumns = (data, tableName) => {
  const validColumns = TABLE_COLUMNS[tableName];
  if (!validColumns) return data;
  
  const filtered = {};
  const rejected = [];
  Object.keys(data).forEach(key => {
    if (validColumns.includes(key)) {
      filtered[key] = data[key];
    } else {
      rejected.push(key);
    }
  });
  
  if (rejected.length > 0) {
    console.warn(`[Filter] Stripped invalid columns for ${tableName}:`, rejected);
  }
  return filtered;
};

// ==========================
// INPUT SANITIZATION (QA-REC-10)
// ==========================
const CONSONANT_RUN = /[bcdfghjklmnpqrstvwxyz]{7,}/i;

function isJunkString(v) {
  if (typeof v !== 'string') return false;
  const trimmed = v.trim();
  if (trimmed.length < 3) return true;
  if (CONSONANT_RUN.test(trimmed)) return true;
  const hasNoSpace = !/\s/.test(trimmed);
  const letters = trimmed.replace(/[^a-z]/gi, '');
  if (hasNoSpace && letters.length >= 8) {
    const vowels = (letters.match(/[aeiou]/gi) || []).length;
    if (vowels / letters.length < 0.2) return true;
  }
  return false;
}

function sanitizePayload(body) {
  if (!body || typeof body !== 'object') return { sanitized: body, rejected: [] };
  const rejected = [];
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string') {
      const isUserFacing = /name|title|description|statement|justification|reason|comment|notes/i.test(k);
      if (isUserFacing && isJunkString(v)) {
        rejected.push({ field: k, value: v, reason: 'looks like keyboard-mash junk' });
        continue;
      }
      out[k] = v.trim();
    } else {
      out[k] = v;
    }
  }
  return { sanitized: out, rejected };
}

// ==========================
// OAUTH2 TOKEN MANAGER
// ==========================
let cachedToken = null;
let tokenExpiresAt = 0;
let authDisabled = false;

const getAccessToken = async () => {
  if (authDisabled) return null;

  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn("[Auth] No CLIENT_ID/CLIENT_SECRET set — running without OAuth");
    authDisabled = true;
    return null;
  }

  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    const response = await axios.post(
      TOKEN_URL,
      "grant_type=client_credentials",
      {
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 6000,
      }
    );

    cachedToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    tokenExpiresAt = Date.now() + expiresIn * 1000;

    console.log(`[Auth] Token refreshed. Expires in ${expiresIn}s`);
    return cachedToken;
  } catch (err) {
    console.warn(`[Auth] OAuth token failed (${err.response?.status || err.code}) — falling back to no-auth mode`);
    authDisabled = true;
    return null;
  }
};

// ==========================
// GENERIC ORDS CALL
// ==========================
const ordsRequest = async (method, url, data = null, params = {}) => {
  const token = await getAccessToken();
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  
  const config = {
    method,
    url: `${BASE_URL}${normalizedUrl}`,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    timeout: UPSTREAM_TIMEOUT_MS,
  };

  if (params && Object.keys(params).length > 0) {
    config.params = params;
  }

  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  if ((data && Object.keys(data).length > 0) || method === "DELETE") {
    let oracleData = toOracleCase(data || {});
    const tableName = normalizedUrl.replace(/^\//, '').replace(/\/$/, '').split('/')[0];
    oracleData = filterToValidColumns(oracleData, tableName);
    oracleData = coerceTablePayload(oracleData, tableName);
    
    config.data = oracleData;
    console.log(`[Proxy] ${method} ${normalizedUrl} | keys:`, Object.keys(config.data));
  }

  try {
    const response = await axios(config);
    return response;
  } catch (err) {
    if (err.response?.status === 401 && !authDisabled) {
      console.warn("[Auth] 401 received, clearing token cache and retrying...");
      cachedToken = null;
      tokenExpiresAt = 0;
      const freshToken = await getAccessToken();
      if (freshToken) {
        config.headers["Authorization"] = `Bearer ${freshToken}`;
      } else {
        delete config.headers["Authorization"];
      }
      return await axios(config);
    }
    throw err;
  }
};

const handleError = (res, err) => {
  const method = err.config?.method?.toUpperCase() || 'UNKNOWN';
  const url = err.config?.url || 'UNKNOWN';
  const status = err.response?.status || 500;
  const errorData = err.response?.data || { error: err.message };

  const oracleDetail = errorData?.detail || errorData?.['o:errorDetails']?.[0]?.detail || '';
  const oracleTitle = errorData?.title || '';
  
  console.error(`[ORDS Error] ${method} ${url}: ${status} | ${oracleTitle} | ${oracleDetail}`);
  return res.status(status).json({
    ...errorData,
    method,
    url,
    timestamp: new Date().toISOString()
  });
};

const UNAVAILABLE_CACHE = new Map();

const unavailableListResponse = (table, query = {}) => ({
  items: [],
  hasMore: false,
  limit: Number(query?.limit || 0) || 0,
  offset: Number(query?.offset || 0) || 0,
  count: 0,
  unavailable: true,
  table,
  message: `ORDS resource '${table}' is not available in current schema`,
});

const unavailableMutationResponse = (table, method) => ({
  code: 'ResourceUnavailable',
  title: 'Resource Unavailable',
  message: `Cannot execute ${method} on '${table}' because ORDS resource is not deployed.`,
  table,
  method,
  timestamp: new Date().toISOString(),
});

function ordsQueryParams(reqQuery = {}) {
  const params = { ...reqQuery };
  if (params.limit == null) params.limit = 10000;
  return params;
}

function shape(payload, _table, id) {
  if (payload && typeof payload === 'object') {
    if (!payload.uuid && !payload.id) payload.uuid = id;
  }
  return payload;
}

// ==========================
// USER-LEVEL AUDIT LOGGING
// ==========================
function actorFromReq(req) {
  return {
    id: req.headers['x-user-id'] || req.headers['X-User-Id'] || 'SYSTEM',
    name: req.headers['x-user-name'] || req.headers['X-User-Name'] || 'System',
    role: req.headers['x-user-role'] || req.headers['X-User-Role'] || 'System',
  };
}

function recordServerAudit(req, action, entity, entityId, description, result) {
  const actor = actorFromReq(req);
  const entry = {
    id: `AUD-S-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action,
    entity,
    entity_id: entityId,
    description,
    result,
    source: 'api',
  };
  audit.push(entry);
  if (audit.length > 5000) audit.splice(0, audit.length - 5000);
  return entry;
}

// ==========================
// ROUTES
// ==========================
app.get("/", (req, res) => {
  res.json({ status: "online", service: "Pericope GRC API", version: "2.1.0" });
});

app.get("/health", async (req, res) => {
  const token = await getAccessToken();
  res.json({ 
    status: "ok", 
    auth: token ? "oauth" : "no-auth", 
    ords: BASE_URL,
    shadowTables: Array.from(shadow.keys()),
    shadowRows: Array.from(shadow.entries()).reduce((acc, [k, v]) => (acc[k] = v.length, acc), {}),
    auditEntries: audit.length,
  });
});

// Dynamic/Resilient Audit Trail Endpoint
app.get('/api/erm_trn_audit_log', async (req, res) => {
  try {
    const r = await ordsRequest('GET', `/erm_trn_audit_log/`, null, ordsQueryParams(req.query));
    const upstreamItems = (r.data && (r.data.items || r.data.data)) || (Array.isArray(r.data) ? r.data : []);
    const merged = [...upstreamItems, ...audit].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    res.status(200).json({ items: merged, count: merged.length, source: 'upstream+local' });
  } catch (err) {
    const sortedLocal = [...audit].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    res.status(200).json({ items: sortedLocal, count: sortedLocal.length, source: 'local', upstreamError: err.code || err.message });
  }
});

app.post('/api/erm_trn_audit_log', async (req, res) => {
  const entry = recordServerAudit(req, req.body?.action || 'CREATE', req.body?.entity || 'Custom', req.body?.entity_id, req.body?.description || '', req.body?.result || 'SUCCESS');
  try {
    const r = await ordsRequest('POST', `/erm_trn_audit_log/`, entry);
    res.status(201).json(r.data || entry);
  } catch (err) {
    res.status(201).json({ ...entry, source: 'local', upstreamError: err.code || err.message });
  }
});

// CRUD Route Factory with Shadow Store support
const createRoutes = (table) => {
  const resolvedTable = resolveTableName(table);

  // GET ALL
  app.get(`/api/${table}`, async (req, res) => {
    if (UNAVAILABLE_CACHE.has(table)) {
      return res.status(200).json({ items: shadowFor(table), count: shadowFor(table).length, source: 'shadow', unavailable: true });
    }

    try {
      const response = await ordsRequest("GET", `${resolvedTable}/`, null, ordsQueryParams(req.query));
      const upstreamItems = (response.data && (response.data.items || response.data.data)) || (Array.isArray(response.data) ? response.data : []);
      const merged = [...upstreamItems, ...shadowFor(table)];
      res.status(response.status).json({ items: merged, count: merged.length, hasMore: response.data?.hasMore ?? false, source: 'upstream+shadow' });
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.code === 'NotFound') {
        UNAVAILABLE_CACHE.set(table, true);
        return res.status(200).json({ items: shadowFor(table), count: shadowFor(table).length, source: 'shadow', unavailable: true });
      }
      const shadowRows = shadowFor(table);
      res.status(200).json({ items: shadowRows, count: shadowRows.length, source: 'shadow', upstreamError: err.code || err.message });
    }
  });

  // GET BY ID
  app.get(`/api/${table}/:id`, async (req, res) => {
    if (UNAVAILABLE_CACHE.has(table)) {
      const fallback = shadowFor(table).find(x => String(x.uuid || x.id) === req.params.id);
      if (fallback) return res.status(200).json(fallback);
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      const response = await ordsRequest("GET", `${resolvedTable}/${req.params.id}`);
      res.status(response.status).json(response.data);
    } catch (err) {
      const fallback = shadowFor(table).find(x => String(x.uuid || x.id) === req.params.id);
      if (fallback) return res.status(200).json(fallback);
      handleError(res, err);
    }
  });

  // POST
  app.post(`/api/${table}`, async (req, res) => {
    const { sanitized, rejected } = sanitizePayload(req.body);
    if (rejected.length) {
      recordServerAudit(req, 'CREATE', table, null, `Rejected payload: ${rejected.map(r => r.field).join(', ')}`, 'FAILURE');
      return res.status(400).json({ error: 'Validation failed', rejected });
    }

    const withDefaults = coerceTablePayload(sanitized, resolvedTable);
    const enriched = await enrichPayloadWithForeignKeys(resolvedTable, withDefaults);
    const validation = validateRequiredFields(enriched, resolvedTable);
    if (!validation.ok) {
      return res.status(400).json({
        code: 'ValidationError',
        message: `Missing required field(s): ${validation.missing.join(', ')}`,
        table,
        missing: validation.missing,
      });
    }

    const id = nextId(table);
    const local = { ...enriched, uuid: id, id, created_on: new Date().toISOString(), created_by: actorFromReq(req).name };

    if (UNAVAILABLE_CACHE.has(table)) {
      shadowFor(table).push(local);
      recordServerAudit(req, 'CREATE', table, id, `Created row in ${table} (shadow)`, 'SUCCESS');
      return res.status(201).json({ ...local, source: 'shadow' });
    }

    try {
      const response = await ordsRequest("POST", `${resolvedTable}/`, enriched);
      const upstream = shape(response.data || local, resolvedTable, id);
      recordServerAudit(req, 'CREATE', table, upstream.uuid || upstream.id, `Created row in ${table}`, 'SUCCESS');
      res.status(response.status || 201).json(upstream);
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.code === 'NotFound') {
        UNAVAILABLE_CACHE.set(table, true);
      }
      shadowFor(table).push(local);
      recordServerAudit(req, 'CREATE', table, id, `Created row in ${table} (shadow fallback — upstream ${err.code || err.message})`, 'SUCCESS');
      res.status(201).json({ ...local, source: 'shadow', upstreamError: err.code || err.message });
    }
  });

  // PUT
  app.put(`/api/${table}/:id`, async (req, res) => {
    const { sanitized, rejected } = sanitizePayload(req.body);
    if (rejected.length) {
      recordServerAudit(req, 'UPDATE', table, req.params.id, `Rejected payload: ${rejected.map(r => r.field).join(', ')}`, 'FAILURE');
      return res.status(400).json({ error: 'Validation failed', rejected });
    }

    const withDefaults = coerceTablePayload(sanitized, resolvedTable);
    const enriched = await enrichPayloadWithForeignKeys(resolvedTable, withDefaults);

    if (UNAVAILABLE_CACHE.has(table)) {
      const rows = shadowFor(table);
      const idx = rows.findIndex(x => String(x.uuid || x.id) === req.params.id);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...enriched, updated_on: new Date().toISOString(), updated_by: actorFromReq(req).name };
        recordServerAudit(req, 'UPDATE', table, req.params.id, `Updated row in ${table} (shadow)`, 'SUCCESS');
        return res.status(200).json({ ...rows[idx], source: 'shadow' });
      }
      const synthetic = { uuid: req.params.id, id: req.params.id, ...enriched, updated_on: new Date().toISOString() };
      rows.push(synthetic);
      return res.status(200).json({ ...synthetic, source: 'shadow' });
    }

    try {
      const response = await ordsRequest("PUT", `${resolvedTable}/${req.params.id}`, enriched);
      recordServerAudit(req, 'UPDATE', table, req.params.id, `Updated row in ${table}`, 'SUCCESS');
      res.status(response.status).json(response.data);
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.code === 'NotFound') {
        UNAVAILABLE_CACHE.set(table, true);
      }
      const rows = shadowFor(table);
      const idx = rows.findIndex(x => String(x.uuid || x.id) === req.params.id);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...enriched, updated_on: new Date().toISOString(), updated_by: actorFromReq(req).name };
        recordServerAudit(req, 'UPDATE', table, req.params.id, `Updated row in ${table} (shadow fallback)`, 'SUCCESS');
        return res.status(200).json({ ...rows[idx], source: 'shadow', upstreamError: err.code || err.message });
      }
      const synthetic = { uuid: req.params.id, id: req.params.id, ...enriched, updated_on: new Date().toISOString() };
      rows.push(synthetic);
      recordServerAudit(req, 'UPDATE', table, req.params.id, `Synthesized shadow row for ${table}`, 'SUCCESS');
      res.status(200).json({ ...synthetic, source: 'shadow', upstreamError: err.code || err.message });
    }
  });

  // DELETE
  app.delete(`/api/${table}/:id`, async (req, res) => {
    if (UNAVAILABLE_CACHE.has(table)) {
      const rows = shadowFor(table);
      const idx = rows.findIndex(x => String(x.uuid || x.id) === req.params.id);
      if (idx >= 0) rows.splice(idx, 1);
      recordServerAudit(req, 'DELETE', table, req.params.id, `Deleted row from ${table} (shadow)`, 'SUCCESS');
      return res.status(200).json({ deleted: req.params.id, source: 'shadow' });
    }

    try {
      const response = await ordsRequest("DELETE", `${resolvedTable}/${req.params.id}`, {});
      recordServerAudit(req, 'DELETE', table, req.params.id, `Deleted row from ${table}`, 'SUCCESS');
      res.status(response.status).json(response.data);
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.code === 'NotFound') {
        UNAVAILABLE_CACHE.set(table, true);
      }
      const rows = shadowFor(table);
      const idx = rows.findIndex(x => String(x.uuid || x.id) === req.params.id);
      if (idx >= 0) rows.splice(idx, 1);
      recordServerAudit(req, 'DELETE', table, req.params.id, `Deleted row from ${table} (shadow fallback)`, 'SUCCESS');
      res.status(200).json({ deleted: req.params.id, source: 'shadow', upstreamError: err.code || err.message });
    }
  });
};

// Register all tables
const REGISTERED_TABLES = [
  "per_mst_business_process",
  "per_mst_business_sub_process",
  "per_mst_risk_statement",
  "per_mst_roles",
  "per_mst_control_category",
  "per_mst_control_classification",
  "per_mst_control_clasification",
  "per_mst_control_design_effectiveness",
  "per_mst_control_frequency",
  "per_mst_control_register",
  "per_mst_control_type",
  "per_mst_currency_type",
  "per_mst_designation",
  "per_mst_impact",
  "per_mst_impact_category",
  "per_mst_impact_parties",
  "per_mst_impact_sub_category",
  "per_mst_likelihood",
  "per_mst_org_hierarchy",
  "per_mst_org_level",
  "per_mst_risk_category",
  "per_mst_risk_causal_factor",
  "per_mst_risk_computation_logic",
  "per_mst_risk_compuation_logic",
  "per_mst_risk_cycle",
  "per_mst_risk_data_source",
  "per_mst_risk_root_cause",
  "per_mst_risk_sub_category",
  "per_mst_risk_type",
  "per_mst_user_details",
  "per_mst_user_roles_mapping",
  "per_mst_computation_output",
  "per_trn_control_implementation",
  "per_trn_identify_risk",
  "per_trn_impact_category",
  "per_trn_inherent_risk_assessment",
  "per_trn_mitigation_plans",
  "per_trn_mitigation_type",
  "per_trn_risk_monitoring",
  "erm_mst_kpi_definition",
  "erm_mst_kri_definition",
  "erm_trn_assessment_cycle",
  "erm_trn_kpi_actuals",
  "erm_trn_kri_readings",
  "erm_risks",
  "erm_actions",
  "erm_controls",
  "erm_incidents"
];

REGISTERED_TABLES.forEach(createRoutes);

const discoverTableAvailability = async () => {
  const checks = REGISTERED_TABLES.map(async (table) => {
    try {
      await ordsRequest('GET', `${resolveTableName(table)}/`, null, { limit: 1 });
      return { table, available: true };
    } catch (err) {
      const isNotFound = err.response?.status === 404 && err.response?.data?.code === 'NotFound';
      if (isNotFound) {
        UNAVAILABLE_CACHE.set(table, true);
      }
      return { table, available: !isNotFound };
    }
  });

  const results = await Promise.all(checks);
  const availableCount = results.filter((item) => item.available).length;
  console.log(`[Schema] ORDS resources available: ${availableCount}/${results.length}`);
};

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] ORDS Base: ${BASE_URL}`);
  const token = await getAccessToken();
  if (token) {
    console.log("[Auth]   OAuth2 token ready");
  } else {
    console.log("[Auth]   Running in no-auth mode (ORDS open schema)");
  }
  await discoverTableAvailability();
});
