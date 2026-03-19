import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const ORDS_BASE = process.env.ORDS_BASE_URL;
const TOKEN_URL = process.env.ORDS_TOKEN_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = null;

/* ================= AUTH ================= */

async function getAccessToken() {
  try {
    if (accessToken && Date.now() < tokenExpiry) {
      return accessToken;
    }

    console.log('Getting new access token...');
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
        timeout: 10000, // 10 second timeout
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    
    console.log('Access token obtained successfully');
    return accessToken;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    throw new Error('Failed to obtain access token');
  }
}

/* ================= CORE SERVICE ================= */

async function oracleRequest(method, url, data = null) {
  try {
    const token = await getAccessToken();
    
    const config = {
      method,
      url: `${ORDS_BASE}${url}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 second timeout
    };

    if (data) {
      config.data = data;
    }

    const res = await axios(config);
    return res.data;
  } catch (error) {
    console.error(`Oracle Error [${method} ${url}]:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // Return a more structured error response
    const errorResponse = {
      error: true,
      message: error.response?.data?.message || error.message || 'Unknown error occurred',
      status: error.response?.status || 500,
      details: error.response?.data || null
    };
    
    throw errorResponse;
  }
}

/* ================= GENERIC CRUD HANDLER ================= */

function createCRUDRoutes(basePath) {
  console.log(`Creating CRUD routes for: ${basePath}`);

  // GET ALL
  app.get(`/api/${basePath}`, async (req, res) => {
    try {
      console.log(`GET /api/${basePath}`);
      const data = await oracleRequest("GET", `/risk/${basePath}`);
      res.json(data);
    } catch (error) {
      console.error(`Error in GET /api/${basePath}:`, error);
      res.status(error.status || 500).json(error);
    }
  });

  // GET BY ID
  app.get(`/api/${basePath}/:id`, async (req, res) => {
    try {
      const id = req.params.id;
      console.log(`GET /api/${basePath}/${id}`);
      const data = await oracleRequest("GET", `/risk/${basePath}/${id}`);
      res.json(data);
    } catch (error) {
      console.error(`Error in GET /api/${basePath}/${req.params.id}:`, error);
      res.status(error.status || 500).json(error);
    }
  });

  // POST
  app.post(`/api/${basePath}`, async (req, res) => {
    try {
      console.log(`POST /api/${basePath}:`, req.body);
      const data = await oracleRequest("POST", `/risk/${basePath}`, req.body);
      console.log(`POST /api/${basePath} success:`, data);
      res.status(201).json(data);
    } catch (error) {
      console.error(`Error in POST /api/${basePath}:`, error);
      res.status(error.status || 500).json(error);
    }
  });

  // PUT
  app.put(`/api/${basePath}/:id`, async (req, res) => {
    try {
      const id = req.params.id;
      console.log(`PUT /api/${basePath}/${id}:`, req.body);
      const data = await oracleRequest("PUT", `/risk/${basePath}/${id}`, req.body);
      console.log(`PUT /api/${basePath}/${id} success:`, data);
      res.json(data);
    } catch (error) {
      console.error(`Error in PUT /api/${basePath}/${req.params.id}:`, error);
      res.status(error.status || 500).json(error);
    }
  });

  // DELETE
  app.delete(`/api/${basePath}/:id`, async (req, res) => {
    try {
      const id = req.params.id;
      console.log(`DELETE /api/${basePath}/${id}`);
      const data = await oracleRequest("DELETE", `/risk/${basePath}/${id}`);
      console.log(`DELETE /api/${basePath}/${id} success:`, data);
      res.json({ message: 'Deleted successfully', data });
    } catch (error) {
      console.error(`Error in DELETE /api/${basePath}/${req.params.id}:`, error);
      res.status(error.status || 500).json(error);
    }
  });
}

/* ================= REGISTER ALL TABLES ================= */

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
];

console.log('Creating CRUD routes for tables...');
tables.forEach((table) => createCRUDRoutes(table));

/* ================= DASHBOARD APIs ================= */

const dashboardEndpoints = [
  "summary",
  "risk-trend",
  "risk-distribution",
  "control-effectiveness",
  "risk-by-process",
  "risk-by-category",
  "monitoring-status",
];

console.log('Creating dashboard endpoints...');
dashboardEndpoints.forEach((endpoint) => {
  app.get(`/api/dashboard/${endpoint}`, async (req, res) => {
    try {
      console.log(`GET /api/dashboard/${endpoint}`);
      const data = await oracleRequest("GET", `/dashboard/${endpoint}`);
      res.json(data);
    } catch (error) {
      console.error(`Error in GET /api/dashboard/${endpoint}:`, error);
      res.status(error.status || 500).json(error);
    }
  });
});

/* ================= HEALTH CHECK ================= */

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/* ================= ERROR HANDLING MIDDLEWARE ================= */

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: true,
    message: 'Route not found',
    path: req.url,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(error.status || 500).json({
    error: true,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server started successfully!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 ORDS Base URL: ${ORDS_BASE ? 'Configured' : 'Not configured'}`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  console.log(`\n📊 Available endpoints:`);
  console.log(`   • Health: GET /api/health`);
  console.log(`   • Tables: ${tables.length} CRUD endpoints`);
  console.log(`   • Dashboard: ${dashboardEndpoints.length} endpoints`);
  console.log(`\n✅ Server is ready to accept requests!\n`);
});

