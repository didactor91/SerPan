module.exports = {
  apps: [
    {
      name: 'serverctrl',
      script: './apps/api/dist/index.js',
      cwd: '/opt/serverctrl',
      env: { NODE_ENV: 'production' },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '200M',
      log_file: '/var/log/serverctrl/combined.log',
      out_file: '/var/log/serverctrl/out.log',
      error_file: '/var/log/serverctrl/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
