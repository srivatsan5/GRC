// Simple risk validator; ready to wire with Zod later
function validateRiskInput(input) {
  if (!input || typeof input.name !== 'string' || input.name.trim() === '') return false
  if (input.description && typeof input.description !== 'string') return false
  return true
}
module.exports = { validateRiskInput }
