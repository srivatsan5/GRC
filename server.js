import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

dotenv.config();

const app = express();

// ================= PRODUCTION SECURITY HEADERS =================
app.use(helmet());

// ================= LOGGING =================
app.use(morgan('combined'));

// ================= COMPRESSION =================
app.use(compression());

// ================= RATE LIMITING =================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// ================= MIDDLEWARE =================
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL || 'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ================= LOGGING & MONITORING =================
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()}: ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()}: ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()}: ${msg}`),
  debug: (msg) => process.env.DEBUG && console.log(`[DEBUG] ${new Date().toISOString()}: ${msg}`),
};

// ================= CONFIG =================
const ORDS_BASE = process.env.ORDS_BASE_URL;
const TOKEN_URL = process.env.ORDS_TOKEN_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT = process.env.PORT || 5000;
const ENV = process.env.NODE_ENV || 'development';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '30000');

// ================= TOKEN MANAGEMENT =================
let accessToken = null;
let tokenExpiry = null;
let tokenRefreshAttempts = 0;
const MAX_TOKEN_REFRESH_ATTEMPTS = 3;

// ================= METRICS =================
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
  responseTimes: [],
  startTime: Date.now(),
  lastReset: Date.now(),
};

function updateMetrics(responseTime, success) {
  metrics.totalRequests++;
  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }
  metrics.responseTimes.push(responseTime);
  if (metrics.responseTimes.length > 1000) {
    metrics.responseTimes.shift();
  }
  metrics.averageResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
}

// ================= AUTH TOKEN SERVICE =================
async function getAccessToken() {
  try {
    // If token is still valid, return it
    if (accessToken && Date.now() < tokenExpiry - 60000) { // Refresh 1 minute before expiry
      return accessToken;
    }

    log.info('Requesting new OAuth2 access token...');
    
    const response = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: "client_credentials",
      }),
      {
        auth: {
          username: CLIENT_ID,
          password: CLIENT_SECRET,
        },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    tokenRefreshAttempts = 0; // Reset attempts on success
    
    log.info(`Access token obtained. Expires in ${response.data.expires_in}s`);
    return accessToken;
  } catch (error) {
    tokenRefreshAttempts++;
    log.error(`Failed to get access token (attempt ${tokenRefreshAttempts}): ${error.message}`);
    
    if (tokenRefreshAttempts >= MAX_TOKEN_REFRESH_ATTEMPTS) {
      accessToken = null;
      tokenExpiry = null;
      log.error('Max token refresh attempts exceeded');
      throw new Error('Failed to obtain access token after multiple attempts');
    }
    
    // Retry with exponential backoff
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, tokenRefreshAttempts) * 1000));
    return getAccessToken();
  }
}

// ================= ORACLE REQUEST SERVICE =================
async function oracleRequest(method, url, data = null, retries = 3) {
  const startTime = Date.now();
  
  try {
    const token = await getAccessToken();
    
    const config = {
      method,
      url: `${ORDS_BASE}${url}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': `Risk-Management-API/${ENV}`,
      },
      timeout: REQUEST_TIMEOUT,
      validateStatus: () => true, // Don't throw on any status
    };

    if (data) {
      config.data = data;
    }

    log.debug(`${method} ${url}`);
    const res = await axios(config);
    
    const responseTime = Date.now() - startTime;
    updateMetrics(responseTime, res.status >= 200 && res.status < 300);
    
    if (res.status >= 200 && res.status < 300) {
      log.debug(`${method} ${url} - Status: ${res.status} (${responseTime}ms)`);
      return res.data;
    } else if (res.status === 401) {
      // Token might be invalid, clear it and retry
      log.warn(`Token invalid (401), refreshing...`);
      accessToken = null;
      tokenExpiry = null;
      if (retries > 0) {
        return oracleRequest(method, url, data, retries - 1);
      }
    }
    
    log.warn(`Oracle Error [${method} ${url}] Status ${res.status}: ${JSON.stringify(res.data)}`);
    
    const errorResponse = {
      error: true,
      message: res.data?.message || `Oracle error: ${res.statusText}`,
      status: res.status,
      details: res.data,
      timestamp: new Date().toISOString(),
    };
    
    throw errorResponse;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    updateMetrics(responseTime, false);
    
    if (error.error) {
      throw error; // Re-throw our error responses
    }
    
    log.error(`Oracle Request Failed [${method} ${url}]: ${error.message}`);
    
    throw {
      error: true,
      message: error.message || 'Failed to communicate with Oracle',
      status: error.response?.status || 500,
      details: error.response?.data || null,
      timestamp: new Date().toISOString(),
    };
  }
}

// ================= GENERIC CRUD HANDLER =================
function createCRUDRoutes(basePath) {
  log.info(`Registering CRUD routes for: ${basePath}`);

  // GET ALL
  app.get(`/api/${basePath}`, async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      log.info(`GET /api/${basePath} - Limit: ${limit}, Offset: ${offset}`);
      
      const data = await oracleRequest("GET", `/risk/${basePath}`, null);
      
      // Pagination support
      let items = Array.isArray(data) ? data : (data?.items || []);
      const total = items.length;
      items = items.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      
      res.json({
        success: true,
        data: items,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in GET /api/${basePath}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });

  // GET BY ID
  app.get(`/api/${basePath}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      log.info(`GET /api/${basePath}/${id}`);
      
      const data = await oracleRequest("GET", `/risk/${basePath}/${id}`);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in GET /api/${basePath}/${req.params.id}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });

  // POST (CREATE)
  app.post(`/api/${basePath}`, async (req, res) => {
    try {
      const body = req.body;
      log.info(`POST /api/${basePath}`);
      
      // Validate request body
      if (!body || Object.keys(body).length === 0) {
        return res.status(400).json({
          error: true,
          message: 'Request body cannot be empty',
          status: 400,
          timestamp: new Date().toISOString(),
        });
      }
      
      const data = await oracleRequest("POST", `/risk/${basePath}`, body);
      
      res.status(201).json({
        success: true,
        message: 'Resource created successfully',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in POST /api/${basePath}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });

  // PUT (UPDATE)
  app.put(`/api/${basePath}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      
      log.info(`PUT /api/${basePath}/${id}`);
      
      if (!body || Object.keys(body).length === 0) {
        return res.status(400).json({
          error: true,
          message: 'Request body cannot be empty',
          status: 400,
          timestamp: new Date().toISOString(),
        });
      }
      
      const data = await oracleRequest("PUT", `/risk/${basePath}/${id}`, body);
      
      res.json({
        success: true,
        message: 'Resource updated successfully',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in PUT /api/${basePath}/${req.params.id}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });

  // DELETE
  app.delete(`/api/${basePath}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      log.info(`DELETE /api/${basePath}/${id}`);
      
      const data = await oracleRequest("DELETE", `/risk/${basePath}/${id}`);
      
      res.json({
        success: true,
        message: 'Resource deleted successfully',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in DELETE /api/${basePath}/${req.params.id}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });
}

// ================= REGISTER ALL TABLES =================
const tables = [
  "per_mst_business_process",
  "per_mst_control_type",
  "per_mst_risk_category",
  "per_trn_identify_risk",
  "per_trn_control_implementation",
  "per_trn_risk_monitoring",
  "risk-assessments",
  "mitigation-plans",
  "control-frequency",
  "impact",
  "likelihood",
  "risk-subcategories",
  "kri-matrix",
  "kri-configuration",
  "assets",
  "audit-trail",
];

log.info('Registering CRUD routes for tables...');
tables.forEach((table) => createCRUDRoutes(table));

// ================= DASHBOARD APIs =================
const dashboardEndpoints = [
  "summary",
  "risk-trend",
  "risk-distribution",
  "control-effectiveness",
  "risk-by-process",
  "risk-by-category",
  "monitoring-status",
];

log.info('Registering dashboard endpoints...');
dashboardEndpoints.forEach((endpoint) => {
  app.get(`/api/dashboard/${endpoint}`, async (req, res) => {
    try {
      log.info(`GET /api/dashboard/${endpoint}`);
      const data = await oracleRequest("GET", `/dashboard/${endpoint}`);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in GET /api/dashboard/${endpoint}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });
});

// ================= NESTED ENDPOINTS =================
const appetiteEndpoints = ["framework", "risk-appetite"];
appetiteEndpoints.forEach((endpoint) => {
  app.get(`/api/appetite/${endpoint}`, async (req, res) => {
    try {
      log.info(`GET /api/appetite/${endpoint}`);
      const data = await oracleRequest("GET", `/appetite/${endpoint}`);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in GET /api/appetite/${endpoint}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });
});

const assessmentEndpoints = ["access", "controls", "residual"];
assessmentEndpoints.forEach((endpoint) => {
  app.get(`/api/assessments/${endpoint}`, async (req, res) => {
    try {
      log.info(`GET /api/assessments/${endpoint}`);
      const data = await oracleRequest("GET", `/assessments/${endpoint}`);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in GET /api/assessments/${endpoint}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });

  if (endpoint === "controls") {
    app.put(`/api/assessments/${endpoint}/:id`, async (req, res) => {
      try {
        const { id } = req.params;
        log.info(`PUT /api/assessments/${endpoint}/${id}`);
        
        if (!req.body || Object.keys(req.body).length === 0) {
          return res.status(400).json({
            error: true,
            message: 'Request body cannot be empty',
            status: 400,
            timestamp: new Date().toISOString(),
          });
        }
        
        const data = await oracleRequest("PUT", `/assessments/${endpoint}/${id}`, req.body);
        
        res.json({
          success: true,
          message: 'Assessment control updated successfully',
          data,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        log.error(`Error in PUT /api/assessments/${endpoint}/${req.params.id}: ${error.message}`);
        res.status(error.status || 500).json(error);
      }
    });
  }
});

const monitoringEndpoints = ["action-plan", "actions-hierarchy"];
monitoringEndpoints.forEach((endpoint) => {
  app.get(`/api/monitoring/${endpoint}`, async (req, res) => {
    try {
      log.info(`GET /api/monitoring/${endpoint}`);
      const data = await oracleRequest("GET", `/monitoring/${endpoint}`);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(`Error in GET /api/monitoring/${endpoint}: ${error.message}`);
      res.status(error.status || 500).json(error);
    }
  });
});

app.get(`/api/reports`, async (req, res) => {
  try {
    log.info(`GET /api/reports`);
    const data = await oracleRequest("GET", `/reports`);
    
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error(`Error in GET /api/reports: ${error.message}`);
    res.status(error.status || 500).json(error);
  }
});

// ================= HEALTH CHECK =================
app.get("/api/health", (req, res) => {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  
  res.json({
    status: "OK",
    environment: ENV,
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    timestamp: new Date().toISOString(),
    port: PORT,
    ords: {
      configured: !!ORDS_BASE,
      connected: !!accessToken,
    },
  });
});

// ================= METRICS ENDPOINT =================
app.get("/api/metrics", (req, res) => {
  if (process.env.METRICS_ENABLED !== 'true' && ENV === 'production') {
    return res.status(403).json({
      error: true,
      message: 'Metrics endpoint disabled in production',
    });
  }
  
  res.json({
    metrics: {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      successRate: `${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`,
      averageResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
      uptime: new Date(Date.now() - metrics.startTime).toISOString().substr(11, 8),
    },
    timestamp: new Date().toISOString(),
  });
});

// ================= STATUS ENDPOINT =================
app.get("/api/status", (req, res) => {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  
  res.json({
    status: "operational",
    environment: ENV,
    version: "2.0.0",
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    timestamp: new Date().toISOString(),
    services: {
      database: accessToken ? "connected" : "connecting",
      api: "operational",
      cache: "operational",
    },
    endpoints: {
      total: tables.length * 4 + dashboardEndpoints.length + 5,
      tables: tables.length,
      dashboard: dashboardEndpoints.length,
      nested: 8,
    },
  });
});

// ================= ERROR HANDLING MIDDLEWARE =================

// 404 handler
app.use((req, res) => {
  log.warn(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: true,
    message: 'Route not found',
    path: req.url,
    method: req.method,
    status: 404,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      health: '/api/health',
      status: '/api/status',
      metrics: '/api/metrics',
      tables: `GET /api/{${tables.join('|')}}`,
      dashboard: `/api/dashboard/{${dashboardEndpoints.join('|')}}`,
    },
  });
});

// Global error handler
app.use((error, req, res, next) => {
  log.error(`Global Error: ${error.message}`);
  res.status(error.status || 500).json({
    error: true,
    message: error.message || 'Internal server error',
    status: error.status || 500,
    timestamp: new Date().toISOString(),
    ...(ENV === 'development' && { stack: error.stack }),
  });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  log.info(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        🚀 Risk Management API Server Started Successfully!     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

📍 Configuration:
   • Port: ${PORT}
   • Environment: ${ENV}
   • ORDS Base URL: ${ORDS_BASE ? '✅ Configured' : '❌ Not configured'}
   • Rate Limiting: Enabled (1000 req/15min)
   • Compression: Enabled
   • Security Headers: Enabled
   • CORS: Enabled
   
📊 API Endpoints:
   • Tables: ${tables.length} endpoints (CRUD)
   • Dashboard: ${dashboardEndpoints.length} views
   • Nested: 8 sub-resources
   • Total: ${tables.length * 4 + dashboardEndpoints.length + 5} available
   
🔗 Access Points:
   • Health: GET /api/health
   • Status: GET /api/status
   • Metrics: GET /api/metrics
   • Frontend: http://localhost:3000
   
⏰ Started: ${new Date().toLocaleString()}

✨ Server is ready to handle requests!
`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
