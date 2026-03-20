// Production-grade single-file Express backend (Phase 2 MVP)
const express = require('express')
const app = express()
app.use(express.json())

// In-memory data store (MVP)
let risks = []
let nextId = 1

// Simple RBAC: tokens are role strings in MVP
function authorizeRole(roles) {
  return (req, res, next) => {
    const auth = req.headers['authorization'] || ''
    const token = auth.split(' ')[1] || ''
    const role = token
    if (!token || !roles.includes(role)) {
      return res.status(403).json({ success:false, error:{ code:'FORBIDDEN', message:'Access denied' }})
    }
    req.user = { role }
    next()
  }
}

// Health
app.get('/health', (req, res) => res.json({ status:'OK', time: new Date().toISOString() }))

// Auth login (returns token = role)
app.post('/auth/login', (req, res) => {
  const { role } = req.body || {}
  if (!['admin','risk_manager','viewer'].includes(role)) {
    return res.status(400).json({ success:false, error:{ code:'BAD_REQUEST', message:'Invalid role' }})
  }
  res.json({ success:true, token: role })
})

// List risks with pagination
app.get('/api/risks', authorizeRole(['admin','risk_manager','viewer']), (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.max(1, parseInt(req.query.limit) || 10)
  const start = (page - 1) * limit
  const data = risks.slice(start, start + limit)
  res.json({ success:true, total: risks.length, page, limit, data })
})

// Create risk
app.post('/api/risks', authorizeRole(['admin','risk_manager']), (req, res) => {
  const { name, description } = req.body
  if (!name) return res.status(400).json({ success:false, error:{ code:'BAD_REQUEST', message:'Invalid risk payload' }})
  const item = { id: nextId++, name, description: description || '', createdOn: new Date().toISOString() }
  risks.push(item)
  res.status(201).json({ success:true, data:item })
})

// Get risk by id
app.get('/api/risks/:id', authorizeRole(['admin','risk_manager','viewer']), (req, res) => {
  const id = parseInt(req.params.id)
  const found = risks.find(r => r.id === id)
  if (!found) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
  res.json({ success:true, data: found })
})

// Update risk
app.put('/api/risks/:id', authorizeRole(['admin','risk_manager']), (req, res) => {
  const id = parseInt(req.params.id)
  const idx = risks.findIndex(r => r.id === id)
  if (idx < 0) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
  const { name, description } = req.body
  if (!name) return res.status(400).json({ success:false, error:{ code:'BAD_REQUEST', message:'Invalid risk payload' }})
  risks[idx].name = name
  risks[idx].description = description || ''
  res.json({ success:true, data: risks[idx] })
})

// Delete risk
app.delete('/api/risks/:id', authorizeRole(['admin']), (req, res) => {
  const id = parseInt(req.params.id)
  const idx = risks.findIndex(r => r.id === id)
  if (idx < 0) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
  const [removed] = risks.splice(idx, 1)
  res.json({ success:true, data: removed })
})

const PORT = 5000
app.listen(PORT, () => console.log('API (production MVP) listening on http://localhost:' + PORT))
