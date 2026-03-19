"use strict";
try {
  const { buildApp } = require('./src/app')
  const app = buildApp()
  const PORT = process.env.PORT || 5000
  const server = app.listen(PORT, () => {
    console.log('API (modular) running on http://localhost:' + PORT)
  })
} catch (err) {
  console.error('Failed to bootstrap modular backend:', err)
  process.exit(1)
}
