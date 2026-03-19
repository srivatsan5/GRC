// Risk controller for Phase 2 MVP
const RiskService = require('../services/riskService')

class RiskController {
  constructor() {
    this.service = new RiskService()
    this.list = this.list.bind(this)
    this.create = this.create.bind(this)
    this.get = this.get.bind(this)
    this.update = this.update.bind(this)
    this.delete = this.delete.bind(this)
  }

  list(req, res) {
    const { page, limit } = req.query
    const result = this.service.list({ page, limit })
    res.json({ success:true, ...result })
  }

  create(req, res) {
    const payload = req.body
    const item = this.service.create(payload)
    res.status(201).json({ success:true, data:item })
  }

  get(req, res) {
    const id = Number(req.params.id)
    const item = this.service.get(id)
    if (!item) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
    res.json({ success:true, data:item })
  }

  update(req, res) {
    const id = Number(req.params.id)
    const item = this.service.update(id, req.body)
    if (!item) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
    res.json({ success:true, data:item })
  }

  delete(req, res) {
    const id = Number(req.params.id)
    const item = this.service.delete(id)
    if (!item) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Risk not found' }})
    res.json({ success:true, data:item })
  }
}

module.exports = RiskController
