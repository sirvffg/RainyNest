# RainyNest 插件 & 主题 API 手册

> 本文档基于 `@rainynest/plugin-types` v1.0.0 和 `lib/theme.ts` 实际实现生成

---

## 第一部分：插件 API

### 1. 插件目录结构

```
scripts/plugins/<slug>/
├── plugin.json              # 元数据（必填）
├── index.js                 # 入口（ES module，default 导出一个工厂函数）
├── config.json              # 默认配置（可选，首次安装时复制到 db/plugins-json/）
├── templates/               # 插件自带的默认模板（可选）
│   └── <name>.tsx
└── ...                      # 其他资源文件
```

### 2. plugin.json 字段

```jsonc
{
  "slug": "my-plugin",              // 必填，唯一标识
  "name": "我的插件",                // 必填，展示名
  "version": "1.0.0",               // 必填，语义化版本
  "description": "功能说明",          // 可选
  "author": "作者",                  // 可选
  "entry": "index.ts",              // 可选，入口文件，默认 index.ts
  "permissions": [                   // 可选，向 RBAC 注册新权限
    { "name": "plugin.myplugin.manage", "displayName": "管理我的插件", "group": "我的插件" }
  ],
  "roleTemplates": [                // 可选，提供预设角色
    { "name": "myplugin-admin", "displayName": "我的插件管理员", "permissions": ["plugin.myplugin.manage"] }
  ],
  "database": {                      // 可选，声明需要独立 SQLite
    "enabled": true,
    "migrations": [
      { "version": "1.0.0", "description": "初始化表", "file": "migrations/1.0.0.sql" }
    ]
  },
  "configSchema": {}                 // 可选，后台配置表单 schema
}
```

### 3. 插件入口

```ts
export default function myPlugin(ctx: PluginContext): ExtensionHandlers {
  // 启动逻辑写在这里
  ctx.logger.info('插件加载成功');

  return {
    // 扩展点实现（可选，见下）
  };
}
```

---

### 4. PluginContext — 宿主注入的上下文对象

插件加载时由引擎构造，包含所有可用资源。

| 字段 | 类型 | 说明 |
|------|------|------|
| `ctx.db` | `HostPrismaClient` | **主数据库**（Prisma 客户端），包含 Post、Category、Tag、Comment、Page 等全部业务表 |
| `ctx.analytics` | `HostPrismaClient` | **独立访问数据库**（Prisma），包含 PageView、Visit 等统计表 |
| `ctx.pluginDb` | `PluginDatabase` | **插件独立 SQLite**（懒加载，只有访问时才创建文件），see §5 |
| `ctx.pluginJson` | `PluginJsonStore` | **插件 JSON 运行数据**（`db/plugins-json/<slug>.run.json`），see §6 |
| `ctx.config` | `Record<string, any>` | **插件配置**（`db/plugins-json/<slug>.config.json` 的当前值） |
| `ctx.site` | `HostSiteSetting` | **站点设置**（title、description、keywords 等） |
| `ctx.slug` | `string` | 插件自身 slug |
| `ctx.version` | `string` | 插件自身版本号 |
| `ctx.env` | `Record<string, string \| undefined>` | `process.env` 环境变量 |
| `ctx.logger` | `PluginLogger` | 日志工具（带统一前缀 `[Plugin:<slug>]`） |
| `ctx.emitEvent` | `(name: string, data: unknown) => void` | 进程内事件总线（发布-订阅） |

#### PluginDatabase — 插件独立 SQLite

```ts
interface PluginDatabase {
  prepare(sql: string): PluginDbStatement;   // 预编译语句
  exec(sql: string): unknown;                // 执行 DDL/DML
  pragma(source: string, options?: unknown): unknown;
}

interface PluginDbStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;        // 查一行
  all(...params: unknown[]): unknown[];      // 查多行
}
```

#### PluginJsonStore — JSON 文件存储

```ts
interface PluginJsonStore {
  get(): Promise<Record<string, any>>;                                    // 读整个文件
  set(patch: Record<string, any>): Promise<Record<string, any>>;          // 浅合并写入
  replace(data: Record<string, any>): Promise<void>;                     // 整体覆盖
}
```

#### HostPrismaClient — 主数据库模型速查

引擎启动时会扫描 Prisma schema 把所有模型挂到 `ctx.db` 上，典型可用模型：

| 模型 | 说明 |
|------|------|
| `ctx.db.post` | 博客文章 |
| `ctx.db.category` | 分类 |
| `ctx.db.tag` | 标签 |
| `ctx.db.comment` | 评论 |
| `ctx.db.page` | 独立页面 |
| `ctx.db.saying` | 说说 |
| `ctx.db.gallery` / `ctx.db.photo` | 相册 & 照片 |
| `ctx.db.friendLink` | 友链 |
| `ctx.db.menu` | 菜单 |
| `ctx.db.user` / `ctx.db.role` / `ctx.db.permission` | 用户系统 |
| `ctx.db.plugin` | 插件记录 |
| `ctx.db.theme` | 主题记录 |
| `ctx.db.siteSetting` | 站点设置 |
| `ctx.db.backupRecord` | 备份记录 |
| `ctx.db.email` | 邮件记录 |

`ctx.analytics` 上有：`pageView`、`visit` 等统计表。

---

### 5. 扩展点（ExtensionHandlers）

插件入口返回的对象可以实现以下扩展点。按功能分组：

#### 5.1 生命周期

| 扩展点 | 签名 | 说明 |
|--------|------|------|
| `onMount` | `(ctx) => void \| Promise<void>` | 所有插件加载完毕后依次调用，做一次性初始化 |

#### 5.2 文章相关

| 扩展点 | 签名 | 说明 |
|--------|------|------|
| `beforeSavePost` | `(post, meta) => void \| Promise<void>` | 文章保存前拦截，可通过 `meta.patch` 修改待写字段 |
| `afterSavePost` | `(post) => void \| Promise<void>` | 文章保存后回调 |
| `beforeDeletePost` | `(postId) => void \| Promise<void>` | 文章删除前拦截 |
| `onGenerateMetadata` | `({ metadata, post }) => Record<string, unknown>` | 生成/覆盖文章元数据（OG、Twitter Card 等） |
| `onRenderMarkdown` | `(content: string) => string \| Promise<string>` | **Markdown 渲染管线**，在统一 renderer 之前/之后处理 HTML 字符串 |
| `excerptGenerator` | `(content: string, length: number) => string \| Promise<string>` | 自定义摘要生成算法（覆盖默认截断） |

#### 5.3 评论相关

| 扩展点 | 签名 | 说明 |
|--------|------|------|
| `beforeCommentApprove` | `(comment) => 'PENDING' \| 'APPROVED' \| 'REJECTED' \| void` | 评论审核拦截，返回值决定审核状态 |

`beforeCommentApprove` 的 comment 参数：

```ts
{
  postId: string;
  userId: string;
  content: string;
  parentId?: string | null;
  ip?: string;
  userAgent?: string;
}
```

#### 5.4 页面浏览

| 扩展点 | 签名 | 说明 |
|--------|------|------|
| `onPageView` | `({ path, ip, sessionId }) => void \| Promise<void>` | 每次 PV 事件触发（sendBeacon → 内存队列 → 批量 flush 时触发） |

#### 5.5 头部/底部注入

| 扩展点 | 签名 | 说明 |
|--------|------|------|
| `injectHead` | `() => (string \| ReactNode)[]` | 注入 `<head>` 内（追加 `<script>`、`<meta>` 等） |
| `injectFooter` | `() => (string \| ReactNode)[]` | 注入页面底部 |

#### 5.6 内容注入（组件型）

| 扩展点 | 返回 | 说明 |
|--------|------|------|
| `injectPostContent` | `ComponentType[]` | 文章详情页底部追加块（每个组件独立渲染为 HTML） |
| `injectCommentWidget` | `ComponentType \| null` | 替换默认评论组件（**第一个**返回非 null 的插件生效） |

#### 5.7 后台 UI 扩展

| 扩展点 | 返回 | 说明 |
|--------|------|------|
| `dashboardWidget` | `DashboardWidgetDef[]` | 仪表盘卡片 |
| `injectSidebarWidget` | `SidebarWidgetDef[]` | 前台侧栏小组件（按 order 排序） |
| `postListItemOperation` | `ListItemOperationDef[]` | 后台文章列表每行追加操作按钮 |
| `customAdminRoutes` | `AdminRouteDef[]` | 后台自定义页面（自动挂到 `/console/plugin-ext/<slug>/...`） |
| `customFrontendRoutes` | `FrontendRouteDef[]` | 前台自定义页面 |
| `customApi` | `CustomApiRouteDef[]` | 自定义 API 路由（直接接入 Next.js Request handler） |

#### 5.8 搜索

| 扩展点 | 返回 | 说明 |
|--------|------|------|
| `searchProvider` | `SearchProvider` | 整体替换搜索实现（**第一个**启用的插件生效） |

```ts
interface SearchProvider {
  name: string;
  builtIn?: boolean;
  search: (query: string, options?: { limit?: number; offset?: number }) => Promise<SearchResult[]>;
}
interface SearchResult {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  snippet: string;
  score: number;
}
```

---

### 6. 自定义路由定义

#### AdminRouteDef — 后台页面

```ts
interface AdminRouteDef {
  path: string;                                    // 路由片段，如 "my-feature"
  title: string;                                   // 菜单显示名
  icon?: string;                                   // Lucide 图标名
  group?: string;                                  // 归入的侧栏分组（默认 "插件"）
  hideSidebar?: boolean;                           // 是否隐藏侧栏
  component: () => Promise<{ default: ComponentType }>;  // 异步加载组件
}
```

#### FrontendRouteDef — 前台页面

```ts
interface FrontendRouteDef {
  path: string;                                    // 路径片段
  title: string;
  ssr?: boolean;                                   // 是否 SSR
  component: () => Promise<{ default: ComponentType }>;
}
```

#### CustomApiRouteDef — API 路由

```ts
interface CustomApiRouteDef {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;                                    // 如 "/api/my-plugin/xxx"
  handler: (req: Request) => Promise<Response>;
  auth: boolean;                                   // 是否要求登录
}
```

---

### 7. 宿主侧辅助函数（非插件 SPI，但插件实现中常用）

宿主不暴露这些 API 给插件，但插件可以通过 `ctx.db` / `ctx.pluginDb` / `ctx.pluginJson` 实现同等能力。以下是引擎内部导出的工具，供宿主核心代码使用：

| 函数 | 文件 | 说明 |
|------|------|------|
| `bootPlugins()` | `lib/plugin/engine.ts` | 扫描 + 加载所有启用插件 + 执行 onMount |
| `fireExtensionPoint(point, ...args)` | 同上 | 触发函数型扩展点，返回所有插件结果数组 |
| `firstWins(point, ...args)` | 同上 | 触发扩展点，取第一个有效返回值（覆盖类场景） |
| `getPluginSearchProvider()` | 同上 | 获取 searchProvider（对象型扩展点） |
| `getPluginSidebarWidgets()` | 同上 | 获取 injectSidebarWidget（收集所有 + 排序） |
| `getPluginFrontendRoutes()` | 同上 | 获取 customFrontendRoutes |
| `getLoadedPlugins()` | 同上 | 获取当前已加载插件列表（只读） |
| `getPluginNavItems()` | `lib/plugin/admin.ts` | 汇总 customAdminRoutes 为后台侧栏菜单 |
| `collectInjectFooter()` | `lib/plugin/ui.ts` | 收集 injectFooter 结果 |
| `collectPostContentHtml()` | 同上 | 收集 injectPostContent，统一渲染为 HTML 字符串 |
| `getCommentWidgetHtml()` | 同上 | 获取 injectCommentWidget 渲染结果 |
| `collectDashboardWidgets()` | 同上 | 收集 dashboardWidget 并渲染 |
| `collectPostOperations()` | 同上 | 收集 postListItemOperation |
| `resolvePluginTemplate(pluginSlug, templateName)` | `lib/plugin/theme-integration.ts` | 主题优先解析插件模板（先查主题覆盖 → 回退插件自带） |

---

## 第二部分：主题 API

### 1. 主题目录结构

```
scripts/themes/<slug>/
├── theme.json                    # 元数据 + 配置 schema（必填）
├── theme.js                      # 配置 → CSS 变量映射（可选）
├── templates/                    # 主题覆盖的前台页面模板（可选）
│   ├── post-detail.tsx
│   ├── sidebar.tsx
│   └── plugins/<pluginSlug>/     # 覆盖插件模板（Halo 风格"主题优先"）
│       └── my-widget.tsx
├── assets/                       # 静态资源
│   ├── main.css
│   └── ...
└── components/                   # 主题自带组件（可选）
    └── ...
```

### 2. theme.json 字段

```jsonc
{
  "slug": "default",
  "name": "默认主题",
  "version": "1.0.0",
  "description": "RainyNest 内置默认主题",
  "author": "RainyNest Team",
  "preview": "/themes/default/preview.png",
  "minRainyNestVersion": "1.0.0",
  "supports": ["dark-mode", "custom-css"],
  "configSchema": {
    "colors": {
      "label": "配色",
      "fields": {
        "primary": { "label": "主色", "type": "color", "default": "#3b82f6" },
        "accent":  { "label": "强调色", "type": "color", "default": "#8b5cf6" }
      }
    },
    "layout": {
      "label": "布局",
      "fields": {
        "sidebarPosition": { "label": "侧栏位置", "type": "select", "options": ["left", "right"], "default": "right" }
      }
    },
    "advanced": {
      "label": "高级",
      "fields": {
        "customCss": { "label": "自定义 CSS", "type": "textarea", "default": "" },
        "customJs":  { "label": "自定义 JS",  "type": "textarea", "default": "" }
      }
    }
  }
}
```

### 3. theme.js — 配置到 CSS 变量的映射

可选模块，当主题需要把用户配置（configSchema 中的字段）转换为注入到 `<html>` 上的 CSS 变量时提供：

```js
// scripts/themes/<slug>/theme.js
module.exports = {
  configToCssVariables(config) {
    return {
      '--rn-color-primary': config.colors?.primary ?? '#3b82f6',
      '--rn-color-accent':  config.colors?.accent  ?? '#8b5cf6',
      '--rn-sidebar-pos':   config.layout?.sidebarPosition ?? 'right',
      '--rn-font-body':     config.typography?.body ?? 'HarmonyOS Sans, system-ui, sans-serif',
    };
  },
};
```

宿主启动时会：
1. 从 DB 读当前激活主题（`Theme.isActive = true`）
2. 合并 `theme.json` 的 configSchema 默认值 + DB 存储的用户值
3. 调 `configToCssVariables(mergedConfig)` 生成 `cssVars`
4. 注入到 `<html style="...">` + `<head>` 里

### 4. 宿主侧主题 API（lib/theme.ts 导出）

| 函数 | 说明 |
|------|------|
| `scanInstalledThemes()` | 扫描 `scripts/themes/` 下所有主题，返回 ThemeMeta[] |
| `getActiveTheme()` | 获取当前激活主题（带 30 秒进程内缓存），返回 ActiveTheme \| null |
| `clearThemeCache()` | 清空主题缓存（切换主题 / 改配置后调用） |
| `mergeWithDefault(schema, userConfig)` | 辅助：schema 默认值 + 用户配置合并 |

```ts
interface ThemeMeta {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  preview?: string;
  minRainyNestVersion?: string;
  supports: string[];
  configSchema: Record<string, any>;
}

interface ActiveTheme extends ThemeMeta {
  dbId: string;                       // 数据库记录 id
  config: Record<string, any>;        // 合并后的完整配置
  cssVars: Record<string, string>;    // 已转成 CSS 变量
  customCss?: string;                 // 用户自定义 CSS
  customJs?: string;                  // 用户自定义 JS
}
```

### 5. 主题覆盖插件模板（theme-integration.ts）

Halo 风格「主题优先」设计：主题可以选择性覆盖任何插件的默认 UI 模板。

```
scripts/themes/<themeSlug>/templates/plugins/<pluginSlug>/<name>.tsx
                                         ↓ 优先查找
scripts/plugins/<pluginSlug>/templates/<name>.tsx
                                         ↓ 回退
```

宿主侧调用：

```ts
import { resolvePluginTemplate } from '@/lib/plugin/theme-integration';
const mod = await resolvePluginTemplate('page-views', 'stats-card');
// 主题覆盖存在 → 返回主题的 tsx 模块
// 否则 → 返回插件自带的 tsx 模块
// 都没有 → 返回 null
```

### 6. 主题与插件协作示意

```
┌─────────────────────────────────────────────────────┐
│                   RainyNest 宿主                      │
│                                                       │
│  getActiveTheme() → cssVars → 注入 <html style>       │
│  collectInjectFooter() → 插件结果 → 注入页面底部       │
│  resolvePluginTemplate('page-views', 'card')          │
│    → 主题覆盖存在? ── YES ── import 主题模板          │
│    →                 NO  ── import 插件自带模板        │
└─────────────────────────────────────────────────────┘
   ▲ 主题通过 CSS 变量控制视觉
   │
   │   插件通过 ExtensionHandlers 扩展行为
   └─────────────────────────────────────────────────────┘
```

---

## 附录：完整扩展点速查表

| 扩展点 | 类型 | 触发方式 | 覆盖策略 |
|--------|------|---------|---------|
| `onMount` | 生命周期 | 所有插件加载后依次调用 | - |
| `beforeSavePost` | 拦截器 | 文章保存前 | - |
| `afterSavePost` | 回调 | 文章保存后 | - |
| `beforeDeletePost` | 拦截器 | 文章删除前 | - |
| `onGenerateMetadata` | 生成器 | 渲染前生成 meta | 聚合合并 |
| `onRenderMarkdown` | 管线 | Markdown → HTML | 依次处理 |
| `excerptGenerator` | 生成器 | 生成摘要 | **first wins** |
| `beforeCommentApprove` | 审核器 | 评论提交后 | - |
| `onPageView` | 事件 | 每次 PV | - |
| `injectHead` | 注入 | `<head>` 内 | 聚合 |
| `injectFooter` | 注入 | 页面底部 | 聚合 |
| `injectPostContent` | 组件 | 文章详情底部 | 聚合渲染 |
| `injectCommentWidget` | 组件 | 评论区 | **first wins** |
| `dashboardWidget` | 组件 | 后台仪表盘 | 聚合渲染 |
| `injectSidebarWidget` | 组件 | 前台侧栏 | 聚合 + order 排序 |
| `postListItemOperation` | 定义 | 后台文章列表行 | 聚合 |
| `customAdminRoutes` | 定义 | 后台菜单 + 页面 | 聚合挂载 |
| `customFrontendRoutes` | 定义 | 前台页面 | 聚合挂载 |
| `customApi` | 定义 | API 路由 | 聚合挂载 |
| `searchProvider` | 对象 | 搜索调用 | **first wins** |
