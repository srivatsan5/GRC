// Phase 2: Backend skeleton wired in a modular way using a micro-bootstrapped app
function buildApp() {
  const express = require('express')
  const bodyParser = require('body-parser')
  const riskRoutes = require('./routes/riskRoutes')
  const app = express()
  app.use(bodyParser.json())

  // Health endpoint
  app.get('/health', (req, res) => res.json({ status: 'OK', time: new Date().toISOString() }))

  // Mount API routes (risk module etc.)
  app.use('/api', riskRoutes)

  return app
}

module.exports = { buildApp }
