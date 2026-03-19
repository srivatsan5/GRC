// In-memory repository for Risks (Phase 2 MVP)
class RiskRepository {
  constructor() {
    this.data = []
    this.nextId = 1
  }
  list({ page = 1, limit = 10 } = {}) {
    const start = (page - 1) * limit
    return { total: this.data.length, items: this.data.slice(start, start + limit) }
  }
  create(payload) {
    const item = { id: this.nextId++, name: payload.name, description: payload.description || '', createdOn: new Date().toISOString() }
    this.data.push(item)
    return item
  }
  getById(id) {
    return this.data.find(d => d.id === id)
  }
  update(id, payload) {
    const idx = this.data.findIndex(d => d.id === id)
    if (idx < 0) return null
    this.data[idx].name = payload.name
    this.data[idx].description = payload.description || ''
    return this.data[idx]
  }
  delete(id) {
    const idx = this.data.findIndex(d => d.id === id)
    if (idx < 0) return null
    const [removed] = this.data.splice(idx, 1)
    return removed
  }
}

module.exports = RiskRepository
