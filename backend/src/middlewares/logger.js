// Simple request logger middleware (MVP)
function logger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    const log = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`
    // eslint-disable-next-line no-console
    console.info(log)
  })
  next()
}
module.exports = logger
