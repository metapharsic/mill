module.exports = {
  apps: [
    {
      name: 'mk-erp-backend',
      script: './src/server.js',
      cwd: __dirname + '/backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '512M',
      restart_delay: 2000,
      max_restarts: 20,
    },
    {
      name: 'mk-erp-indexer',
      script: './scripts/auto-update-indexer.js',
      cwd: __dirname,
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/indexer-error.log',
      out_file: './logs/indexer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '256M',
      restart_delay: 5000,
      max_restarts: 10
    }
  ]
};
