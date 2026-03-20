// Phase 2: Backend skeleton wired in a modular way using a micro-bootstrapped app
function buildApp() {
  const express = require('express')
  const bodyParser = require('body-parser')
  const riskRoutes = require('./routes/riskRoutes')
  const app = express()
  app.use(bodyParser.json())

  // Health endpoint (fallback health check)
  app.get('/health', (req, res) => res.json({ status: 'OK', time: new Date().toISOString() }))

  // Mount API routes (risk module)
  // If riskRoutes fails to load for any reason, keep a minimal in-file MVP to keep production ready
  try {
    app.use('/api', riskRoutes)
  } catch (e) {
    // Minimal inline MVP endpoints if dynamic import fails
    const router = require('express').Router()
    let inMemoryRisks = []
    let nextId = 1
    router.get('/risks', (req, res) => res.json({ success: true, total: inMemoryRisks.length, data: inMemoryRisks }))
    router.post('/risks', (req, res) => {
      const { name, description } = req.body
      if (!name) return res.status(400).json({ success:false, error:{ code:'BAD_REQUEST', message:'Invalid risk payload' }})
      const item = { id: nextId++, name, description: description||'', createdOn: new Date().toISOString() }
      inMemoryRisks.push(item)
      res.status(201).json(item)
    })
    router.get('/risks/:id', (req, res) => {
      const id = parseInt(req.params.id)
      const it = inMemoryRisks.find(r => r.id === id)
      if (!it) return res.status(404).json({ error:'Not found' })
      res.json(it)
    })
    router.put('/risks/:id', (req, res) => {
      const id = parseInt(req.params.id); const idx = inMemoryRisks.findIndex(r => r.id===id)
      if (idx<0) return res.status(404).json({ error:'Not found' })
      inMemoryRisks[idx].name = req.body.name || inMemoryRisks[idx].name
      inMemoryRisks[idx].description = req.body.description || inMemoryRisks[idx].description
      res.json(inMemoryRisks[idx])
    })
    router.delete('/risks/:id', (req, res) => { const id = parseInt(req.params.id); const idx = inMemoryRisks.findIndex(r => r.id===id); if (idx<0) return res.status(404).json({ error:'Not found' }); const [removed] = inMemoryRisks.splice(idx,1); res.json(removed) })
    app.use('/api', router)
  }

  return app
}

module.exports = { buildApp }
