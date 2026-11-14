import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 锁定文件追踪根目录（防止 Next 把用户主目录误判为 workspace root，
  // 扫描 C:\Users\xiaha\Application Data 系统联接导致 EPERM）
  outputFileTracingRoot: __dirname,
  // 原生模块 / Node-only 依赖不打包，运行时直接 require
  serverExternalPackages: [
    'better-sqlite3',
    'bcryptjs',
    'nodemailer',
    'node-cron',
    '@prisma/client',
    'prisma',
  ],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // 客户端路由缓存时长（秒）：同标签页跳转时 RSC 缓存的存活时间，
  // 静态页默认 5 分钟太长，统一压到 20s 保证后台改动前台更快可见
  experimental: {
    staleTimes: {
      dynamic: 20,
      static: 20,
    },
  },
  // 插件 customApi 的根路径映射（rss-feed 预装，固定映射）
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/rss.xml', destination: '/api/plugin/rss-feed/rss.xml' },
        { source: '/atom.xml', destination: '/api/plugin/rss-feed/atom.xml' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
