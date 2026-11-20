// PM2 部署配置：pm2 start ecosystem.config.js --env production
// 首次部署：npm ci && npx prisma migrate deploy && npm run build
module.exports = {
  apps: [
    {
      name: 'rainynest',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      instances: 1, // SQLite 单写者，禁止多实例
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'file:../db/blog.db',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
