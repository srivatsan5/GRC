// Basic environment config (V1)
module.exports = {
  ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  DB_CONNECTION: process.env.DB_CONNECTION || 'memory',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
}
