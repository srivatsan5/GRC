require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const BASE_URL = "https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc";

// ==========================
// GENERIC ORDS CALL
// ==========================
const ordsRequest = async (method, url, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
  };

  if (data) {
    config.data = data;
    config.headers = {
      "Content-Type": "application/json",
    };
  }

  try {
    const response = await axios(config);
    return response;
  } catch (err) {
    throw err;
  }
};

// ==========================
// ERROR HANDLER
// ==========================
const handleError = (res, err) => {
  if (err.response) {
    return res.status(err.response.status).json(err.response.data);
  }
  return res.status(500).json({ error: err.message });
};

// ==========================
// HEALTH
// ==========================
app.get("/", (req, res) => {
  res.send("GRC API running");
});

// ==========================
// GENERIC CRUD ROUTE FACTORY
// ==========================
const createRoutes = (table) => {

  // GET ALL
  app.get(`/api/${table}`, async (req, res) => {
    try {
      const response = await ordsRequest("GET", `/${table}/`);
      res.status(response.status).json(response.data);
    } catch (err) {
      handleError(res, err);
    }
  });

  // GET BY ID
  app.get(`/api/${table}/:id`, async (req, res) => {
    try {
      const response = await ordsRequest("GET", `/${table}/${req.params.id}`);
      res.status(response.status).json(response.data);
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST
  app.post(`/api/${table}`, async (req, res) => {
    try {
      const response = await ordsRequest("POST", `/${table}/`, req.body);
      res.status(response.status).json(response.data);
    } catch (err) {
      handleError(res, err);
    }
  });

  // PUT
  app.put(`/api/${table}/:id`, async (req, res) => {
    try {
      const response = await ordsRequest("PUT", `/${table}/${req.params.id}`, req.body);
      res.status(response.status).json(response.data);
    } catch (err) {
      handleError(res, err);
    }
  });

  // DELETE
  app.delete(`/api/${table}/:id`, async (req, res) => {
    try {
      const response = await ordsRequest("DELETE", `/${table}/${req.params.id}`);
      res.status(response.status).json(response.data);
    } catch (err) {
      handleError(res, err);
    }
  });
};

// ==========================
// REGISTER YOUR 6 TABLES
// ==========================
[
  "per_trn_identify_risk",
  "per_trn_risk_monitoring",
  "per_trn_control_implementation",
  "per_mst_business_process",
  "per_mst_control_type",
  "per_mst_risk_category"
].forEach(createRoutes);

// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
