// pm2 process file for VPS / Hostinger deployments: `pm2 start ecosystem.config.cjs`
module.exports = {
  apps: [
    {
      name: 'pericope-api',
      script: 'dist/server.js',
      cwd: __dirname,
      instances: 1, // the user store and audit chain are file-based: run a single instance
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '300M',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
    },
  ],
}
