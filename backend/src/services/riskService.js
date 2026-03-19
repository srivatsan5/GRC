// Risk service using repository; MVP in-memory
const RiskRepository = require('../repositories/riskRepository')

class RiskService {
  constructor() {
    this.repo = new RiskRepository()
  }
  list(query) {
    const page = Number(query?.page) || 1
    const limit = Number(query?.limit) || 10
    return this.repo.list({ page, limit })
  }
  create(payload) {
    if (!payload?.name) throw new Error('Invalid payload')
    return this.repo.create(payload)
  }
  get(id) {
    return this.repo.getById(id)
  }
  update(id, payload) {
    if (!payload?.name) throw new Error('Invalid payload')
    const existing = this.repo.getById(id)
    if (!existing) return null
    return this.repo.update(id, payload)
  }
  delete(id) {
    return this.repo.delete(id)
  }
}

module.exports = RiskService
