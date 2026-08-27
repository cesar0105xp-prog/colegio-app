module.exports = {
  apps: [
    {
      name: 'colegio-backend',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
