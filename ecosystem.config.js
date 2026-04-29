module.exports = {
  apps: [
    {
      name: 'serpan',
      script: './apps/api/dist/index.js',
      cwd: '/opt/serpan',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '200M',
      log_file: '/var/log/serpan/combined.log',
      out_file: '/var/log/serpan/out.log',
      error_file: '/var/log/serpan/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
