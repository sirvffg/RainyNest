# RainyNest 根目录说明

> 按 IDE 文件树顺序排列。
>
> 插件/主题**开发**相关内容（扩展源码 `packages/`、CLI `tools/`、方案文档）已迁到
> `D:\File\代码\网站源码\RainyNest_Dev`，本目录只保留站点运行时。

## 目录

| 目录 | 干啥的 |
|---|---|
| `.next/` | Next.js 构建产物，自动生成 |
| `.screenshots/` | 截图缓存 |
| `.trae/` | IDE 配置与规则 |
| `app/` | 全部页面和接口。前台（首页/文章/相册/朋友圈）、后台 `/console`、API `/api/**`、主题资源路由 `themes/[slug]` |
| `components/` | React 组件。前台展示组件 + 后台 `admin/`（Modal、Toast、侧栏等） |
| `db/` | 数据库文件。`blog.db` 主库、`analytics.db` 统计库、`plugins/<slug>.db` 各插件独立库 |
| `generated/` | Prisma 自动生成的客户端代码。别手改，跑 `npm run prisma:generate` 重建 |
| `lib/` | 业务核心。登录鉴权、数据库连接、插件引擎、主题加载、包安装器、访问统计都在这 |
| `node_modules/` | 主项目依赖（含 SPI 类型包 `@rainynest/plugin-types`，来自 npm） |
| `prisma/` | 主库 schema + 迁移 + seed（默认管理员 admin/admin123） |
| `prisma-analytics/` | 统计库独立的 schema 与迁移，和主库分开 |
| `public/` | 浏览器直连的静态资源（图片、字体、favicon）。主题资源不走这里 |
| `scripts/` | 安装态扩展（`plugins/`、`themes/`，编译产物，内置预装和上传安装共用）+ 构建辅助脚本 |

## 文件

| 文件 | 干啥的 |
|---|---|
| `.env` | 环境变量（`AUTH_SECRET`、`EXT_DEV_TOKEN` 等） |
| `.env.example` | 环境变量模板 |
| `.gitignore` | Git 忽略规则 |
| `ARCHITECTURE.md` | 全站架构文档（旧版） |
| `DIRECTORY_GUIDE.md` | 本文件 |
| `instrumentation.ts` | 服务启动钩子（初始化统计调度等） |
| `middleware.ts` | 全站中间件（路由保护、后台鉴权） |
| `next-env.d.ts` | Next.js 类型声明，自动生成 |
| `next.config.ts` | Next.js 配置 |
| `package.json` / `package-lock.json` | 主项目依赖声明与锁定 |
| `postcss.config.mjs` | PostCSS 配置 |
| `tailwind.config.ts` | Tailwind 样式配置 |
| `tsconfig.json` | TypeScript 配置 |
| `tsconfig.tsbuildinfo` | TS 增量编译缓存，自动生成 |

## 部署上传清单

```
必须上传：
  app/  components/  lib/  generated/  prisma/  prisma-analytics/  db/
  scripts/  public/  node_modules/（或服务器 npm install）
  package.json  package-lock.json  next.config.ts  tailwind.config.ts
  postcss.config.mjs  tsconfig.json  middleware.ts  instrumentation.ts  .env

可以不上传：
  ARCHITECTURE.md  DIRECTORY_GUIDE.md
  .git/  .trae/  .screenshots/  tsconfig.tsbuildinfo  .env.example

服务器上要跑的：
  npm run build  →  npm run start   （或 PM2 守护）
```

## RainyNest_Dev（扩展开发工作区，与站点分离）

```
RainyNest_Dev/
├─ packages/              扩展源码工程（8 个插件 + 默认主题，自带 node_modules/tsconfig）
├─ tools/ext-cli/         @rainynest/ext CLI（new / build / pack / dev），已发布到 npm
├─ tools/create-rainynest-ext/  脚手架（npm create rainynest-ext），已发布到 npm
├─ scripts/               Dev 内构建产物（build-all 输出到这里，不直接进站点）
├─ PLUGIN_THEME_PLAN.md   插件/主题包体系方案
└─ .npm-publish.npmrc     npm 发布令牌（已 gitignore，7 天过期）

开发流程：
  cd RainyNest_Dev/packages && npm run build   → 产物到 RainyNest_Dev/scripts
  ext dev <slug>                               → 热更新推送到站点（需站点 .env 的 EXT_DEV_TOKEN）
  ext pack <slug>                              → 产出 .rainy-plugin/.rainy-theme 包，到后台「系统」上传安装
```
