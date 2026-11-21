### RainyNest 架构文档 v3.0

> 适用版本：`rainynest@1.0.0`（2026-11-20）
> 技术栈：Next.js 15（App Router）+ React 19 + TypeScript + Prisma 5 + SQLite
> 定位：单机可跑、插件/主题可扩展、SEO 友好的自托管博客系统
>
> 说明：本文件是**按当前代码重写**的实现口径；根目录 [ARCHITECTURE.md](./ARCHITECTURE.md) 保留为早期设计草案（含未采用的 `vendor/` 方案），两者冲突时以本文为准。
> 面向插件/主题开发者的 API 细节见 [PLUGIN\_AND\_THEME\_API.md](./PLUGIN_AND_THEME_API.md)，目录级说明见 [DIRECTORY\_GUIDE.md](./DIRECTORY_GUIDE.md)。

***

## 一、设计目标与边界

**目标**

- 单进程 + SQLite 即可完整运行，不依赖 Redis、消息队列或对象存储
- 插件在不改核心代码的前提下扩展前台、后台、API、存储、通知
- 主题可安装/切换/在线预览，支持覆盖系统页面模板
- 前台优先静态化/ISR，后台与写接口按需渲染
- 访问统计、备份、定时任务全部内置，且不阻塞前台请求

**明确边界**

- 面向单实例部署（PM2 fork 模式）；多实例会争抢 SQLite 写锁
- 插件是**可信代码**，运行在 Node 进程内，不做沙箱隔离
- 文章正文按可信内容处理，不做 HTML 白名单清洗；用户评论走严格清洗
- PlantUML 使用公共 SVG 服务，Mermaid 从 CDN 按需加载

***

## 二、技术栈

| 分类       | 选型                                   | 说明                                  |
| -------- | ------------------------------------ | ----------------------------------- |
| 框架       | Next.js 15.5（App Router, Turbopack）  | RSC、Route Handlers、Metadata API、ISR |
| UI       | React 19 + Tailwind CSS 3            | 主题通过 CSS 变量注入                       |
| 语言       | TypeScript 5.8（strict）               | 全量类型                                |
| ORM      | Prisma 5.22                          | 双 schema / 双 Client                 |
| 主库       | SQLite（`db/blog.db`）                 | 业务数据 + FTS5 全文索引                    |
| 统计库      | SQLite（`db/analytics.db`）            | 访问日志与聚合                             |
| 插件库      | better-sqlite3（`db/plugins-db/*.db`） | 每个插件独立库，WAL                         |
| 认证       | NextAuth 5 beta（JWT）                 | Credentials + 可选 OAuth2/LDAP        |
| Markdown | unified + Expressive Code            | 服务端渲染，异步高亮                          |
| 编辑器      | Milkdown                             | 后台可视化编辑 + 插件工具按钮                    |
| 邮件       | nodemailer                           | 可被插件 `notifier` 接管                  |
| 定时       | node-cron                            | 进程内调度（`instrumentation.ts`）         |
| 校验       | Zod                                  | API 入参与设置校验                         |
| 图标       | lucide-react                         | 前后台通用                               |
| 扩展类型     | `@rainynest/plugin-types@0.3.2`      | 纯类型包，devDependency                  |

***

## 三、运行时架构

```
浏览器
  │
  ├─ /(site)/*      前台：RSC + ISR，读取主库/统计库
  ├─ /console/*     后台：JWT 保护，动态渲染
  ├─ /api/*         Route Handlers（Node Runtime）
  └─ /themes/*      主题静态资源路由（动态读取 scripts/themes）
        │
        ▼
Next.js 进程（单实例）
  ├─ middleware.ts（Edge）        只校验 /console/*，仅读 JWT
  ├─ instrumentation.ts（Node）   启动钩子
  │    ├─ bootPlugins()           扫描并加载插件
  │    ├─ startAnalyticsScheduler() 每分钟聚合 / 每 30 分钟清理在线记录
  │    ├─ startBackupScheduler()    读取 autoBackupCron，动态重建任务
  │    └─ node-cron 每分钟定时发布 SCHEDULED 文章
  ├─ lib/plugin/*                 插件引擎、UI 注入、API 中间件
  ├─ lib/analytics/*              PV 队列 + 批量写入 + GeoIP
  └─ lib/backup/*                 在线备份、恢复、保留策略
        │
        ▼
存储
  ├─ db/blog.db                   Prisma 主库
  ├─ db/analytics.db              Prisma 统计库
  ├─ db/plugins-db/<slug>.db      插件独立库（WAL）
  ├─ db/plugins-json/<slug>.*.json 插件配置
  ├─ db/backups/<时间戳>/          站点备份
  ├─ scripts/plugins/<slug>/      插件安装态
  ├─ scripts/themes/<slug>/       主题安装态
  └─ public/uploads/yyyyMM/       本地上传
```

***

## 四、目录结构

```
RainyNest/
├─ app/
│  ├─ (site)/            前台路由组（首页、博客、页面、搜索、预览等）
│  ├─ console/           后台路由组
│  ├─ api/               Route Handlers
│  ├─ signin/  register/  forgot-password/   独立认证页
│  ├─ themes/[slug]/[...path]/               主题静态资源
│  ├─ layout.tsx  globals.css  error.tsx  not-found.tsx
│  ├─ robots.ts  sitemap.ts
├─ components/           admin / site / post / comment / markdown / seo / layout / analytics / gallery / link / moments
├─ lib/
│  ├─ auth.ts  auth.config.ts  api-auth.ts  session-store.ts  ldap.ts  verification.ts
│  ├─ prisma.ts  site.ts  mailer.ts  image.ts
│  ├─ plugin/            engine / ui / admin / api-gate / json-store / theme-integration / role-templates
│  ├─ analytics/          queue / scheduler / geo / pv 等
│  ├─ backup/            index / scheduler
│  ├─ cron/              publish-scheduled
│  ├─ markdown/          processor / reading-time / comment
│  ├─ search/            default-provider（FTS5）
│  └─ theme/             templates（主题模板覆盖）
├─ prisma/
│  ├─ schema.prisma      主库
│  ├─ migrations/
│  └─ seed.ts
├─ prisma-analytics/analytics.prisma   统计库
├─ db/                   运行时数据（git 忽略）
├─ scripts/              安装态插件/主题 + 初始化脚本
├─ deploy/nginx.conf
├─ Dockerfile  ecosystem.config.js  vercel.json
├─ instrumentation.ts  middleware.ts  next.config.ts
└─ public/               静态资源与上传目录
```

**关键约定**

- 插件/主题的「安装态」在 `scripts/` 下，不是 `vendor/`
- `scripts/ensure-extensions.js` 在 `dev/build/start` 前执行：补齐内置扩展、清扫 `.bak-*` / `.deleted-*` 残留目录
- 运行时数据全部在 `db/` 与 `public/uploads/`，容器部署时挂载这两个目录加 `scripts/`

***

## 五、数据库设计

### 5.1 双库拆分

| 库   | Prisma Schema                       | 环境变量                     | 内容               |
| --- | ----------------------------------- | ------------------------ | ---------------- |
| 主库  | `prisma/schema.prisma`              | `DATABASE_URL`           | 用户、内容、插件、主题、站点设置 |
| 统计库 | `prisma-analytics/analytics.prisma` | `ANALYTICS_DATABASE_URL` | PV、在线访客、日/时聚合    |

拆分的意义：统计写入高频且可丢弃，与业务数据隔离后，统计库锁竞争不会拖慢发文、评论等核心操作。两个 Client 分别生成到 `generated/` 下，统一由 `lib/prisma.ts` 与 `lib/analytics.ts` 导出。

### 5.2 主库模型（25 个）

**用户与权限**

| 模型                                        | 用途                               |
| ----------------------------------------- | -------------------------------- |
| `User`                                    | 账号、邮箱、密码哈希、头像、状态、`forbidConsole` |
| `Role` / `UserRole`                       | 角色与用户多对多                         |
| `Permission` / `RolePermission`           | 权限点与角色授权                         |
| `RoleTemplate` / `RoleTemplatePermission` | 插件注册的角色模板及权限集合                   |
| `Identity`                                | 第三方身份（OAuth provider + 外部 ID）    |
| `Session`                                 | 登录设备记录（token、IP、UA、最后活跃）         |
| `VerificationCode`                        | 邮箱验证码 / 找回密码，带过期与已用标记            |

**内容**

| 模型                             | 关键字段                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `Post`                         | `status`(DRAFT/PUBLISHED/SCHEDULED)、`isTop`、`views`、`words`、`publishedAt`、`categoryId` |
| `Category` / `Tag` / `PostTag` | 分类、标签、多对多                                                                              |
| `Comment`                      | `status`(PENDING/APPROVED/REJECTED)、`parentId` 树形回复、`ip`/`userAgent`/`extra`           |
| `Page`                         | 独立页面，`showSidebar`、`sidebarContent`、`order`                                            |
| `Moment`                       | 说说                                                                                     |
| `Gallery` / `Photo`            | 相册与照片                                                                                  |
| `Link`                         | 友链                                                                                     |
| `Menu`                         | 前台导航                                                                                   |
| `Attachment`                   | 附件库记录：`url`、`mimeType`、`size`、`storage`（local 或插件名）                                    |

**扩展与配置**

| 模型            | 用途                |
| ------------- | ----------------- |
| `Plugin`      | 插件启用状态、配置 JSON、版本 |
| `Theme`       | 主题启用状态、配置 JSON    |
| `SiteSetting` | 单行站点配置（见 5.4）     |

### 5.3 统计库模型（5 个）

| 模型              | 用途                                           |
| --------------- | -------------------------------------------- |
| `PageView`      | 原始 PV：path、postId、sessionId、IP、国家、UA、referer |
| `OnlineVisitor` | 按 sessionId 去重的在线访客，`lastSeen` 心跳            |
| `DailyStat`     | 按日聚合（PV/UV）                                  |
| `HourlyStat`    | 按小时聚合                                        |
| `PostDailyView` | 单篇文章按日浏览                                     |

### 5.4 SiteSetting 分组

单行表（`id = "default"`），按功能分组：

| 分组       | 字段示例                                                                                                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 站点       | `title`、`subtitle`、`description`、`url`、`logo`、`favicon`、`icp`、`footerText`、`primaryColor`                                                                                                                                                                        |
| SEO      | `keywords`、`author`、`googleVerification`、`baiduVerification`、`enableRss`、`enableSitemap`                                                                                                                                                                         |
| 社交       | `githubUrl`、`twitterUrl`、`email`                                                                                                                                                                                                                                 |
| 注册/评论    | `allowRegister`、`commentModeration`                                                                                                                                                                                                                              |
| Markdown | `codeShowLineNumbers`、`codeCollapsible`、`codeCollapseThreshold`、`codeLanguageBadge`、`enableCallouts`、`enableMath`、`enableWikiLink`、`enableReadingTime`、`enableEmailProtection`、`enableSectionize`、`codeTabGroup`、`enableFigure`、`enableMermaid`、`enablePlantuml` |
| 邮件       | `smtpHost`、`smtpPort`、`smtpUser`、`smtpPass`、`smtpFrom`                                                                                                                                                                                                           |
| 备份       | `autoBackupCron`（标准 5 段 cron，空=关闭）、`autoBackupKeep`（默认 7）                                                                                                                                                                                                        |
| 主题       | `allowThemeGitInstall`                                                                                                                                                                                                                                           |
| OAuth2   | `oauthGithubId/Secret`、`oauthGoogleId/Secret`、`oauthWechatId/Secret`                                                                                                                                                                                             |
| LDAP     | `enableLdap`、`ldapUrl`、`ldapBindDn`、`ldapBindPassword`、`ldapBaseDn`、`ldapUserFilter`                                                                                                                                                                             |
| 访客 IP    | `ipSource`(auto/direct/custom)、`ipCustomHeader`                                                                                                                                                                                                                  |

`lib/site.ts` 提供 `DEFAULT_SITE_SETTING` 与 `getSiteSetting()`，数据库不可用时回退默认值，保证前台不 500。

### 5.5 迁移与初始化

```bash
npm run prisma:generate   # 生成两个 Client
npm run db:deploy         # 应用两库迁移
npm run db:init           # 初始化 analytics 库 + FTS5 虚拟表/触发器
npm run db:seed           # 写入管理员、示例内容、内置插件/主题记录
npm run setup             # 以上四步串联
```

***

## 六、认证与权限

### 6.1 会话模型

- NextAuth 5，**JWT 策略**，不落库 session
- 登录时把 `username`、`roles`、`permissions`、`forbidConsole`、`sessionToken` 写进 JWT
- `session` callback 回显到 `session.user`
- 设备记录另存 `Session` 表，用于「登录设备」列表与踢下线

### 6.2 登录方式

| 方式                   | 启用条件                      | 实现                               |
| -------------------- | ------------------------- | -------------------------------- |
| 账号密码                 | 始终可用                      | Credentials Provider，bcrypt 校验   |
| LDAP                 | `enableLdap = true` 且配置完整 | 本地校验失败后走 LDAP bind；`lib/ldap.ts` |
| GitHub / Google / 微信 | 对应 `oauth*Id/Secret` 非空   | 启动时动态装配 Provider，登录后写 `Identity` |

`lib/auth.config.ts` 被 Edge middleware 引用，**禁止引入 Prisma/bcrypt/fs**；Node-only 逻辑都在 `lib/auth.ts`。

### 6.3 权限校验

```ts
const denied = await requirePermission('post:create');
if (denied) return denied;           // 401 / 403 Response

const session = await requireSession(); // Session | null
if (!hasPermission(session, 'post:edit')) { ... }
```

- 超级管理员权限含 `*`，`hasPermission` 直接放行
- 角色 `administrator` 在 middleware 中直接放行后台
- `forbidConsole = true` 的角色（如 viewer）禁止进入 `/console`
- 其他角色需要 `console:login` 才能进入后台

### 6.4 middleware 保护范围

`middleware.ts` 只匹配 `/console/:path*`：

1. 未登录 → 跳 `/signin?redirect=<path>`
2. `administrator` → 放行
3. `forbidConsole` → 跳首页
4. 无 `console:login` → 跳首页

API 的鉴权在各 Route Handler 内用 `requireSession` / `requirePermission` 完成，middleware 不覆盖 `/api`。

***

## 七、插件系统

### 7.1 类型契约

- npm 包：`@rainynest/plugin-types@0.3.2`（纯类型，devDependency）
- 源码：`RainyNest_Dev/packages/types`
- 宿主出口：`lib/plugin/types.ts` 只做 `export type * from '@rainynest/plugin-types'`
- 扩展点增减流程：改 Dev 包 → 升版本 → 构建 → 发布 npm → 主项目升级依赖。宿主不再维护本地类型副本。

### 7.2 目录与安装态

```
scripts/plugins/<slug>/
├─ plugin.json     元数据：name/version/entry/permissions/configSchema/database...
└─ index.js        已打包的 CJS 入口，导出 handlers
```

- 安装器：`lib/ext-installer.ts`
- 上传包命名：`{slug}.zip.rainy-plugin`、`{slug}.gz.rainy-plugin`、`{slug}.zip.rainy-theme`、`{slug}.gz.rainy-theme`
- 限制：单包 ≤ 20MB；仅允许 `.js/.tsx/.json/.css/.png/.jpg/.jpeg/.svg/.webp/.sql/.md/.txt/.woff/.woff2/.ttf`；解压时校验路径穿越
- 卸载采用「重命名 + 延迟删除」，`ensure-extensions.js` 启动时清扫 `.bak-*` / `.deleted-*`
- 插件静态/模板文件与 `index.js` 同目录，跟随插件整体安装卸载

### 7.3 加载与执行

`lib/plugin/engine.ts`：

| 导出                                                        | 作用                                                     |
| --------------------------------------------------------- | ------------------------------------------------------ |
| `bootPlugins()`                                           | 扫描目录、读取 `plugin.json`、require `index.js`、按启用状态过滤，进程级缓存 |
| `resetPluginCache()` / `reloadPlugin(slug)`               | 开发热重载                                                  |
| `getLoadedPlugins()`                                      | 已加载插件列表                                                |
| `fireExtensionPoint(point, ...args)`                      | 数组型扩展点：按插件扫描顺序依次调用，收集返回值                               |
| `firstWins(point, input)`                                 | 覆盖型扩展点：第一个返回非空的结果生效（如 metadata patch）                  |
| `getPluginSearchProvider()`                               | `searchProvider` 第一个提供者                                |
| `getPluginSidebarWidgets()` / `getPluginFrontendRoutes()` | 前台侧边栏组件、自定义前台路由                                        |
| `getApiMiddlewares()` / `runApiMiddlewares(req)`          | API 中间件链                                               |
| `getAttachmentStorageProvider()`                          | 附件存储提供者（第一个）                                           |
| `getPluginNotifier()`                                     | 通知提供者（第一个），`lib/mailer.ts` 优先调用                        |
| `getProvidedTemplates()`                                  | 插件提供的主题模板                                              |
| `collectPluginDefinitions(point)`                         | 通用收集：返回 `{ pluginSlug, pluginName, def }`              |

执行语义：

- **数组型**：所有启用的插件按目录扫描顺序执行，返回值拼接
- **Provider 型**：`searchProvider`、`attachmentStorage`、`notifier` 只有第一个生效
- **覆盖型**：`firstWins` 用于 metadata 等「后写覆盖」场景
- 单个插件抛错只记录日志，不影响其他插件与主流程

### 7.4 扩展点清单

| 分类     | 扩展点                                                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 生命周期   | `onMount`、`afterSavePost`、`beforeSavePost`、`beforeDeletePost`、`beforeCommentApprove`                                                                                                    |
| 内容渲染   | `onRenderMarkdown`、`onGenerateMetadata`、`excerptGenerator`                                                                                                                              |
| 请求/存储  | `apiMiddleware`、`attachmentStorage`、`notifier`、`searchProvider`                                                                                                                        |
| 前台注入   | `injectHead`、`injectFooter`、`injectHeaderAction`、`injectSidebarWidget`、`injectPostContent`、`injectSinglePageContent`、`injectCommentWidget`、`injectCommentField`、`providesTemplates`       |
| 页面/路由  | `customApi`、`customFrontendRoutes`、`customAdminRoutes`、`dashboardWidget`、`dashboardQuickAction`                                                                                          |
| 后台列表操作 | `postListItemOperation`、`pageListItemOperation`、`commentListItemOperation`、`replyListItemOperation`、`pluginListItemOperation`、`themeListItemOperation`、`attachmentListItemOperation`、`backupListItemOperation` |
| 后台列表字段 | `postListItemField`、`pageListItemField`、`pluginListItemField`                                                                                                                          |
| 后台 Tab | `pluginDetailTab`、`themeListTab`、`attachmentSelectorTab`、`pluginInstallTab`、`backupTab`、`userDetailTab`                                                                                |
| 编辑器/评论 | `editorCreate`、`commentEditorReplace`、`commentListItemContentReplace`、`commentSubjectRef`                                                                                              |
| 统计     | `onPageView`                                                                                                                                                                            |

`plugin.json` 的 `meta` 还可声明 `permissions`（权限点）、`roleTemplates`（角色模板）、`database.migrations`、`configSchema`、`specVersion`、`requiresCore`、`native`。

UI 注入的收集与渲染在 `lib/plugin/ui.ts`；插件返回的 React 组件在服务端渲染为 HTML 后注入页面。

### 7.5 插件数据

| 数据      | 位置                                   | 说明                                                             |
| ------- | ------------------------------------ | -------------------------------------------------------------- |
| 独立数据库   | `db/plugins-db/<slug>.db`            | better-sqlite3，WAL + 外键；由 `lib/plugin/migrator.ts` 按 `plugin.json.database.migrations` 执行迁移 |
| JSON 配置 | `db/plugins-json/<slug>.<kind>.json` | `config` / `state` 等，原子写入                                      |
| 主库访问    | `PluginContext.prisma`               | 只读/受限使用，推荐插件自己的库                                               |

`lib/plugin-db.ts` 负责连接缓存与关闭；卸载/清数据前调用 `closePluginDb(slug)`。

### 7.6 API 中间件

`lib/plugin/api-gate.ts` 暴露 `pluginApiGate(req)`：

```ts
const blocked = await pluginApiGate(req);
if (blocked) return blocked;
```

- 按 `path` 前缀 + `methods` 匹配
- 链式 `next()`，插件可返回 `Response` 短路，返回 `void` 放行
- `204` 视为放行
- 当前接入 8 个公开接口：`posts`、`pages`、`comments`、`categories`、`tags`、`links`、`gallery`、`moments`

### 7.7 内置插件（8 个）

| 插件                 | 能力                             |
| ------------------ | ------------------------------ |
| `announcement-bar` | 顶栏公告、页脚注入、仪表盘快捷操作、API 中间件、通知示例 |
| `code-highlight`   | 代码高亮增强                         |
| `comment-filter`   | 评论敏感词/频率过滤                     |
| `default-seo`      | 默认 SEO metadata 补全             |
| `reading-time`     | 阅读时间注入                         |
| `related-posts`    | 相关文章 + 主题模板示例                  |
| `rss-feed`         | `/rss.xml`、`/atom.xml`         |
| `sitemap-enhance`  | sitemap 增强                     |

***

## 八、主题系统

### 8.1 目录规范

```
scripts/themes/<slug>/
├─ theme.json     元数据 + configSchema
├─ theme.js       可选：configToCssVariables(config)
├─ theme.css      可选：静态样式
└─ templates/     可选：覆盖系统页面模板 layout/home/post-list/post/page/archive/categories/category/tags/tag/search/moments/moment/links/gallery/photo/error
```

`theme.json` 关键字段：

| 字段                                   | 说明                                                                   |
| ------------------------------------ | -------------------------------------------------------------------- |
| `slug` / `name` / `version`          | 标识与版本                                                                |
| `description` / `author` / `preview` | 展示信息                                                                 |
| `minRainyNestVersion`                | 兼容的最低核心版本                                                            |
| `supports`                           | 支持的模板/能力声明                                                           |
| `configSchema`                       | 分组表单：`{ group: { fields: { key: { type, default, label, ... } } } }` |

### 8.2 配置与 CSS 变量

`lib/theme.ts`：

1. 按 `Theme.isActive` 找激活主题
2. 读磁盘 `theme.json`
3. 读 `theme.js` 的 `configToCssVariables`
4. `mergeWithDefault(configSchema, dbConfig)` 合并默认值
5. 生成 `cssVars`、`customCss`、`customJs`
6. 进程内缓存 30 秒；激活/保存配置后 `clearThemeCache()`

前台布局把 `cssVars` 注入根元素，主题样式全部基于 CSS 变量，切换主题不需要重新生成 Tailwind 类。

### 8.3 模板覆盖（Halo 级）

主题可在 `templates/` 下按页面放置模板，存在即覆盖系统内置渲染，解析由 `lib/theme/templates.ts` 完成（esbuild 运行时编译为 CJS，mtime 缓存；失败回退内置模板）。

| 模板名 | 对应页面 | 主要 Props / 插槽 |
|--------|----------|------------------|
| `layout` | 整体壳 | `site`、`menus`、`header`、`sidebar`、`footer`、`footerNodes`、`children` |
| `home` | 首页 | `site`、`posts`、`total`、`slots.posts` |
| `post-list` | 博客列表 | `posts`、`page`、`totalPages`、`slots.list`、`slots.pagination` |
| `post` | 文章详情（`post-detail` 兼容） | `post`、`html`、`commentsCount`、`slots.tocMobile/tocDesktop/comments/contentBlocks` |
| `page` | 独立页面 | `page`、`slots.contentBlocks` |
| `archive` | 归档 | `total`、`years[]` |
| `categories` / `category` | 分类列表 / 详情 | `categories[]`；`category`、`posts`、`slots.list` |
| `tags` / `tag` | 标签列表 / 详情 | `tags[]`；`tag`、`posts`、`slots.list` |
| `search` | 搜索 | `query`、`results[]`、`slots.form` |
| `moments` / `moment` | 说说列表 / 详情 | `moments[]`、`slots.list`；`moment`、`prev`、`next`、`slots.lightbox` |
| `links` | 友链 | `links[]`、`slots.list` |
| `gallery` / `photo` | 相册列表 / 详情 | `galleries[]`、`slots.list`；`gallery`、`photos[]`、`slots.grid` |
| `error` | 404 | `status`、`title`、`message` |

插件模板覆盖仍由 `lib/plugin/theme-integration.ts` 处理：主题 `templates/plugins/<pluginSlug>/<name>.tsx` 优先于插件自带模板。

编译采用混合模式：

1. `predev` / `prebuild` 运行 `scripts/generate-theme-registry.js`，把已安装主题的 `templates/*.tsx` 静态 import 进 `lib/theme/generated-templates.ts`，模板按普通 Next 模块编译，**支持 `@/` 别名与 `'use client'`**。
2. 新安装、尚未重启的主题不在注册表，`lib/theme/templates.ts` 回退运行时 esbuild 编译（仅服务端 TSX）；重启后自动升级。

交互区块仍由宿主以 `props.slots` 提供（目录、评论表单、分页、灯箱等），主题可以直接复用，也可以用客户端组件自行实现。整体壳模板可重排 Header/Sidebar/Footer，但三者本身仍由宿主渲染，保证移动端菜单、主题切换等交互不丢。

### 8.4 安装与预览

- ZIP/GZip 安装：与插件共用 `lib/ext-installer.ts`
- Git 安装：`/api/console/themes/git-install`，受 `allowThemeGitInstall` 控制
- 在线预览：`/preview?theme=<slug>`，目标主题提供 `home.tsx` 时直接按该主题渲染，否则回退默认首页；**不使用 cookie 强制全站动态化**
- 主题静态资源：`app/themes/[slug]/[...path]` 动态读取 `scripts/themes`，不复制到 `public`

***

## 九、Markdown 渲染

### 9.1 管线顺序

`lib/markdown/processor.ts` 按站点开关构建 unified 管线，并按开关组合缓存实例：

````
remark-parse
→ remark-gfm
→ remark-math
→ [remark-wiki-link]           enableWikiLink
→ remark-directive
→ remarkAdmonitions            :::note / :::tip / :::code-group
→ remarkDiagrams               Mermaid/PlantUML 占位
→ remarkCodeTitles             ```ts title="a.ts"
→ [remark-sectionize]          enableSectionize
→ remark-rehype (allowDangerousHtml)
→ rehype-raw
→ rehype-katex
→ rehype-slug
→ rehype-autolink-headings
→ rehype-expressive-code       异步高亮：行号、折叠、复制按钮
→ [rehype-callouts]            enableCallouts（> [!NOTE]）
→ rehypeDiagrams               还原 Mermaid <pre> / PlantUML <img>
→ rehypeCodeGroups             codeTabGroup
→ [rehypeFigures]              enableFigure
→ rehype-external-links
→ [rehypeEmailProtection]      enableEmailProtection
→ rehype-stringify
````

选型原因：`react-markdown` 不支持异步 rehype 插件，Expressive Code 会崩，因此正文统一走服务端 unified。

### 9.2 语法能力

| 能力       | 写法                            | 开关                      |
| -------- | ----------------------------- | ----------------------- |
| Callout  | `> [!NOTE]` / `[!TIP]`        | `enableCallouts`        |
| 指令容器     | `:::tip 标题` / `:::warning`    | 始终可用                    |
| 代码分组     | `:::code-group` 或相邻代码块 ≥2     | `codeTabGroup`          |
| 代码标题     | ` ```ts title="src/a.ts" `    | `codeTabGroup`          |
| 数学       | `$...$` / `$$...$$`           | `enableMath`            |
| 双链       | `[[页面名]]` → `/pages/...`      | `enableWikiLink`        |
| 图片图注     | 独占段落图片 + alt → `figure`       | `enableFigure`          |
| Mermaid  | ` ```mermaid `                | `enableMermaid`         |
| PlantUML | ` ```plantuml ` / ` ```puml ` | `enablePlantuml`        |
| 邮箱保护     | 自动混淆为 `[at]` / `[dot]`        | `enableEmailProtection` |
| 章节切分     | 标题自动包 `<section>`             | `enableSectionize`      |

### 9.3 阅读时间与评论

- `lib/markdown/reading-time.ts`：中英混排估算阅读分钟数
- `lib/markdown/comment.ts`：`renderCommentMarkdown()` 使用严格白名单清洗，防止评论 XSS
- 正文不做 sanitize（Expressive Code 的内联样式/脚本、KaTeX、callout 结构会被误删）

### 9.4 样式

`app/globals.css` 覆盖 `.markdown-body` 下的标题、表格、`.callout`、`.admonition`、`.code-group`、`.markdown-figure`、`pre.mermaid`、`img.plantuml`、`a.wiki-link` 等。

***

## 十、前台

### 10.1 路由

| 路由                                                  | 说明          |
| --------------------------------------------------- | ----------- |
| `/`                                                 | 首页          |
| `/blog`、`/blog/[slug]`、`/blog/tag/[name]`           | 文章列表、详情、按标签 |
| `/archive`                                          | 归档          |
| `/categories`、`/categories/[slug]`                  | 分类          |
| `/tags`                                             | 标签          |
| `/moments`、`/moments/[id]`                          | 说说          |
| `/links`                                            | 友链          |
| `/gallery`、`/gallery/[slug]`                        | 相册          |
| `/pages/[slug]`                                     | 独立页面（可选侧边栏） |
| `/p/[...path]`                                      | 插件注册的前台路由   |
| `/search`                                           | 全文搜索        |
| `/preview?theme=<slug>`                             | 主题在线预览      |
| `/signin`、`/register`、`/forgot-password`、`/profile` | 认证与个人中心     |
| `/themes/[slug]/[...path]`                          | 主题静态资源      |
| `/robots.txt`、`/sitemap.xml`、`/rss.xml`、`/atom.xml` | SEO 与订阅     |

### 10.2 渲染策略

| 页面                      | 策略                            |
| ----------------------- | ----------------------------- |
| 首页、文章列表、归档、分类、标签、友链、相册列表、说说列表 | ISR，`revalidate = 300`        |
| 文章详情、相册详情、说说详情、独立页面 | ISR，`revalidate = 600`        |
| 搜索、主题预览、个人中心、插件前台路由 | 动态                            |
| 后台                      | 动态（`/console/*`）              |
| 布局                      | `revalidate = 3600`（含导航/站点信息） |

`next.config.ts` 将客户端 `staleTimes` 压到 20 秒，后台改动前台能较快可见。

### 10.3 SEO

- 页面级 `generateMetadata` 从数据库读取标题/描述/OG
- 文章详情输出 `BlogPosting` JSON-LD
- `app/robots.ts`、`app/sitemap.ts` 动态生成
- RSS 由 `rss-feed` 插件提供，`next.config.ts` 把 `/rss.xml`、`/atom.xml` 重写到插件 API
- 插件可通过 `onGenerateMetadata` 用 `firstWins` 覆盖 metadata

### 10.4 评论

- 必须登录后评论；未登录显示登录引导
- 新评论状态为 `PENDING`，后台审核后 `APPROVED` 才展示
- `Comment` 保存 IP、UA 与插件表单字段 `extra`
- 插件可替换整个评论组件（`getCommentWidgetHtml`）或注入额外字段（`injectCommentField`）
- 支持 `commentSubjectRef` 展示评论来源

### 10.5 搜索

- 默认 `searchProvider`：`lib/search/default-provider.ts`，SQLite FTS5
- FTS 虚拟表与同步触发器由 `scripts/init-fts.js` / `db:init` 创建
- 插件注册 `searchProvider` 后第一个提供者生效，可替换为 Meilisearch 等

***

## 十一、后台

### 11.1 页面

| 分组   | 路由                                                                                  |
| ---- | ----------------------------------------------------------------------------------- |
| 仪表盘  | `/console`                                                                          |
| 内容   | `/console/posts`、`pages`、`categories`、`tags`、`comments`、`gallery`、`moments`、`links` |
| 附件   | `/console/attachments`                                                              |
| 外观   | `/console/system/themes`、`/console/system/themes/[slug]/settings`                   |
| 系统   | `/console/system/settings`、`users`、`roles`、`plugins`、`menu`                         |
| 工具   | `/console/tools/backup`、`tools/cache`、`tools/stats`                                 |
| 插件页面 | `/console/plugin-ext/[slug]/[[...path]]`（`adminRoutes`）                             |

### 11.2 插件注入位置

| 位置                          | 扩展点                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| 文章/页面/插件列表加列                | `postListItemField`、`pageListItemField`、`pluginListItemField`                                           |
| 各行操作按钮                      | `*ListItemOperation`                                                                                    |
| 插件详情、主题列表、附件选择、安装页、备份页、用户详情 | `pluginDetailTab`、`themeListTab`、`attachmentSelectorTab`、`pluginInstallTab`、`backupTab`、`userDetailTab` |
| 仪表盘卡片 / 快捷操作                | `dashboardWidget`、`dashboardQuickAction`                                                                |
| 编辑器工具按钮                     | `editorCreate`（`MilkdownEditor` 调 `/api/plugin/editor-actions`）                                         |
| 后台独立页面                      | `adminRoutes`                                                                                           |

### 11.3 编辑器

- Milkdown 可视化编辑器，Markdown 存储
- 插件 `editorCreate` 返回 `{ label, icon, insert, wrap, shortcut }`，宿主渲染为工具栏按钮
- 图片上传走 `/api/upload`，可被 `attachmentStorage` 接管

***

## 十二、访问统计

### 12.1 写入链路

```
前端 sendBeacon('/api/analytics/pv')
  → Route Handler 立即 enqueuePageView() 并返回 204
  → 进程内队列（最多 10000 条）
  → 100ms 或满 50 条触发 flush
  → analytics.pageView.createMany()
  → OnlineVisitor.upsert()
```

失败批次会回队重试；进程退出前尝试 flush。统计库不可用时只丢统计，不影响业务请求。

### 12.2 聚合与在线人数

- `startAnalyticsScheduler()`：每分钟执行增量聚合（水位线去重），每 30 分钟对两个库执行 WAL checkpoint，进程退出前再合并一次
- 在线人数 SSE：`/api/analytics/online`，需登录，每 5 秒推送最近 5 分钟去重 session 数，单连接最长 30 分钟
- GeoIP：`lib/analytics/geo.ts` 优先读 `CF-IPCountry` / `X-Vercel-IP-Country` / `X-Country-Code`；可选动态加载 `geoip-lite`；内网 IP 跳过
- 访客 IP 来源由 `ipSource` 控制（auto/direct/custom）

***

## 十三、备份、定时任务与运维

### 13.1 备份

```
db/backups/<YYYYMMDD-HHmmss>/
├─ blog.db
├─ analytics.db
├─ plugins-db/*.db
├─ plugins-json/*
└─ meta.json      { name, createdAt, type, size, files, version }
```

- 使用 better-sqlite3 `backup()` 在线备份，包含 WAL 未合并数据；完成后删除目标库残留 `-wal/-shm/-journal`
- 备份名白名单校验，防路径穿越
- 恢复：`/api/console/backup/restore`（仅 `*` 管理员），接受单个 `.db` 或备份 zip，上限 200MB；校验 SQLite 文件头后覆盖，刷新前台缓存并提示重启进程
- 自动备份：`autoBackupCron`（5 段 cron）+ `autoBackupKeep`（默认保留 7 份），调度器监听配置变化自动重建任务
- 支持打包下载

### 13.2 定时任务

| 任务   | 触发                                        | 说明                                |
| ---- | ----------------------------------------- | --------------------------------- |
| 定时发布 | 进程内每分钟                                    | 把到点的 `SCHEDULED` 文章改为 `PUBLISHED` |
| 统计聚合 | 进程内每分钟 / 每 30 分钟                          | 每分钟增量聚合；每 30 分钟 WAL checkpoint      |
| 自动备份 | `autoBackupCron`                          | 由 `startBackupScheduler` 管理       |
| 外部触发 | `/api/cron/publish`、`/api/cron/analytics` | Bearer `CRON_SECRET`；未配置则不校验      |

### 13.3 缓存与维护工具

`/console/tools/cache` + `/api/console/cache`：

- 重置文章浏览量
- 删除并重建 FTS5 索引
- 刷新 ISR / 页面缓存
- 一键全部执行

### 13.4 部署

| 方式     | 文件                           | 要点                                                                                      |
| ------ | ---------------------------- | --------------------------------------------------------------------------------------- |
| Docker | `Dockerfile`、`.dockerignore` | 多阶段构建；挂载 `db/`、`public/uploads/`、`scripts/`                                             |
| PM2    | `ecosystem.config.js`        | **fork 单实例**，不能 cluster                                                                 |
| Nginx  | `deploy/nginx.conf`          | 反代、静态缓存、SSE 关闭 `proxy_buffering`、长连接超时                                                  |
| Vercel | `vercel.json`                | cron 调 `/api/cron/publish`（每分钟）与 `/api/cron/analytics`（每天 03:00）；SQLite 需换 Turso/libSQL |

***

## 十四、环境变量

代码直接读取的变量：

| 变量                                | 必需  | 用途                               |
| --------------------------------- | --- | -------------------------------- |
| `DATABASE_URL`                    | 是   | 主库，默认 `file:../db/blog.db`       |
| `ANALYTICS_DATABASE_URL`          | 是   | 统计库，默认 `file:../db/analytics.db` |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | 是   | NextAuth JWT 签名                  |
| `NEXTAUTH_URL`                    | 部署时 | 站点绝对地址                           |
| `AUTH_TRUST_HOST`                 | 反代时 | 信任 Host 头                        |
| `CRON_SECRET`                     | 可选  | `/api/cron/*` 的 Bearer 校验；为空则不校验 |
| `EXT_DEV_TOKEN`                   | 仅开发 | `ext dev` 热更新联调，生产删除             |

`NODE_ENV`、`NEXT_RUNTIME`、`NEXT_PHASE` 由 Next.js 注入，用于跳过构建期启动任务。

***

## 十五、扩展开发工作流

```
RainyNest_Dev/
├─ packages/types/          @rainynest/plugin-types 源码
├─ packages/plugins/        示例插件（含 announcement-bar）
├─ tools/ext-cli/           ext CLI：模板、校验、打包
└─ PLUGIN_THEME_PLAN.md     扩展开发计划与规范
```

**类型包发布流程**

```bash
cd RainyNest_Dev/packages/types
npm version patch --no-git-tag-version
npm run build
npm publish --registry=https://registry.npmjs.org --access public
```

主项目随后升级：

```bash
npm install @rainynest/plugin-types@<version> --registry=https://registry.npmjs.org
```

**插件开发流程**

1. `ext new plugin <name>` / `ext new theme <name>` 生成模板工程
2. `ext build <srcDir>` 编译为安装态产物（内部自动 `validateManifest` 校验）
3. `ext pack <distDir>` 打包为 `*.zip.rainy-plugin` / `*.zip.rainy-theme`
4. 后台上传安装，或 `ext dev <srcDir> --site <url>` 热更新（需 `EXT_DEV_TOKEN`）
5. 安装后由 `bootPlugins()` 加载，按扩展点生效

***

## 十六、已知边界与约束

| 项                                                        | 现状                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 部署形态                                                     | 单实例；SQLite 写锁 + 插件独立库不适合多副本                                                      |
| `commentEditorReplace` / `commentListItemContentReplace` | 已接入前台：编辑器与逐条评论正文由插件组件预渲染，渲染失败回退内置实现；输出为服务端静态 HTML，不含水合交互        |
| `apiMiddleware`                                          | 仅接入 8 个公开接口，后台与其余路由未覆盖                                                           |
| 正文安全                                                     | 文章 HTML 不做白名单清洗，仅管理员可写；评论走严格清洗                                                   |
| Mermaid / PlantUML                                       | Mermaid 走 CDN 按需加载；PlantUML 依赖公共 SVG 服务                                          |
| 原生模块                                                     | `better-sqlite3`、`bcryptjs` 等在 `serverExternalPackages` 中排除打包，Docker 需匹配 Node 版本 |
| 主题模板                                                     | 构建期注册表优先（支持 `@/` 与 `'use client'`），新装未重启时回退运行时 esbuild（仅服务端）                 |
| FTS5                                                     | 依赖 SQLite 编译选项；初始化失败时搜索降级                                                        |

***

## 十七、附录：API 一览

### 公开接口

`/api/posts`、`/api/posts/[id]`、`/api/posts/preview`、`/api/pages`、`/api/pages/[id]`、`/api/comments`、`/api/comments/[id]`、`/api/categories`、`/api/categories/[id]`、`/api/tags`、`/api/tags/[id]`、`/api/tags/merge`、`/api/links`、`/api/links/[id]`、`/api/gallery`、`/api/gallery/[id]`、`/api/moments`、`/api/moments/[id]`、`/api/menu`、`/api/menu/[id]`、`/api/upload`、`/api/analytics/pv`、`/api/plugin/[...path]`、`/api/plugin/editor-actions`

### 认证

`/api/auth/[...nextauth]`、`/api/auth/register`、`/api/auth/email-code`、`/api/auth/forgot-password`、`/api/auth/reset-password`、`/api/profile`、`/api/profile/sessions`

### 后台

`/api/console/posts`、`pages`、`comments`、`categories`、`tags`、`links`、`gallery`、`moments`、`menu`、`users`、`users/[id]/sessions`、`roles`、`roles/[id]`、`settings`、`settings/test-smtp`、`plugins`（含 install/activate/deactivate/config）、`themes`（含 install/git-install/activate/config/preview）、`attachments`、`stats`、`stats/detailed`、`backup`、`backup/restore`、`cache`、`extensions/dev-install`、`plugin-nav`、`plugin-widgets`

### 运维

`/api/cron/publish`、`/api/cron/analytics`、`/api/analytics/online`（SSE）

***

> 文档版本：v3.0
> 更新日期：2026-11-20
> 对应代码：`rainynest@1.0.0`，SPI `@rainynest/plugin-types@0.3.2`
