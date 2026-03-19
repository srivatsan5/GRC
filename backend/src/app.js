// Simple modular backend skeleton (phase 2) implementing Clean Architecture vibe
// In-memory store MVP for risks; can swap to Oracle later
const express = require('express')
const bodyParser = require('body-parser')

function buildApp() {
  const app = express()
  const PORT = 0 // not used here; server.js will listen on its own port
  app.use(bodyParser.json())

  let risks = []
  let nextId = 1

  function authenticate(req, res, next) {
    const auth = req.headers['authorization'] || ''
    const token = auth.split(' ')[1] || ''
    if (!token) return res.status(401).json({ success:false, error:{ code:'UNAUTHORIZED', message:'Missing token' }})
    req.user = { role: token }
    if (!['admin','risk_manager','viewer'].includes(req.user.role)) {
      return res.status(401).json({ success:false, error:{ code:'UNAUTHORIZED', message:'Invalid role' }})
    }
    next()
  }

  function authorize(roles) {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ success:false, error:{ code:'UNAUTHORIZED', message:'Not authenticated' }})
      if (!roles.includes(req.user.role)) return res.status(403).json({ success:false, error:{ code:'FORBIDDEN', message:'Insufficient permissions' }})
      next()
    }
  }

  function validateRisk(payload) {
    if (!payload || typeof payload.name !== 'string' || payload.name.trim() === '') return false
    if (payload.description && typeof payload.description !== 'string') return false
    return true
  }

  // Routes
  app.post('/auth/login', (req, res) => {
    const { role } = req.body
    if (!['admin','risk_manager','viewer'].includes(role)) {
      return res.status(400).json({ success:false, error:{ code:'BAD_REQUEST', message:'Invalid role' }})
    }
    res.json({ success:true, token: role })
  })

  // List risks
  app.get('/risks', authenticate, authorize(['admin','risk_manager','viewer']), (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.max(1, parseInt(req.query.limit) || 10)
    const start = (page - 1) * limit
    const data = risks.slice(start, start + limit)
    res.json({ success:true, page, limit, total: risks.length, data })
  })

  app.post('/risks', authenticate, authorize(['admin','risk_manager']), (req, res) => {
    const payload = req.body
    if (!validateRisk(payload)) {
      return res.status(400).json({ success:false, error:{ code:'BAD_REQUEST', message:'Invalid risk payload' }})
    }
    const item = { id: nextId++, name: payload.name, description: payload.description || '', createdOn: new Date().toISOString() }
    risks.push(item)
    res.status(201).json({ success:true, data:item })
  })

  app.get('/risks/:id', authenticate, authorize(['admin','risk_manager','viewer']), (req, res) => {
    const id = parseInt(req.params.id)
    const found = risks.find(r => r.id === id)
    if (!found) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
    res.json({ success:true, data: found })
  })

  app.put('/risks/:id', authenticate, authorize(['admin','risk_manager']), (req, res) => {
    const id = parseInt(req.params.id)
    const idx = risks.findIndex(r => r.id === id)
    if (idx < 0) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
    const payload = req.body
    if (!validateRisk(payload)) {
      return res.status(400).json({ success:false, error:{ code:'BAD_REQUEST', message:'Invalid risk payload' }})
    }
    risks[idx].name = payload.name
    risks[idx].description = payload.description || ''
    res.json({ success:true, data:risks[idx] })
  })

  app.delete('/risks/:id', authenticate, authorize(['admin']), (req, res) => {
    const id = parseInt(req.params.id)
    const idx = risks.findIndex(r => r.id === id)
    if (idx < 0) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
    const [removed] = risks.splice(idx, 1)
    res.json({ success:true, data:removed })
  })

  // Emit a no-op health endpoint for parity
  app.get('/health', (req, res) => res.json({ status:'OK', uptime: Date.now() }))

  return app
}

module.exports = { buildApp }
