module.exports = {
  apps: [
    {
      name: 'rate-api',
      cwd: './backend',
      script: 'server.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'rate-scheduler',
      cwd: './backend',
      script: 'scheduler/scheduler.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
