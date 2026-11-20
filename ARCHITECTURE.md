# RainyNest 博客系统架构文档 v2.2

> **Next.js 15 (App Router) + React 19 + TypeScript + Prisma + SQLite**
> 参考 NovaCMS 的插件/主题架构，仿 Halo/WordPress 的主题切换体验
> 核心目标：**SEO 友好 + 插件系统 + 主题可切换 + 轻量部署**
>
> **实现状态（2026-11-20）**：文中规划的功能已落地，运行时目录、扩展点、数据模型与部署文件的最终口径见 [第十五节 · 实现状态对齐](#十五实现状态对齐2026-11-20)。与本文早期设计不一致处，以第十五节为准。

***

## 一、技术栈

| 分类           | 技术                                   | 说明                                                                                                                     |
| ------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 运行时          | **Node.js 20+**                      | 不是 Node.js 15，是运行 Next.js 15 的底层引擎，最低要求 20 LTS                                                                         |
| 框架           | **Next.js 15**                       | App Router, RSC, Metadata API, ISR                                                                                     |
| UI 库         | **React 19**                         | Server Components, Actions                                                                                             |
| 语言           | **TypeScript 5**                     | 全量类型安全                                                                                                                 |
| 样式           | **Tailwind CSS 3**                   | 主题系统基于 Tailwind CSS Variables 实现                                                                                       |
| ORM          | **Prisma 5**                         | SQLite 驱动，自动迁移                                                                                                         |
| 数据库          | **SQLite 3**                         | 单文件，零配置                                                                                                                |
| 认证           | **NextAuth.js 5**                    | Credentials Provider（邮箱+密码）                                                                                            |
| Markdown     | **unified + Expressive Code**        | 完整移植 Firefly v6.16.9 技术栈：服务端 unified 管线（remark/rehype，含 KaTeX/Callouts/代码分组/Admonition/Figure/双链/邮箱保护）+ Expressive Code 代码高亮（行号/折叠/复制按钮/Mermaid/PlantUML） |
| Markdown 编辑器 | **Milkdown** 或 **Tiptap**            | 后台可视化编辑器（可插拔）                                                                                                          |
| 校验           | **Zod**                              | API 请求体校验、插件配置校验                                                                                                       |
| 图标           | **lucide-react**                     | 后台和前台通用                                                                                                                |

***

## 二、目录结构（按你要求的分区）

```
rainynest/
│
├── app/                                 # Next.js App Router（所有页面和 API 都在这）
│   ├── layout.tsx                       # 根布局：注入全局 Provider、主题变量、SEO 元数据
│   ├── globals.css                      # Tailwind 入口 + CSS 变量（主题色在此动态切换）
│   │
│   ├── web/                             # 前台公开页面（对应你说的 /web 目录）
│   │   ├── layout.tsx                   # 前台布局：Header + Main + Sidebar + Footer
│   │   ├── page.tsx                     # 首页（SSG + ISR）
│   │   ├── blog/
│   │   │   ├── page.tsx                 # 博客文章列表（分页、筛选）
│   │   │   ├── [slug]/
│   │   │   │   ├── page.tsx             # 文章详情（SSG + Metadata + JSON-LD）
│   │   │   │   └── loading.tsx          # 骨架屏
│   │   │   └── tag/[name]/page.tsx      # 标签筛选
│   │   ├── categories/[slug]/page.tsx   # 分类筛选
│   │   ├── archive/page.tsx             # 时间轴归档
│   │   ├── moments/
│   │   │   ├── page.tsx                 # 说说列表
│   │   │   └── [id]/page.tsx            # 说说详情
│   │   ├── gallery/
│   │   │   ├── page.tsx                 # 相册列表
│   │   │   └── [slug]/page.tsx          # 相册详情（瀑布流）
│   │   ├── links/page.tsx               # 友链页面
│   │   ├── pages/[slug]/page.tsx        # 独立页面（关于、隐私等）
│   │   ├── tags/page.tsx                # 所有标签
│   │   └── robots.ts                    # 动态生成 robots.txt
│   │
│   ├── console/                         # 后台管理（对应你说的 /console 目录）
│   │   ├── layout.tsx                   # 后台布局：侧边栏 + 顶栏（Client Component，需要交互）
│   │   ├── page.tsx                     # 仪表盘（总览：文章数/评论数/浏览量/实时在线）
│   │   │
│   │   ├── posts/
│   │   │   ├── page.tsx                 # 文章列表（搜索/筛选/草稿/已发布）
│   │   │   ├── new/page.tsx             # 新建文章（Markdown 编辑器）
│   │   │   └── [id]/edit/page.tsx       # 编辑文章
│   │   │
│   │   ├── categories/page.tsx          # 分类管理
│   │   ├── tags/page.tsx                # 标签管理
│   │   ├── comments/page.tsx            # 评论管理（待审核/已通过）
│   │   ├── pages/
│   │   │   ├── page.tsx                 # 独立页面列表
│   │   │   └── new/page.tsx             # 新建独立页面
│   │   ├── moments/page.tsx             # 说说管理
│   │   ├── gallery/
│   │   │   ├── page.tsx                 # 相册列表
│   │   │   └── [slug]/edit/page.tsx     # 编辑相册/上传照片
│   │   │
│   │   ├── system/
│   │   │   ├── settings/page.tsx        # 系统配置（站点信息、SEO、SMTP、开关等）
│   │   │   ├── menu/page.tsx            # 菜单管理（拖拽排序）
│   │   │   ├── users/page.tsx           # 用户管理
│   │   │   ├── themes/page.tsx          # 主题管理（安装/切换/预览/卸载）
│   │   │   └── plugins/page.tsx         # 插件管理（安装/启用/禁用/卸载/配置）
│   │   │
│   │   └── tools/
│   │       ├── stats/page.tsx           # 访问统计（PV/UV/热门文章/来源）
│   │       ├── backup/page.tsx          # 数据库备份/恢复
│   │       └── cache/page.tsx           # 缓存管理（清空 ISR 缓存等）
│   │
│   ├── api/                             # REST API（对应你说的 /api 目录）
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── register/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── session/route.ts
│   │   ├── posts/
│   │   │   ├── route.ts                 # GET 列表 / POST 创建
│   │   │   └── [id]/route.ts            # GET / PUT / DELETE
│   │   ├── categories/route.ts
│   │   ├── tags/route.ts
│   │   ├── comments/route.ts
│   │   ├── pages/route.ts
│   │   ├── moments/route.ts
│   │   ├── gallery/route.ts
│   │   ├── links/route.ts
│   │   ├── upload/route.ts              # 图片上传
│   │   ├── sitemap.ts                   # Next.js 原生 sitemap
│   │   ├── feed/route.ts                # RSS
│   │   │
│   │   └── console/                     # 后台专属 API（需 Admin 鉴权）
│   │       ├── stats/route.ts
│   │       ├── settings/route.ts
│   │       ├── menu/route.ts
│   │       ├── users/route.ts
│   │       ├── themes/
│   │       │   ├── route.ts             # GET 已安装列表 / POST 安装主题
│   │       │   ├── [id]/activate/route.ts   # 切换激活
│   │       │   └── [id]/config/route.ts     # 主题自定义配置
│   │       ├── plugins/
│   │       │   ├── route.ts             # GET 已安装列表 / POST 安装
│   │       │   ├── [id]/activate/route.ts   # 启用
│   │       │   ├── [id]/deactivate/route.ts # 禁用
│   │       │   └── [id]/config/route.ts     # 插件配置
│   │       └── backup/route.ts          # 数据库备份下载
│   │
│   ├── signin/page.tsx                  # 登录页
│   ├── not-found.tsx                    # 404
│   ├── sitemap.ts                       # 自动生成 sitemap
│   └── robots.ts                        # 动态 robots.txt
│
├── components/                          # 共享组件（对应你说的 /components 目录）
│   ├── layout/                          # 前台布局组件
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── MobileNav.tsx
│   ├── post/
│   │   ├── PostCard.tsx
│   │   ├── PostList.tsx
│   │   ├── PostMeta.tsx
│   │   └── TableOfContents.tsx
│   ├── moments/
│   │   ├── MomentCard.tsx
│   │   └── MomentList.tsx
│   ├── gallery/
│   │   ├── GalleryCard.tsx
│   │   ├── PhotoGrid.tsx
│   │   └── PhotoLightbox.tsx
│   ├── link/
│   │   └── LinkCard.tsx
│   ├── comment/
│   │   ├── CommentList.tsx
│   │   └── CommentForm.tsx
│   ├── markdown/
│   │   ├── MarkdownRenderer.tsx         # 核心：前台 Markdown 渲染组件
│   │   ├── CodeBlock.tsx                # 代码高亮（rehype-pretty-code）
│   │   └── CopyButton.tsx
│   ├── admin/                           # 后台组件
│   │   ├── AdminLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MarkdownEditor.tsx           # Tiptap/Milkdown 编辑器
│   │   ├── ImageUploader.tsx
│   │   ├── StatCard.tsx
│   │   ├── ThemeCard.tsx                # 主题卡片（预览图 + 切换按钮）
│   │   └── PluginCard.tsx               # 插件卡片
│   ├── seo/
│   │   └── JsonLd.tsx
│   └── ui/                              # shadcn/ui 基础组件
│       ├── button.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       └── ...
│
├── vendor/                              # 插件和主题（对应 NovaCMS 的 vendor 模式）
│   ├── themes/                          # 主题目录
│   │   ├── default/                     # 默认主题（随 RainyNest 预装）
│   │   │   ├── theme.json               # 主题元数据
│   │   │   ├── README.md
│   │   │   └── theme.css                # 主题自定义样式变量
│   │   └── {theme-slug}/                # 安装的第三方主题
│   │       ├── theme.json
│   │       └── ...
│   │
│   └── plugins/                         # 插件目录
│       └── {plugin-slug}/               # 每个插件独立目录
│           ├── plugin.json              # 插件元数据（必需）
│           ├── index.ts                 # 插件入口（必需）
│           ├── config.schema.ts         # 插件配置 Zod Schema（可选）
│           └── ...                      # 其他插件文件
│
├── db/                                  # 数据库层（对应你说的 /db 目录）
│   ├── schema.prisma                    # Prisma 数据模型
│   ├── seed.ts                          # 种子数据（admin + 默认主题 + 示例内容）
│   ├── migrations/                      # Prisma 迁移
│   │   └── 20260101000000_init/migration.sql
│   └── blog.db                          # SQLite 文件（.gitignore）
│
├── lib/                                 # 核心库（内部模块，不对外暴露）
│   ├── prisma.ts                        # Prisma Client 单例
│   ├── auth.ts                          # NextAuth 配置
│   ├── site.ts                          # 站点设置读写（带缓存）
│   ├── theme.ts                         # 主题加载器（扫描 vendor/themes，读 theme.json）
│   ├── plugin/                          # 插件系统核心
│   │   ├── registry.ts                  # 插件注册表（扫描 vendor/plugins）
│   │   ├── loader.ts                    # 插件加载器（动态 import）
│   │   ├── hooks.ts                     # 插件钩子系统（beforeSavePost / onMount 等）
│   │   └── types.ts                     # 插件接口定义
│   ├── markdown/
│   │   ├── renderer.tsx                 # Markdown → HTML 渲染函数
│   │   └── syntax-highlight.ts          # 代码高亮配置
│   ├── seo.ts
│   ├── slug.ts
│   ├── constants.ts
│   └── types.ts
│
├── public/                              # 静态资源（对应你说的 /public 工具目录）
│   ├── favicon.ico
│   ├── uploads/                         # 用户上传的图片
│   └── placeholder.svg
│
├── .env                                 # 仅框架敏感配置（3 项）
├── .env.example
├── .gitignore
├── next.config.ts
├── tailwind.config.ts                   # 主题变量配置在此
├── postcss.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

***

## 三、数据库设计（SQLite 双库 + Prisma 多客户端）

### 3.0 双库架构总览

为什么要分？**访问数据是极高写入频率**（每次页面访问都要 INSERT），而主库是高读取频率（文章列表、评论查询、配置读取）。混合在一起会互相拖累。

```
┌──────────────────────────────────────────────────────────────┐
│  RainyNest 数据库架构                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  blog.db（主库，低频写入 / 高频读取）                         │
│  ├── 用户 / 角色 / 权限 / 认证                                │
│  ├── 文章 / 评论 / 分类 / 标签 / 页面 / 说说                  │
│  ├── 相册 / 友链 / 菜单 / 主题 / 插件元数据 / 站点配置         │
│  └── ⚠️ 文章 views 字段 = 缓存值（由 analytics 库定时回填）    │
│                                                              │
│  analytics.db（访问库，高频写入 / 低频读取）                  │
│  ├── PageView（每次访问 INSERT，原始日志）                     │
│  ├── OnlineVisitor（实时在线）                                │
│  ├── DailyStat（日统计聚合表，加速后台仪表盘）                 │
│  └── HourlyStat（小时级聚合，加速趋势图）                      │
│                                                              │
│  ⭐ db/plugins/*.db（插件独立数据库集合，每个插件一个 .db 文件）  │
│  ├── db/plugins/seo-helper.db      ← SEO 助手自己的表        │
│  ├── db/plugins/comment-filter.db  ← 评论过滤器自己的表       │
│  └── db/plugins/xxx.db             ← 插件自己维护的 migration │
│                                                              │
│  lib/prisma.ts      → export const db（主库 Client）          │
│  lib/analytics.ts   → export const analytics（访问库 Client） │
│  lib/plugin-db.ts   → getPluginDb(slug)（原生 SQLite 连接）    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 主库 Schema（`prisma/schema.prisma`）

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════════════════════════
// 用户与权限（完整模仿 Halo RBAC 2.0）
// 核心理念：用户 → 多角色 → 多权限，权限粒度到 API 动作 + UI 元素
// ═══════════════════════════════════════════════════════════

// ========== 用户 ==========
model User {
  id            String     @id @default(cuid())
  username      String     @unique           // 登录用（不可改）
  displayName   String                      // 显示名（可改）
  email         String     @unique
  emailVerified DateTime?                   // 邮箱验证时间
  passwordHash  String?                     // 本地密码，第三方登录的可能没有
  phone         String?
  phoneVerified DateTime?
  avatar        String?
  bio           String?
  description   String?                     // 备注（管理员用）

  // 状态
  status        UserStatus @default(ENABLED)
  loginFailCount Int       @default(0)      // 连续登录失败次数（超过 5 次锁账户）
  lockedUntil   DateTime?                   // 锁定截止时间

  // 时间
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  lastLoginAt   DateTime?
  lastLoginIp   String?

  // 关系
  posts         Post[]
  comments      Comment[]
  roles         UserRole[]                  // ⭐ RBAC：多对多角色

  // 第三方身份绑定（OAuth2/LDAP 等）
  identities    Identity[]

  @@index([username])
  @@index([email])
}

enum UserStatus { ENABLED DISABLED LOCKED }

// ========== ⭐ RBAC 角色 ==========
model Role {
  id              String   @id @default(cuid())
  name            String   @unique          // 角色名（唯一，如 "administrator"）
  displayName     String                    // 显示名（如 "超级管理员"）
  description     String?
  builtIn         Boolean  @default(false)  // 是否内置角色（内置不可删）
  forbidConsole   Boolean  @default(false)  // ⭐ Halo 特性：禁止访问后台 Console（只能进个人中心 UC）

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  users           UserRole[]                // 被分配给哪些用户
  permissions     RolePermission[]          // 拥有哪些权限
  roleTemplateId  String?
  roleTemplate    RoleTemplate? @relation(fields: [roleTemplateId], references: [id])
}

model UserRole {
  userId    String
  roleId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([userId, roleId])
  @@index([roleId])
}

// ========== ⭐ RBAC 权限 ==========
// 权限格式：资源:动作  例如 "post:create" "post:list" "plugin:config"
model Permission {
  id           String   @id @default(cuid())
  name         String   @unique             // 唯一标识，如 "post:create" "console:plugin:config"
  displayName  String                      // 显示名，如 "文章创建"
  group        String                      // 分组，如 "内容" "系统" "插件"
  description  String?

  roles        RolePermission[]
  roleTemplates RoleTemplatePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@id([roleId, permissionId])
  @@index([permissionId])
}

// ========== ⭐ 角色模板（插件可以声明角色模板，Halo 风格）==========
// 插件在 plugin.json 里声明 roleTemplates，安装后自动导入
// 后台可以"基于模板创建角色" → 自动带好权限
model RoleTemplate {
  id           String   @id @default(cuid())
  name         String   @unique             // "role-template-seo-helper-manage"
  displayName  String                      // "SEO 助手管理"
  description  String?
  pluginSlug   String                      // 哪个插件提供的（内置角色模板 slug = "core"）

  // 依赖关系：这个角色模板依赖哪些其他角色模板
  // 例如"文章管理"依赖"文章查看"——权限自动传递
  dependsOn    String?                     // JSON 数组字符串：["role-template-post-view"]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  roles        Role[]                      // 通过此模板创建的角色
  permissions  RoleTemplatePermission[]    // 模板自带的权限
}

model RoleTemplatePermission {
  roleTemplateId String
  permissionId   String
  roleTemplate   RoleTemplate @relation(fields: [roleTemplateId], references: [id], onDelete: Cascade)
  permission     Permission   @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleTemplateId, permissionId])
}

// ========== ⭐ 内置角色（安装时自动生成）==========
// RainyNest 内置的几个角色，插件通过 RoleTemplate 扩展更多
//
// administrator（超级管理员）
//   → 拥有所有权限（在权限检查时特殊处理：admin 直接放行，不逐条检查）
//
// editor（编辑）
//   → post:list/create/update/delete/page:list/create/update/delete
//   → comment:list/approve/reject/delete
//   → media:list/upload/delete
//
// author（作者）
//   → post:list/create（只能改自己的）
//   → comment:list/create
//
// viewer（访客用户）
//   → 登录用户默认角色
//   → forbidConsole = true（只能进前台 + 个人中心 UC）
//
// 插件可以声明 roleTemplates → 后台"基于模板创建角色" → 自动带好权限

// ========== ⭐ 身份认证（可插拔，Halo 风格）==========
// 本地用户名密码是内置的，第三方通过插件扩展
model Identity {
  id            String   @id @default(cuid())
  userId        String
  provider      IdentityProvider           // 认证方式
  identifier    String                     // 第三方唯一标识（GitHub 的 login / Google 的 sub / LDAP 的 uid）
  credential    String?                    // 凭据（如 access_token 的 hash，或 TOTP secret）
  authUrl       String?                    // 第三方认证 URL（OAuth2 用）
  lastUsedAt    DateTime?
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, identifier])
  @@index([userId])
}

enum IdentityProvider {
  PASSWORD          // 本地用户名密码（内置）
  EMAIL_CODE        // 邮箱验证码（内置，需启用）
  PHONE_CODE        // 手机验证码（内置，需启用）
  OAUTH2_GITHUB     // 插件扩展
  OAUTH2_GOOGLE     // 插件扩展
  OAUTH2_WECHAT     // 插件扩展
  LDAP              // 插件扩展
}

// ========== ⭐ 登录会话表 ==========
model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique             // 可以是 JWT 的 jti，或 session cookie 的值
  userAgent    String?
  ip           String?
  device       String?
  lastActiveAt DateTime @default(now())
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([token])
}

// ========== ⭐ 权限系统辅助 ==========
// 权限定义列表（种子数据，内置）
// 格式：资源:动作
//
// 内容：
//   post:list / get / create / update / delete / publish / unpublish
//   page:list / get / create / update / delete
//   category:list / get / create / update / delete
//   tag:list / get / create / update / delete
//   moment:list / get / create / update / delete
//   gallery:list / get / create / update / delete
//   link:list / get / create / update / delete
//   comment:list / get / approve / reject / delete
//   photo:list / upload / delete
//   menu:list / create / update / delete
//
// 用户系统：
//   user:list / create / update / delete / reset-password / assign-role
//   role:list / create / update / delete / assign-permission
//
// 系统：
//   site:config / seo:config / smtp:config / menu:config / theme:activate
//
// 插件/主题：
//   plugin:list / install / uninstall / activate / deactivate / config
//   theme:list / install / uninstall / activate / preview / config
//
// 工具：
//   analytics:view / analytics:export / backup:create / restore:restore
//
// 控制台：
//   console:login（是否允许进后台）
//   uc:login（是否允许进个人中心，所有登录用户都有）
```

### 3.8 Halo 风格用户系统详解

#### 3.8.1 RBAC 权限检查流程

```
请求进入（API 或后台页面）
    ↓
解析 Session → 拿到 userId
    ↓
User.with({ include: { roles: { include: { permissions: true } } } })
    ↓
┌──────────────────────────────────────┐
│  检查 1：超级管理员直接放行             │
│  if (user.roles.some(r => r.name ===  │
│      'administrator')) → ✅ 通过       │
├──────────────────────────────────────┤
│  检查 2：角色是否 forbidConsole        │
│  if (path.startsWith('/console') &&   │
│      user.roles.some(r =>              │
│      r.forbidConsole)) → ❌ 403        │
├──────────────────────────────────────┤
│  检查 3：是否拥有所需权限               │
│  required = "post:create"             │
│  has = user.permissions.some(          │
│    p => p.name === required            │
│  )                                     │
│  if (!has) → ❌ 403 Forbidden          │
└──────────────────────────────────────┘
    ↓
✅ 执行实际业务
```

```ts
// lib/auth/permission.ts — Halo 风格权限检查
import { db } from './prisma';

export async function requirePermission(
  userId: string,
  permission: string | string[],   // 可以是单个权限或权限数组（满足任意一个即可）
  options?: { forbidConsoleCheck?: boolean }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // 1. 加载用户 + 角色 + 权限（一次查询搞定）
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      },
    },
  });

  if (!user) return { ok: false, reason: '用户不存在' };
  if (user.status !== 'ENABLED') return { ok: false, reason: '用户已禁用' };

  // 2. 超级管理员直接放行
  const roleNames = user.roles.map(ur => ur.role.name);
  if (roleNames.includes('administrator')) return { ok: true };

  // 3. 聚合所有权限
  const userPermissionNames = new Set(
    user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name))
  );

  // 4. 检查权限
  const required = Array.isArray(permission) ? permission : [permission];
  const hasAny = required.some(p => userPermissionNames.has(p));

  return hasAny ? { ok: true } : { ok: false, reason: `缺少权限: ${required.join(', ')}` };
}

// 便捷函数：检查是否允许访问后台
export async function canAccessConsole(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });
  if (!user) return false;
  const roleNames = user.roles.map(ur => ur.role.name);
  if (roleNames.includes('administrator')) return true;
  // 只要有一个角色没 forbidConsole 就能进
  return user.roles.some(ur => !ur.role.forbidConsole);
}
```

#### 3.8.2 身份认证可插拔（插件扩展点）

Halo 的身份认证是插件可扩展的。RainyNest 通过 `customAuthProvider` 扩展点实现：

```ts
// 内置：用户名密码认证 + 邮箱验证码认证
// 插件可以注册：OAuth2 GitHub/Google/微信、LDAP、SSO 等

// lib/auth/provider.ts — 认证提供者接口
export interface AuthProvider {
  name: string;                    // "password" / "email-code" / "oauth2-github"
  displayName: string;              // "用户名密码" / "GitHub 登录"
  builtIn: boolean;
  enabled: boolean;                // 后台可以开关
  priority: number;                 // 登录页面显示顺序
  icon?: string;

  // 初始化登录（返回登录 URL 或直接开始验证）
  startLogin(params: { email?: string; password?: string; code?: string } | Record<string, any>): Promise<LoginResult>;

  // 验证回调（OAuth2 回调 URL 走这里）
  callback?(params: { code: string; state?: string }): Promise<LoginResult>;
}

interface LoginResult {
  success: boolean;
  user?: { username?: string; email?: string; displayName?: string; avatar?: string };
  identity?: { provider: IdentityProvider; identifier: string };  // 第三方唯一标识
  error?: string;
  authUrl?: string;                 // OAuth2 用：返回跳转 URL
}
```

```ts
// vendor/plugins/oauth-github/index.ts
// 插件注册一个 GitHub 登录方式
export default function githubOAuthPlugin(ctx: PluginContext): ExtensionHandlers {
  return {
    customAuthProvider: {
      name: 'oauth2-github',
      displayName: 'GitHub',
      builtIn: false,
      enabled: true,
      priority: 10,
      icon: 'github',

      async startLogin() {
        const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${CALLBACK_URL}&scope=user:email`;
        return { success: true, authUrl: url };
      },

      async callback({ code }) {
        // 1. 用 code 换 access_token
        // 2. 用 access_token 调 /user 拿 GitHub 用户信息
        // 3. 查 Identity 表：这个 GitHub 账号绑定了吗？
        //    → 绑定了 → 返回已有用户
        //    → 没绑定但有同 email 的本地用户 → 自动绑定 → 返回
        //    → 没绑定没同 email → 注册新用户（viewer 角色）→ 返回
      },
    },
  };
}
```

#### 3.8.3 角色模板系统（插件声明权限）

```
插件在 plugin.json 里声明 roleTemplates：
{
  "roleTemplates": [
    {
      "name": "role-template-seo-helper-view",
      "displayName": "SEO 助手查看",
      "description": "只能查看 SEO 分析结果",
      "permissions": [
        "plugin:seo-helper:view",
        "analytics:view"
      ]
    },
    {
      "name": "role-template-seo-helper-manage",
      "displayName": "SEO 助手管理",
      "description": "管理 SEO 助手所有功能",
      "dependsOn": ["role-template-seo-helper-view"],  // 自动继承 view 的权限
      "permissions": [
        "plugin:seo-helper:config"
      ]
    }
  ]
}
```

插件安装时自动导入：

```ts
// lib/plugin/installer.ts
async function installPlugin(slug: string) {
  const meta = JSON.parse(fs.readFileSync(pluginJson, 'utf-8'));

  // 1. 注册插件自定义权限
  for (const perm of meta.permissions || []) {
    await db.permission.upsert({ where: { name: perm.name }, update: perm, create: perm });
  }

  // 2. 注册角色模板
  for (const tmpl of meta.roleTemplates || []) {
    await db.roleTemplate.upsert({
      where: { name: tmpl.name },
      update: { ...tmpl, pluginSlug: slug },
      create: { ...tmpl, pluginSlug: slug },
    });
  }
}
```

后台"基于模板创建角色"：

```ts
// 后台角色管理页面
POST /api/console/roles/from-template
{
  "templateId": "xxx",
  "roleName": "内容编辑",
  "roleDisplayName": "内容编辑"
}
// → 自动把模板的权限 + 依赖模板的权限全部绑到新角色上
```

#### 3.8.4 内置角色权限矩阵

| 权限 \ 角色                 | administrator | editor |  author  | viewer（默认，forbidConsole） |
| ----------------------- | :-----------: | :----: | :------: | :----------------------: |
| **所有权限**                |     ✅ 全放行     |    -   |     -    |             -            |
| post:list               |       ✅       |    ✅   | ✅（只能自己的） |             -            |
| post:create             |       ✅       |    ✅   |     ✅    |             -            |
| post:update/delete      |       ✅       |    ✅   | ✅（只能自己的） |             -            |
| post:publish            |       ✅       |    ✅   |     ❌    |             -            |
| page:list/create/update |       ✅       |    ✅   |     ❌    |             -            |
| category/tag:管理         |       ✅       |    ✅   |     ❌    |             -            |
| comment:approve/reject  |       ✅       |    ✅   |     ❌    |             -            |
| media:upload            |       ✅       |    ✅   |     ✅    |             -            |
| user:list/create/update |       ✅       |    ❌   |     ❌    |             -            |
| role:管理                 |       ✅       |    ❌   |     ❌    |             -            |
| site:config             |       ✅       |    ❌   |     ❌    |             -            |
| plugin:install/config   |       ✅       |    ❌   |     ❌    |             -            |
| theme:activate/config   |       ✅       |    ❌   |     ❌    |             -            |
| analytics:view          |       ✅       |    ✅   |     ❌    |             -            |
| console:login           |       ✅       |    ✅   |     ✅    |     ❌（forbidConsole）     |
| uc:login（个人中心）          |       ✅       |    ✅   |     ✅    |             ✅            |

#### 3.8.5 后台用户管理界面（Halo 风格）

```
/console/system/users                    ← 用户列表
┌──────────────────────────────────────────────────────────┐
│  [添加用户]  [批量操作]                  角色管理  身份认证 │
├──────────────────────────────────────────────────────────┤
│  ☑ │ 用户名 │ 显示名 │ 邮箱      │ 角色    │ 状态 │ 操作 │
│  ☑ │ admin  │ 管理员 │ a@x.com   │ 超级管理│ ✅启用│ ···  │
│  ☑ │ editor │ 小编  │ b@x.com   │ 编辑    │ ✅启用│ ···  │
│  ☑ │ jack   │ Jack  │ c@x.com   │ 作者    │ 🔒锁定│ ···  │
└──────────────────────────────────────────────────────────┘

··· 操作菜单：
  ├── 修改资料
  ├── 修改密码
  ├── 分配角色
  ├── 重置密码
  ├── 禁用 / 启用
  └── 删除

/console/system/roles                    ← 角色列表
┌──────────────────────────────────────────────────────────┐
│  [新建角色]  从模板创建 ▾（下拉列出所有 RoleTemplate）       │
├──────────────────────────────────────────────────────────┤
│  角色名     │ 显示名  │ 禁止Console │ 权限数 │ 操作       │
│  admin     │ 超级管理员│     ❌      │  全部  │ ···        │
│  editor    │ 编辑     │     ❌      │   15  │ ··· 基于此创建│
│  author    │ 作者     │     ❌      │    8  │ ···        │
│  viewer    │ 访客用户  │     ✅      │    2  │ ···        │
└──────────────────────────────────────────────────────────┘

角色编辑页：
  Tab 1: 基本信息（名称、显示名、描述、禁止Console勾选）
  Tab 2: 权限（按分组树形勾选：内容 / 用户 / 系统 / 插件 / 工具）
  Tab 3: 成员（哪些用户被分配了这个角色）

/console/system/auth                      ← 身份认证管理
┌──────────────────────────────────────────────────────────┐
│  认证方式        │ 内置/插件 │ 状态  │ 配置 │ 排序手柄 ↕   │
│  用户名密码      │ 内置      │ ✅启用 │ —    │ ≡          │
│  邮箱验证码      │ 内置      │ ❌禁用 │ ⚙️   │ ≡          │
│  GitHub 登录     │ oauth-github│ ✅启用 │ ⚙️   │ ≡          │
│  LDAP            │ 付费插件  │ ❌禁用 │ ⚙️   │ ≡          │
└──────────────────────────────────────────────────────────┘
```

#### 3.8.6 插件扩展点（与用户系统相关）

| 扩展点                                                | 说明                                         |
| -------------------------------------------------- | ------------------------------------------ |
| **`customAuthProvider`**                           | 注册新的身份认证方式（OAuth2/LDAP/SSO）                |
| **`userCreatingHandler`**                          | 用户创建前/后处理器（Halo 同名扩展点）                     |
| **`usernamePasswordAuthManager`**                  | 自定义用户名密码认证逻辑                               |
| **`permissionProvider`**                           | 插件注册自己的权限（install 时 upsert 到 Permission 表） |
| **`roleTemplateProvider`**                         | 插件声明角色模板（plugin.json 里写）                   |
| **`authBeforeFilter`** **/** **`authAfterFilter`** | 认证前后过滤器（Halo Security 前置/后置）               |

#### 3.8.7 默认种子数据

首次启动时自动生成：

```
// 4 个内置角色
INSERT INTO Role (name, displayName, builtIn, forbidConsole) VALUES
  ('administrator', '超级管理员', true, false),
  ('editor', '编辑', true, false),
  ('author', '作者', true, false),
  ('viewer', '访客用户', true, true);

// ~50 个内置权限（资源:动作 格式）
INSERT INTO Permission (name, displayName, "group") VALUES
  ('post:list', '文章列表', '内容'),
  ('post:create', '创建文章', '内容'),
  ('post:update', '更新文章', '内容'),
  ('post:delete', '删除文章', '内容'),
  ('post:publish', '发布文章', '内容'),
  ...;

// 管理员账号（首次初始化向导创建）
INSERT INTO User (username, email, passwordHash) VALUES ('admin', 'admin@rainynest.com', 'xxx');
INSERT INTO UserRole (userId, roleId) VALUES ('admin-id', 'admin-role-id');

// viewer 角色绑定给"使用注册默认角色"配置项
// SiteSetting.defaultRegisterRole = 'viewer'
```

// ========== 文章 ==========
model Post {
id            String     @id @default(cuid())
authorId      String
author        User       @relation(fields: \[authorId], references: \[id])

title         String
slug          String     @unique
summary       String?
content       String     // Markdown 原文
html          String?    // 预渲染 HTML（可选）
coverImage    String?

status        PostStatus @default(DRAFT)
isTop         Boolean    @default(false)
allowComment  Boolean    @default(true)

views         Int        @default(0)    // ⚠️ 缓存值，真实数据在 analytics.db，由定时任务回填
words         Int        @default(0)

categoryId    String?
category      Category?  @relation(fields: \[categoryId], references: \[id])

tags          PostTag\[]
comments      Comment\[]

createdAt     DateTime   @default(now())
updatedAt     DateTime   @updatedAt
publishedAt   DateTime?

@@index(\[status, publishedAt])
@@index(\[slug])
}

enum PostStatus { DRAFT PUBLISHED SCHEDULED }

// ========== 分类 ==========
model Category {
id          String   @id @default(cuid())
name        String   @unique
slug        String   @unique
description String?
posts       Post\[]
}

// ========== 标签 ==========
model Tag {
id    String     @id @default(cuid())
name  String     @unique
slug  String     @unique
posts PostTag\[]
}

model PostTag {
postId String
tagId  String
post   Post   @relation(fields: \[postId], references: \[id], onDelete: Cascade)
tag    Tag    @relation(fields: \[tagId], references: \[id], onDelete: Cascade)
@@id(\[postId, tagId])
}

// ========== 评论 ==========
model Comment {
id        String        @id @default(cuid())
postId    String
userId    String
parentId  String?
content   String
status    CommentStatus @default(PENDING)
createdAt DateTime      @default(now())

post      Post          @relation(fields: \[postId], references: \[id], onDelete: Cascade)
user      User          @relation(fields: \[userId], references: \[id])
parent    Comment?      @relation("CommentReplies", fields: \[parentId], references: \[id])
replies   Comment\[]     @relation("CommentReplies")
}
enum CommentStatus { PENDING APPROVED REJECTED }

// ========== 独立页面（关于、隐私等）==========
model Page {
id            String   @id @default(cuid())
title         String
slug          String   @unique
content       String   // Markdown
summary       String?
status        PostStatus @default(PUBLISHED)
order         Int      @default(0)
createdAt     DateTime @default(now())
updatedAt     DateTime @updatedAt
}

// ========== 说说（类似微博/动态）==========
model Moment {
id        String   @id @default(cuid())
userId    String
content   String   // 纯文本或 Markdown（简短）
images    String?  // JSON 数组，存图片 URL
status    PostStatus @default(PUBLISHED)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

user      User     @relation(fields: \[userId], references: \[id])
@@index(\[createdAt])
}

// ========== 相册 ==========
model Gallery {
id          String   @id @default(cuid())
title       String
slug        String   @unique
description String?
coverImage  String?
photos      Photo\[]
status      PostStatus @default(PUBLISHED)
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
}

model Photo {
id        String   @id @default(cuid())
galleryId String
url       String
title     String?
width     Int?
height    Int?
createdAt DateTime @default(now())

gallery   Gallery  @relation(fields: \[galleryId], references: \[id], onDelete: Cascade)
}

// ========== 友链 ==========
model Link {
id        String   @id @default(cuid())
name      String
url       String
logo      String?
description String?
category  String?
order     Int      @default(0)
status    PostStatus @default(PUBLISHED)
createdAt DateTime @default(now())
}

// ========== 菜单（前台导航菜单）==========
model Menu {
id        String   @id @default(cuid())
name      String
url       String
icon      String?
order     Int      @default(0)
parentId  String?
parent    Menu?    @relation("MenuChildren", fields: \[parentId], references: \[id])
children  Menu\[]   @relation("MenuChildren")
createdAt DateTime @default(now())
}

// ========== ⚠️ 浏览量 / 访问日志 已迁移到 analytics.db ==========
// PageView / OnlineVisitor / DailyStat / HourlyStat 见 3.2 节访问库 Schema

// ========== ⭐ 主题管理 ==========
model Theme {
id          String   @id @default(cuid())
slug        String   @unique              // 目录名
name        String
version     String
description String?
author      String?
preview     String?                       // 预览图 URL
isActive    Boolean  @default(false)      // 当前激活主题
config      String?                       // JSON：主题自定义配置值
installedAt DateTime @default(now())
updatedAt   DateTime @updatedAt
}

// ========== ⭐ 插件管理 ==========
model Plugin {
id          String   @id @default(cuid())
slug        String   @unique              // 目录名
name        String
version     String
description String?
author      String?
isActive    Boolean  @default(false)
config      String?                       // JSON：插件配置值
installedAt DateTime @default(now())
updatedAt   DateTime @updatedAt
}

// ========== 站点设置（单例，所有配置放这，后台改）==========
model SiteSetting {
id          String   @id @default("default")

// 基础信息
title       String   @default("RainyNest")
subtitle    String?
description String   @default("一个关于技术与生活的博客")
url         String   @default("<http://localhost:3000>")
logo        String?
favicon     String?
icp         String?
footerText  String?

// SEO
keywords    String?
author      String?
googleVerification String?
baiduVerification  String?

// 社交
githubUrl   String?
twitterUrl  String?
email       String?

// 功能开关
allowRegister Boolean @default(false)
commentModeration Boolean @default(true)
enableRss      Boolean @default(true)
enableSitemap  Boolean @default(true)

// SMTP
smtpHost    String?
smtpPort    Int?
smtpUser    String?
smtpPass    String?
smtpFrom    String?

// 主题默认色（主题切换前的后备）
primaryColor String?   @default("#3b82f6")

createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
}

````

### 3.2 访问库 Schema（`prisma/analytics.prisma`）

> 独立的访问日志数据库，高写入频率。每次页面访问 INSERT 一条 PageView，完全不影响主库。

```prisma
// 注意：文件名不同 = 不同的 Prisma Client
// ⭐ output 指向项目内的 generated 目录（不是 node_modules/.prisma）
// 这样 analytics.ts 里可以用相对路径 import
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma/analytics"
}

datasource analytics {
  provider = "sqlite"
  url      = env("ANALYTICS_DATABASE_URL")
}

// ========== 原始访问日志（高频写入）==========
model PageView {
  id        String   @id @default(cuid())

  path      String                            // 访问路径 /web/blog/xxx
  postId    String?                           // 如果是文章页，记录文章 ID
  referer   String?                           // 来源 URL
  userAgent String?                           // UA
  ip        String?                           // IP（可 hash 存防隐私）
  country   String?                           // 简易地理（可选，GeoIP）
  device    String?                           // mobile / tablet / desktop
  duration  Int?                              // 停留秒数（离开时上报）

  sessionId String?                           // 同一次访问会话的 cookie
  uniqueKey String?                           // 用于 PV 去重（sessionId + path + 日期）

  createdAt DateTime @default(now())

  @@index([path])
  @@index([postId])
  @@index([createdAt])
  @@index([sessionId])
  @@unique([uniqueKey])
}

// ========== 实时在线访客（内存 + SQLite 持久化）==========
model OnlineVisitor {
  id        String   @id @default(cuid())
  sessionId String   @unique                  // 浏览器 cookie 存的 session ID
  ip        String?
  path      String?                           // 当前浏览页面
  userAgent String?
  firstSeen DateTime @default(now())          // 首次出现时间
  lastSeen  DateTime @default(now())          // 最后一次心跳（10 秒内算在线）
}

// ========== 日统计聚合（加速后台仪表盘，由定时任务生成）==========
// 目的：后台仪表盘查今日 PV/UV 不用 GROUP BY 原始日志
model DailyStat {
  id         String   @id @default(cuid())
  date       DateTime @unique                 // 日期（yyyy-mm-dd，用 DateTrunc 存）

  pv         Int      @default(0)             // 当天 PV
  uv         Int      @default(0)             // 当天 UV（按 sessionId 去重）
  newVisitors Int     @default(0)             // 新访客（首次出现）
  avgDuration Float   @default(0)             // 平均停留秒数

  topPath    String?                          // 当天访问最多的路径
  topPathPv  Int      @default(0)

  topPostId  String?                          // 当天访问最多的文章
  topPostPv  Int      @default(0)

  referers   String?                          // JSON：来源 Top 5 {url, count}
  devices    String?                          // JSON：设备分布 {mobile, desktop, tablet}

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// ========== 小时级聚合（后台趋势图用，比原始日志快）==========
model HourlyStat {
  id        String   @id @default(cuid())
  hour      DateTime @unique                  // DateTrunc('hour', createdAt)

  pv        Int      @default(0)
  uv        Int      @default(0)

  @@index([hour])
}

// ========== 文章访问快照明细（用于文章列表排序"最多浏览"）==========
// 和 Post.views（主库的缓存值）配合，主库 views 由这个表定时回填
model PostDailyView {
  id        String   @id @default(cuid())
  postId    String
  date      DateTime
  pv        Int      @default(0)

  @@unique([postId, date])
  @@index([postId])
  @@index([date])
}
````

### 3.3 Prisma 双客户端初始化代码

```ts
// lib/prisma.ts — 主库 Client
import { PrismaClient } from '@prisma/client';

const globalForDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForDb.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForDb.prisma = db;
```

```ts
// lib/analytics.ts — 访问库 Client（独立 schema → 独立 Client）
// ⭐ 关键：从 analytics.prisma 配置的 output 目录 import
// 主库默认 @prisma/client，访问库从项目内 generated 目录
import { PrismaClient as AnalyticsPrismaClient } from '../generated/prisma/analytics/client';

const globalForAnalytics = globalThis as unknown as { analytics?: AnalyticsPrismaClient };
export const analytics = globalForAnalytics.analytics || new AnalyticsPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForAnalytics.analytics = analytics;
```

### 3.4 Prisma 多 Schema 配置

```json
// package.json scripts
{
  "prisma:generate": "prisma generate --schema=prisma/schema.prisma && prisma generate --schema=prisma/analytics.prisma",
  "prisma:migrate:main": "prisma migrate dev --schema=prisma/schema.prisma",
  "prisma:migrate:analytics": "prisma migrate dev --schema=prisma/analytics.prisma",
  "prisma:studio:main": "prisma studio --schema=prisma/schema.prisma",
  "prisma:studio:analytics": "prisma studio --schema=prisma/analytics.prisma"
}
```

### 3.5 目录结构（两个 .db 文件分开放）

```
db/
├── blog.db          # 主库：用户/文章/评论/主题/插件/配置
├── analytics.db     # 访问库：PV日志/在线/聚合
└── migrations/
    ├── main/        # 主库迁移历史
    └── analytics/   # 访问库迁移历史
```

### 3.6 双库数据流

#### 前台读取路径（零延迟，只读主库）

```
┌──────────────────────────────────────────────────────────────┐
│  用户访问 /web/blog/xxx                                       │
│        ↓                                                     │
│  Next.js Server Component（SSG + ISR）                      │
│        ↓                                                     │
│  只读主库：Post + Category + Tag + Menu + SiteSetting        │
│        ↓                                                     │
│  ✅ 不碰 analytics.db（访问库），完全无写锁干扰                 │
│  ✅ 文章浏览量直接读 Post.views 缓存值（定时任务回填）         │
└──────────────────────────────────────────────────────────────┘
```

#### 访问统计写入路径（完全不阻塞前台加载）

```
┌──────────────────────────────────────────────────────────────┐
│  用户浏览器渲染完页面                                        │
│        ↓                                                     │
│  ❌ 不要在 Server Component / API route 里同步 await         │
│     analytics.pageView.create() —— SQLite 写锁会阻塞         │
│     即使是独立 analytics.db 也一样！                          │
│        ↓                                                     │
│  ✅ 正确做法：客户端 sendBeacon + 进程内队列 + 批量写入        │
│                                                              │
│  ① 客户端（Next.js <AnalyticsBeacon /> 组件）                │
│     useEffect → navigator.sendBeacon('/api/analytics/pv', …) │
│     sendBeacon 是异步的，页面卸载也不丢                        │
│     对用户感知完全透明（不阻塞任何交互）                         │
│                                                              │
│  ② API route /api/analytics/pv/route.ts                      │
│     收到 PV → analyticsQueue.enqueue(pvData)                 │
│     立即 return Response.json({ ok: true })                   │
│     ⚡ API 响应 < 5ms（纯内存操作，不碰 SQLite）               │
│                                                              │
│  ③ 进程内队列 + 批量写入（后台 Worker 定时 flush）             │
│     每 100ms 或队列满 50 条                                    │
│     analytics.pageView.createMany({ data: batch })           │
│     analytics.onlineVisitor.upsert(...)                      │
│     ✅ SQLite 写锁只在 flush 时持有 1-5ms                     │
│     ✅ 批量写入减少锁竞争次数                                  │
│     ✅ 前台加载路径完全不经过这里                              │
└──────────────────────────────────────────────────────────────┘
```

#### 后台聚合路径（低频，不影响前台）

```
┌──────────────────────────────────────────────────────────────┐
│  定时聚合任务（每小时一次）                                    │
│        ↓                                                     │
│  从 analytics.db 聚合 PageView GROUP BY postId                │
│        ↓                                                     │
│  批量 UPDATE 主库 Post.views（$transaction）                 │
│        ↓                                                     │
│  同时生成 DailyStat / HourlyStat / PostDailyView 聚合表       │
│        ↓                                                     │
│  清理 30 天前的原始 PageView（可选）                           │
└──────────────────────────────────────────────────────────────┘
```

### 3.6-B ⚠️ 访问统计完全不阻塞前台的实现

#### 为什么不阻塞？

```
❌ 错误路径（当前架构的问题）：
  Server Component render → await analytics.pageView.create()
  → SQLite 写锁阻塞（哪怕 analytics.db 是独立文件）
  → 页面 TTFB（Time To First Byte）被拉长 50-200ms
  → 高并发时甚至超时（写锁排队）

✅ 正确路径：
  客户端 sendBeacon → API route enqueue 入队 → 立即 return
  → SQLite 写入由后台批量 worker 异步完成
  → 前台 TTFB 完全不受影响
```

#### 客户端上报组件

```tsx
// components/analytics/AnalyticsBeacon.tsx
'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';

// 这个组件放在 app/layout.tsx 里，全站自动挂
// sendBeacon 是浏览器原生 API，异步、不阻塞、页面卸载也不丢数据
export default function AnalyticsBeacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 初始化 sessionId（同一浏览器会话内唯一）
    let sessionId = sessionStorage.getItem('sid');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('sid', sessionId);
    }

    const postMatch = pathname.match(/^\/blog\/([^/]+)/);
    const pvData = JSON.stringify({
      path: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''),
      postSlug: postMatch ? postMatch[1] : null,
      sessionId,
      referer: document.referrer || '',
      ua: navigator.userAgent,
      // 注意：客户端拿不到真实 IP，API 层从 x-forwarded-for 取
    });

    // sendBeacon 的数据必须是 Blob 或字符串
    // 生产环境可能被广告拦截插件挡，但我们在 API 层也做兜底
    try {
      navigator.sendBeacon('/api/analytics/pv', new Blob([pvData], { type: 'application/json' }));
    } catch {
      // sendBeacon 不可用时的兜底（用 fetch keepalive）
      fetch('/api/analytics/pv', {
        method: 'POST',
        body: pvData,
        keepalive: true,
        credentials: 'omit',  // 不带 cookie，减少 payload
      }).catch(() => {});  // 静默忽略
    }
  }, [pathname, searchParams]);

  return null;  // 纯副作用组件，不渲染任何东西
}
```

#### API Route（立即响应，不碰 SQLite）

```ts
// app/api/analytics/pv/route.ts
import { NextRequest } from 'next/server';
import { enqueuePageView } from '@/lib/analytics/queue';

export const runtime = 'nodejs';  // 必须 Node Runtime（进程内队列需要常驻）

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // 从请求头取真实 IP（经过反向代理转发的）
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
            || req.headers.get('x-real-ip')
            || req.ip
            || '127.0.0.1';

    // 入队 → 立即返回（不 await 任何 DB 操作）
    enqueuePageView({
      path: data.path,
      postSlug: data.postSlug,
      sessionId: data.sessionId,
      ip,
      userAgent: req.headers.get('user-agent') || data.ua,
      referer: data.referer,
      createdAt: new Date(),
    });

    // ⚡ 这里直接 return，响应时间 < 5ms
    // SQLite 写入完全由后台 worker 负责
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
```

#### 进程内队列 + 批量写入 Worker

```ts
// lib/analytics/queue.ts
// 核心：内存队列 + 定时 flush 到 SQLite
// 进程退出时（SIGTERM/SIGINT）flush 一次，保证不丢数据

import { analytics } from '../analytics';
import { db } from '../prisma';

interface PendingPV {
  path: string;
  postSlug: string | null;
  sessionId: string;
  ip: string;
  userAgent: string;
  referer: string;
  createdAt: Date;
}

// ⭐ 进程级单例队列（模块加载时初始化，整个进程共用）
let queue: PendingPV[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushedAt = 0;

const FLUSH_INTERVAL_MS = 100;   // 每 100ms 刷一次（最多延迟 100ms）
const FLUSH_BATCH_SIZE = 50;     // 或队列满 50 条立即刷
const MAX_QUEUE_SIZE = 10000;    // 队列上限（防内存泄漏，超过丢弃最老的）

// 入队（API route 调这个，同步返回）
export function enqueuePageView(pv: PendingPV) {
  // 队列满了，丢弃最老的（极端情况，比如 SQLite 长时间阻塞）
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  queue.push(pv);

  // 满了立即 flush，不等定时器
  if (queue.length >= FLUSH_BATCH_SIZE) {
    scheduleFlush(0);
  } else if (!flushTimer) {
    // 第一次入队启动定时器（懒启动，没人访问不浪费资源）
    scheduleFlush(FLUSH_INTERVAL_MS);
  }
}

function scheduleFlush(delay: number) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, delay);
}

async function flush() {
  flushTimer = null;
  const batch = queue.splice(0, queue.length);  // 清空队列，拿到当前所有待写
  if (batch.length === 0) return;

  flushedAt = Date.now();

  try {
    // ① 批量写入 PageView
    // analytics.db 是独立文件，SQLite 写锁只在这里短暂持有
    await analytics.pageView.createMany({
      data: batch.map(pv => ({
        path: pv.path,
        postId: pv.postSlug ? await getPostIdBySlug(pv.postSlug) : null,
        sessionId: pv.sessionId,
        ip: pv.ip,
        userAgent: pv.userAgent?.slice(0, 500) || '',   // 限制 UA 长度
        referer: pv.referer?.slice(0, 500) || '',
        createdAt: pv.createdAt,
      })),
      skipDuplicates: true,  // 防止重复（虽然概率极低）
    });

    // ② 批量 upsert OnlineVisitor（也异步，不阻塞）
    // 简单处理：用 analytics.$transaction 包起来
    // 或者更激进地：OnlineVisitor 也走独立队列
    await analytics.$transaction([
      ...batch.reduce((ops, pv) => {
        if (!pv.sessionId) return ops;
        ops.push(
          analytics.onlineVisitor.upsert({
            where: { sessionId: pv.sessionId },
            update: { lastSeen: pv.createdAt, path: pv.path },
            create: {
              sessionId: pv.sessionId,
              ip: pv.ip,
              path: pv.path,
              userAgent: pv.userAgent?.slice(0, 500) || '',
              lastSeen: pv.createdAt,
            },
          })
        );
        return ops;
      }, [] as any[]),
    ]);

    console.log(`[Analytics] ✓ Flushed ${batch.length} PV (took ${Date.now() - flushedAt}ms, queue remaining: ${queue.length})`);
  } catch (err) {
    // SQLite 写锁超时/数据库损坏 → 打日志，但不清空队列（重试）
    console.error(`[Analytics] ✗ Flush failed (${batch.length} items):`, err);
    // 把失败的批次放回队列头部，给下一次 flush 机会
    // 但要防止无限重试占内存
    queue.unshift(...batch);
  }
}

// slug → postId 映射（主库读取，有内存缓存）
// 这个映射需要 PageView.postId 字段是 Int，但 slug 是字符串
// 所以需要先查主库拿到 postId——但查主库是读操作，不阻塞
// 如果 slug → id 不想实时查，可以用 slug 字段直接存 PageView
const slugCache = new Map<string, number>();
async function getPostIdBySlug(slug: string): Promise<number | null> {
  if (slugCache.has(slug)) return slugCache.get(slug)!;
  const post = await db.post.findUnique({ where: { slug }, select: { id: true } });
  if (post) {
    slugCache.set(slug, post.id);
    return post.id;
  }
  return null;
}

// ⭐ 进程退出前 flush 一次（防止丢数据）
// 自托管 PM2/Docker 进程会发 SIGTERM，我们捕获它
if (process.env.NODE_ENV === 'production') {
  const shutdown = async () => {
    if (queue.length > 0) {
      console.log(`[Analytics] Shutdown: flushing ${queue.length} remaining PV...`);
      try { await flush(); } catch {}
    }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
```

#### middleware / Server Component 里绝对不要写 analytics

```ts
// ❌ middleware.ts 里不要写 analytics
export async function middleware(request: NextRequest) {
  // middleware 跑在 Edge Runtime，根本不能 import analytics（Node-only）
  // 而且 middleware 是请求第一道，在这里写 SQLite 会让所有请求变慢
  // ...
}

// ❌ Server Component 里不要写 analytics
export default async function BlogPostPage({ params }) {
  // Server Component 渲染时间 = TTFB 的主要组成
  // 在这里 await analytics.pageView.create() 会直接拖慢首字节
  // ...
}

// ❌ API route 里不要同步 await analytics
export async function GET(req) {
  // 即使是 API route，也应该 enqueue 而不是 await create
  // ...
}
```

#### SQLite 调优（analytics.db 专用）

因为 analytics.db 是高频写入，可以给它加一些 SQLite PRAGMA 优化（启动时设置一次，不需要改连接串）：

```ts
// scripts/init-analytics-db.ts
// analytics.db 初始化时跑这些 PRAGMA（只在 analytics.db 上生效）

import BetterSqlite3 from 'better-sqlite3';

const db = new BetterSqlite3('db/analytics.db');

db.pragma('journal_mode = WAL');     // WAL 模式：读写可以并发（最重要！）
db.pragma('synchronous = NORMAL');   // 牺牲一点点持久性（掉电可能丢最后几条 PV）换速度
db.pragma('busy_timeout = 3000');    // 锁等待 3 秒（兜底，不报错）
db.pragma('cache_size = -64000');    // 64MB 缓存（热点数据在内存）
db.pragma('temp_store = MEMORY');    // 临时表存内存
db.pragma('mmap_size = 268435456');  // 256MB mmap（大文件直接用内存映射）

db.close();

console.log('[Analytics DB] ✓ PRAGMA 优化已应用');
```

> **重点是 WAL 模式**——默认 SQLite 用 DELETE 模式（一个写者阻塞所有读者），WAL（Write-Ahead Logging）模式下**一个写者 + 多个读者可以并发**，只有当 WAL 文件需要 checkpoint（合并回主文件）时才短暂阻塞。对于高频写入的访问库，WAL 模式是必须的。

#### 进程内队列的局限（Serverless）

Vercel / Turso 这类 Serverless 部署下，Next.js 函数实例频繁启停（冷启动），进程内队列**不会持久化**。部署到 Vercel 时，建议：

```
方案 A：接受少量丢 PV（函数冷启动前最后一批可能丢）
  → 足够好了，PV 数据本身就有允许误差

方案 B：把队列换成外部缓冲（Redis / Upstash / KV）
  → enqueuePageView 改成 LPUSH Redis list
  → 定时聚合任务从 Redis list 批量 RPOP 出来写入 SQLite
  → 完全不丢，但多了 Redis 依赖
```

RainyNest 默认支持方案 A（零依赖），如果以后加 Redis 插件可以切换到方案 B。

***

### 3.6-A 定时聚合任务实现（自托管 vs Serverless）

聚合任务（每小时一次）负责：
1. 从 analytics.db 聚合 PageView → 更新主库 Post.views 缓存值
2. 生成 DailyStat / HourlyStat / PostDailyView 聚合表
3. 清理 7 天前的原始 PageView 日志（可选，防止访问库无限膨胀）

#### 方案 A：自托管（PM2 / Docker）—— node-cron

```ts
// lib/analytics/aggregator.ts
// 定时聚合逻辑（纯函数，cron 触发）

import { db } from '../prisma';
import { analytics } from '../analytics';

export async function runHourlyAggregation() {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // ① 回填主库 Post.views
  // 用 analytics.db 的 PageView 数据更新主库缓存
  const pvStats = await analytics.pageView.groupBy({
    by: ['postId'],
    where: { postId: { not: null }, createdAt: { gte: hourAgo } },
    _count: { postId: true },
  });

  for (const stat of pvStats) {
    if (!stat.postId) continue;
    await db.post.update({
      where: { id: stat.postId },
      data: { views: { increment: stat._count.postId } },
    });
  }

  // ② 生成/更新 HourlyStat
  await analytics.hourlyStat.upsert({
    where: { hour: now },
    update: {
      pv: { increment: await analytics.pageView.count({ where: { createdAt: { gte: hourAgo } } }) },
      uv: await analytics.pageView.count({ distinct: ['sessionId'] as any, where: { createdAt: { gte: hourAgo } } }),
    },
    create: {
      hour: now,
      pv: await analytics.pageView.count({ where: { createdAt: { gte: hourAgo } } }),
      uv: 0,
    },
  });

  // ③ 每天 0 点跑一次 DailyStat 全量聚合 + 清理老数据
  if (now.getHours() === 0) {
    await runDailyAggregation();
  }
}

export async function runDailyAggregation() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const tomorrow = new Date(yesterday);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 聚合昨天一天的数据写入 DailyStat
  // ...

  // 清理 30 天前的原始 PageView（可选，保留聚合表）
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  await analytics.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
```

```ts
// lib/analytics/scheduler.ts
// 自托管：用 node-cron 在 Next.js 进程里常驻调度
// ⚠️ 只在自托管模式启用（多实例部署需要分布式锁）

import cron from 'node-cron';
import { runHourlyAggregation } from './aggregator';

// 标记是否已初始化（防止热重载时重复注册）
let initialized = false;

export function startAnalyticsScheduler() {
  if (initialized) return;
  initialized = true;

  // 每小时第 5 分钟跑（避开整点高峰）
  cron.schedule('5 * * * *', async () => {
    console.log('[Analytics] Running hourly aggregation...');
    try {
      await runHourlyAggregation();
      console.log('[Analytics] ✓ Aggregation done');
    } catch (err) {
      console.error('[Analytics] ✗ Aggregation failed:', err);
    }
  });

  console.log('[Analytics] Scheduler started (every hour at minute 5)');
}
```

```ts
// app/api/cron/analytics/route.ts
// Next.js 15 Serverless 友好的触发方式（自托管和 Vercel 都能用）
// 自托管：scheduler.ts 每小时内部调用这个
// Vercel：用 Vercel Cron（配置文件）或 GitHub Actions 外部调用

export async function GET() {
  // ⚠️ 安全：需要验证 cron secret（环境变量）
  const authHeader = headers().get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await runHourlyAggregation();
  return Response.json({ success: true });
}
```

#### 方案 B：Vercel + Turso（Serverless）

Node.js 进程不常驻，`node-cron` 没用。用 **Vercel Cron**（在 `vercel.json` 配置）或 **GitHub Actions** 定时 curl 上面那个 `/api/cron/analytics` endpoint。

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/analytics",
      "schedule": "5 * * * *"
    }
  ]
}
```

#### 多实例部署的分布式锁

如果用 Docker + Kubernetes 横向扩容，多个 Next.js 实例会同时触发聚合 → 同一个 PageView 被多次累加。用 analytics.db 的 `_lock` 表做 SQLite 级别的乐观锁：

```sql
-- analytics.db 里建一个简单的锁表
CREATE TABLE IF NOT EXISTS _aggregation_lock (
  lock_name TEXT PRIMARY KEY,
  locked_at DATETIME,
  lock_owner TEXT
);
```

```ts
// 聚合前尝试获取锁，拿到锁的实例才执行
async function tryLock(name: string, owner: string): Promise<boolean> {
  // SQLite INSERT OR IGNORE → 只有第一个成功
  const result = await analytics.$executeRaw`
    INSERT OR IGNORE INTO _aggregation_lock (lock_name, locked_at, lock_owner)
    VALUES (${name}, datetime('now'), ${owner})
  `;
  // RowsAffected === 1 表示成功抢到锁
  return result === 1;
}
```

### 3.7 环境变量更新（4 项）

现在有两个 SQLite 文件，需要两个连接串：

```env
# 主库（业务数据）
DATABASE_URL="file:./db/blog.db"

# 访问库（访问统计）
ANALYTICS_DATABASE_URL="file:./db/analytics.db"

# NextAuth（和之前一样）
NEXTAUTH_SECRET="xxx"
NEXTAUTH_URL="http://localhost:3000"
```

> **注意**：两个 `datasource` 必须在**两个不同的 .prisma 文件**里。Prisma 不允许同一个 schema 文件里有两个 `datasource sqlite`。

***

## 四、⭐ 插件系统（仿 Halo 扩展点架构）

> 参考：Halo [插件开发者指南](https://docs.halo.run/developer-guide/plugin/introduction) 的核心架构
> 核心理念：**扩展点（Extension Point）** — 核心在固定位置留钩子，插件自由实现，互不冲突

### 4.1 Halo 插件系统核心特点

| Halo 特性                   | RainyNest 实现                                        |
| ------------------------- | --------------------------------------------------- |
| **扩展点（Extension Point）**  | ✅ 核心定义 10+ 扩展点，插件按需实现                               |
| **插件提供独立前台页面**            | ✅ 插件可以注册 `/web/plugins/{slug}/*` 路由                 |
| **主题可覆盖插件模板**             | ✅ 主题 `templates/plugins/{slug}/{page}.tsx` 覆盖插件默认模板 |
| **插件向后台 Console 注入菜单/页面** | ✅ 插件可注册后台路由 `/console/plugins/{slug}/*`             |
| **插件提供 Admin UI 组件**      | ✅ `adminComponent` 动态加载                             |
| **插件 Head 标签注入**          | ✅ `injectHead` 扩展点                                  |
| **自定义 REST API**          | ✅ `api` 扩展点注册路由                                     |
| **Web 过滤器/中间件**           | ✅ `apiMiddleware` 扩展点                               |
| **扩展点冲突管理**               | ✅ 同扩展点多插件实现 → 全部执行（可配优先级）                           |
| **后台一键启用/禁用/配置**          | ✅ Halo 风格的插件管理页                                     |

### 4.2 插件目录规范

```
vendor/plugins/seo-helper/
├── plugin.json              # 必须：元数据
├── index.ts                 # 必须：入口（实现扩展点）
├── config.schema.ts         # 可选：配置 Zod Schema
├── plugin.css               # 可选：注入到前台的样式
├── plugin.client.tsx        # 可选：浏览器端组件（Client Component，会打包进 JS）
├── templates/               # 可选：插件自带的前台页面模板
│   ├── default.tsx          # 插件默认前台页面（主题没覆盖时用这个）
│   └── widget.tsx           # 可嵌入到其他页面的组件
├── pages/                   # 可选：插件独立的前台路由页面
│   └── page.tsx             # → /web/plugins/seo-helper/
├── admin/                   # 可选：插件独立的后台路由页面
│   └── page.tsx             # → /console/plugins/seo-helper/
└── README.md                # 插件说明
```

### 4.2.1 ⭐ 插件独立数据库（每个插件一个 .db 文件）

> 参考 Halo 的 Entity 自动发现机制，但 RainyNest 用 Prisma（schema 静态编译，没法运行时加表）。所以我们给**每个插件分配独立的 SQLite .db 文件**，插件用原生 SQL / better-sqlite3 自己维护表结构。

#### 为什么插件要独立数据库？

```
✅ 数据隔离：插件卸载 = 删 db/plugins/{slug}.db，主库零残留
✅ 插件自由建表：不受主库 Prisma schema 限制
✅ 多团队并行：A 插件改表不影响 B 插件
✅ 性能隔离：插件的高频率写入不拖主库
✅ 版本管理：插件自己的 migration 可以单独控制

❌ 跨库 JOIN 麻烦（但一般插件不跟主库直接 JOIN，而是通过 API/扩展点间接交互）
❌ 不支持跨库外键（SQLite 本身不支持）
```

#### 插件数据库文件结构

```
db/plugins/
├── seo-helper.db           ← SEO 助手独立库（RainyNest 自动创建）
├── comment-filter.db       ← 评论过滤器独立库
└── default-seo.db          ← 内置 default-seo 插件独立库

vendor/plugins/seo-helper/
├── migrations/             ← 插件自己的 migration（RainyNest 插件管理器执行）
│   ├── 0001_init.sql       ← 首次安装时执行（CREATE TABLE ...）
│   ├── 0002_add_score.sql  ← 版本 1.1 升级时执行
│   └── 0003_add_history.sql
├── plugin.json
├── index.ts
└── ...
```

#### plugin.json 里声明自己的数据库

```json
{
  "slug": "seo-helper",
  "version": "1.2.0",

  "database": {
    "enabled": true,                      // 是否需要独立数据库（默认 false）
    "migrations": [
      { "version": "1.0.0", "file": "migrations/0001_init.sql", "description": "初始化" },
      { "version": "1.1.0", "file": "migrations/0002_add_score.sql", "description": "加 SEO 分数字段" },
      { "version": "1.2.0", "file": "migrations/0003_add_history.sql", "description": "加历史记录表" }
    ]
  }
}
```

#### 插件怎么用自己的数据库（通过 PluginContext 暴露）

```ts
// vendor/plugins/seo-helper/index.ts
import type { PluginContext, ExtensionHandlers } from '@/lib/plugin/types';

export default function seoHelperPlugin(ctx: PluginContext): ExtensionHandlers {
  // ⭐ ctx.db = 主库（Prisma Client）—— 读写核心数据（Post/Comment/User...）
  // ⭐ ctx.pluginDb = 插件独立库（better-sqlite3 原生连接）—— 只读写自己的表

  // 1. 用 ctx.db（主库 Prisma）读 RainyNest 的文章数据
  ctx.db.post.findMany({ where: { status: 'PUBLISHED' } });

  // 2. 用 ctx.pluginDb（插件自己的 SQLite）存插件专属数据
  // 原生 SQL，插件想建什么表就建什么表，完全自由
  ctx.pluginDb.prepare(`
    CREATE TABLE IF NOT EXISTS seo_scores (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      suggestions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  ctx.pluginDb.prepare(`
    INSERT INTO seo_scores (id, post_id, score, suggestions)
    VALUES (?, ?, ?, ?)
  `).run(cuid(), postId, score, JSON.stringify(suggestions));

  ctx.pluginDb.prepare(`
    SELECT post_id, score FROM seo_scores ORDER BY score ASC LIMIT 10
  `).all();

  return {
    // ... 扩展点实现
  };
}
```

#### PluginContext 完整接口（含三个数据库）

```ts
// lib/plugin/types.ts
interface PluginContext {
  // RainyNest 核心
  db: PrismaClient;                          // ⭐ 主库：读写 Post/User/Comment 等核心数据
  analytics: AnalyticsPrismaClient;           // ⭐ 访问库：读写 PageView/DailyStat 等
  pluginDb: Database;                         // ⭐ 插件独立库（better-sqlite3 原生连接）

  // 插件自己的元数据
  slug: string;
  version: string;
  config: Record<string, any>;                // 插件在后台的配置（JSON）

  // RainyNest 全局
  site: SiteSetting;                          // 站点配置（缓存值）
  env: Record<string, string>;               // 环境变量（插件只读）

  // 工具
  logger: PluginLogger;                       // 带插件前缀的日志
  emitEvent: (name: string, data: any) => void;
}
```

#### 原生 SQLite 连接封装（better-sqlite3）

```ts
// lib/plugin-db.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const PLUGIN_DB_DIR = path.join(process.cwd(), 'db', 'plugins');

// 缓存所有已打开的插件数据库连接（避免重复打开）
const dbCache = new Map<string, Database.Database>();

export function getPluginDb(slug: string): Database.Database {
  // 1. 缓存命中直接返回
  if (dbCache.has(slug)) return dbCache.get(slug)!;

  // 2. 确保 db/plugins/ 目录存在
  fs.mkdirSync(PLUGIN_DB_DIR, { recursive: true });

  // 3. 打开（不存在会自动创建）
  const dbPath = path.join(PLUGIN_DB_DIR, `${slug}.db`);
  const db = new Database(dbPath);

  // 4. 开启 WAL 模式（SQLite 最佳实践：并发读写不锁）
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 5. 缓存
  dbCache.set(slug, db);
  return db;
}

// 关闭所有插件数据库连接（进程退出时调用）
export function closeAllPluginDbs() {
  for (const [slug, db] of dbCache) {
    db.close();
    console.log(`[Plugin-DB] Closed ${slug}.db`);
  }
  dbCache.clear();
}
```

#### 插件 migration 执行器（安装/升级时自动跑）

```ts
// lib/plugin/migrator.ts
// RainyNest 插件管理器会在"安装"或"升级"时执行插件声明的 migration SQL

import fs from 'node:fs';
import path from 'node:path';
import { getPluginDb } from './plugin-db';

const PLUGINS_DIR = path.join(process.cwd(), 'vendor', 'plugins');
const MIGRATIONS_TABLE = '_rn_migrations';

// 确保每个插件 db 里有迁移记录表
function ensureMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version TEXT PRIMARY KEY,
      description TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      checksum TEXT
    );
  `);
}

export async function runPluginMigrations(slug: string, pluginJson: any) {
  if (!pluginJson.database?.enabled) return;
  if (!pluginJson.database?.migrations?.length) return;

  const db = getPluginDb(slug);
  ensureMigrationsTable(db);

  // 找出已经执行过的版本
  const applied = new Set(
    db.prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`)
      .all()
      .map((row: any) => row.version)
  );

  const pluginDir = path.join(PLUGINS_DIR, slug);

  // 按声明顺序执行未应用的 migration
  for (const mig of pluginJson.database.migrations) {
    if (applied.has(mig.version)) continue;

    const sqlPath = path.join(pluginDir, mig.file);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`[Plugin] ${slug} migration ${sqlPath} not found, skip`);
      continue;
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // 在事务里执行（失败回滚）
    const transaction = db.transaction(() => {
      db.exec(sql);
      db.prepare(`
        INSERT INTO ${MIGRATIONS_TABLE} (version, description, checksum)
        VALUES (?, ?, ?)
      `).run(mig.version, mig.description || '', checksum(sql));
    });

    try {
      transaction();
      console.log(`[Plugin] ${slug} applied migration ${mig.version} - ${mig.description}`);
    } catch (err) {
      console.error(`[Plugin] ${slug} migration ${mig.version} FAILED:`, err);
      throw err;  // 让安装/升级流程知道失败了
    }
  }
}

function checksum(str: string): string {
  // 简单的 checksum（Node 内置 crypto）
  return require('crypto').createHash('sha1').update(str).digest('hex');
}
```

#### migration SQL 示例

```sql
-- vendor/plugins/seo-helper/migrations/0001_init.sql

-- SEO 分数历史表
CREATE TABLE IF NOT EXISTS seo_scores (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  suggestions TEXT,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES _rn_ignore(post_id)  -- 注释：关联主库文章（没有外键，靠应用层维护）
);

CREATE INDEX IF NOT EXISTS idx_seo_scores_post ON seo_scores(post_id);
CREATE INDEX IF NOT EXISTS idx_seo_scores_score ON seo_scores(score);

-- 关键词追踪（插件自己的功能）
CREATE TABLE IF NOT EXISTS keyword_tracking (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  target_url TEXT,
  position INTEGER,
  last_checked DATETIME
);
```

#### 插件数据库生命周期

```
安装插件：
  1. 解压 ZIP → vendor/plugins/{slug}/
  2. 读 plugin.json → 发现 database.enabled = true
  3. getPluginDb(slug) → 自动创建 db/plugins/{slug}.db
  4. runPluginMigrations → 执行 migrations/*.sql
  5. 写入 blog.db 的 Plugin 表（enabled = true）
  ✅ 完成

升级插件：
  1. 覆盖 vendor/plugins/{slug}/ 新版本
  2. 读 plugin.json 里的 migrations 数组（可能新增了版本）
  3. runPluginMigrations → 跳过已执行的版本，只跑新的
  ✅ 向后兼容

启用插件：
  1. blog.db.Plugin.isActive = true
  2. fireExtensionPoint('onMount') → 插件通过 ctx.db / ctx.analytics / ctx.pluginDb 使用三个库

禁用插件：
  1. blog.db.Plugin.isActive = false
  2. 扩展点不再触发，插件 DB 还在（数据保留）

卸载插件：
  1. 删除 blog.db 里的 Plugin 记录
  2. ⚠️ 询问用户：是否同时删除 db/plugins/{slug}.db？（默认保留数据）
  3. fs.rmrf vendor/plugins/{slug}/
  4. 用户确认后 fs.unlinkSync db/plugins/{slug}.db
  ✅ 零残留
```

#### 三个数据库的边界

```
插件可以用三个数据库，但用途不同：

blog.db（主库 Prisma）
  ✅ 插件可以读：Post / Page / Comment / Category / Tag / User / SiteSetting
  ✅ 插件可以写（通过扩展点拦截）：修改 Post 内容、拦截 Comment 等
  ❌ 插件不能直接操作 Role / Permission / Theme / Plugin 表（安全隔离）

analytics.db（访问库 Prisma）
  ✅ 插件可以读：PageView / DailyStat / HourlyStat（做图表、热门文章等）
  ✅ 插件可以写：PageView（如果插件想补充 PV 记录）
  ❌ 插件不能改 OnlineVisitor 表结构

插件独立库（原生 SQLite）
  ✅ 完全自由：想建什么表建什么表，想怎么设计怎么设计
  ✅ 插件自己维护 migration
  ❌ 不能直接 JOIN blog.db 或 analytics.db（不同 .db 文件，SQLite 不支持）
  → 需要跨库数据：插件先从 ctx.db 读主库数据，再和自己的表数据在应用层合并
```

***

```json
{
  "slug": "seo-helper",
  "name": "SEO 助手",
  "version": "1.0.0",
  "description": "自动为文章生成 meta description、结构化数据、关键词",
  "author": "RainyNest Team",
  "homepage": "https://github.com/xxx/seo-helper",
  "icon": "icon.svg",
  "license": "MIT",

  "minRainyNestVersion": "1.0.0",
  "engines": { "node": ">=20.0.0" },

  "configSchema": {
    "group1": {
      "label": "基础设置",
      "fields": {
        "autoSummary": { "type": "boolean", "default": true, "label": "自动生成摘要" },
        "maxSummaryLength": { "type": "number", "default": 160, "min": 50, "max": 300 }
      }
    }
  },

  "extensionPoints": [
    "onMount",
    "beforeSavePost",
    "onGenerateMetadata",
    "injectHead"
  ],

  "apiRoutes": [
    { "method": "GET", "path": "/api/plugin/seo-helper/analyze", "auth": false }
  ],

  "adminRoutes": [
    { "path": "/console/plugins/seo-helper", "title": "SEO 助手", "icon": "search" }
  ],

  "frontendRoutes": [
    { "path": "/web/plugins/seo-helper", "title": "SEO 检测" }
  ],

  "providesTemplates": ["default"],

  "requires": {
    "rainynest": "^1.0.0"
  }
}
```

### 4.4 扩展点完整列表（RainyNest SPI，1:1 对齐 Halo 真实能力）

#### 服务端扩展点（Server-Side，共 15 个）

| 扩展点                      | 触发时机              | Halo 对应扩展点              | 我们的签名                                       |
| ------------------------ | ----------------- | ----------------------- | ------------------------------------------- |
| **`onMount`**            | RainyNest 启动时     | Plugin Entry            | `(ctx: PluginContext) => void`              |
| **`beforeSavePost`**     | 文章保存前             | BeforeSaveHandler       | `(post, meta) => void \| meta.patch`        |
| **`afterSavePost`**      | 文章保存后             | AfterSaveHandler        | `(post) => void`                            |
| **`beforeDeletePost`**   | 文章删除前             | BeforeDeleteHandler     | `(postId, meta) => void`                    |
| **`onGenerateMetadata`** | 页面生成 SEO metadata | TemplateHeadProcessor   | `({ metadata, post }) => Partial<Metadata>` |
| **`onRenderMarkdown`**   | Markdown 渲染前预处理   | MarkdownPostProcessor   | `(content) => string`                       |
| **`excerptGenerator`**   | 摘要生成（替代默认）        | ExcerptGenerator        | `(content, length) => string`               |
| **`injectHead`**         | HTML `<head>` 生成时 | TemplateHeadProcessor   | `() => ReactNode[] \| string[]`             |
| **`injectFooter`**       | HTML Footer 区域    | TemplateFooterProcessor | `() => ReactNode[] \| string[]`             |
| **`apiMiddleware`**      | 所有 API 请求前        | AdditionalWebFilter     | `(req, next) => Response \| void`           |
| **`customApi`**          | 注册自定义 REST API    | AdditionalWebFilter     | `RouteDef[]`                                |
| **`searchProvider`**     | 搜索引擎（可替默认）        | SearchEngine            | `SearchProvider`                            |
| **`attachmentStorage`**  | 附件存储（可替默认）        | AttachmentStorage       | `AttachmentProvider`                        |
| **`notifier`**           | 通知器（邮件/Webhook 等） | Notifier                | `Notifier`                                  |
| **`onPageView`**         | 每次 PV             | -（RainyNest 新增）         | `({ path, ip }) => void`                    |

#### 主题端扩展点（前台 UI 注入，共 8 个）

插件通过这些扩展点向主题前台页面注入 UI 组件——**主题可以覆盖插件模板，但核心扩展点由 RainyNest 核心管理**。

| 扩展点                           | 触发时机        | Halo 对应                  | 说明                                             |
| ----------------------------- | ----------- | ------------------------ | ---------------------------------------------- |
| **`providesTemplates`**       | 插件声明可被覆盖的模板 | Plugin Template Override | 主题 `templates/plugins/{slug}/{name}.tsx` 优先    |
| **`injectSidebarWidget`**     | 侧边栏渲染时      | SidebarWidget            | 返回 React 组件类，多个插件全部显示                          |
| **`injectHeaderAction`**      | 顶栏导航区       | HeaderAction             | 返回按钮/链接组件                                      |
| **`injectPostContent`**       | 文章详情页底部     | PostContentProcessor     | 追加内容到文末（相关文章/上一篇等）                             |
| **`injectSinglePageContent`** | 独立页面底部      | SinglePageContent        | 追加内容到 Page 类型页面底部                              |
| **`injectCommentWidget`**     | 评论区域        | CommentWidget            | 可替换默认评论组件（接入第三方评论）                             |
| **`injectCommentField`**      | 评论表单内       | -（RainyNest 新增）          | 加额外字段（验证码、昵称等）                                 |
| **`customFrontendRoutes`**    | 注册独立前台页面    | Theme Integration        | `FrontendRouteDef[]` → `/web/plugins/{slug}/*` |

#### 后台 Console UI 扩展点（管理后台注入，共 20+ 个，完整对齐 Halo UI SPI）

Halo 的插件后台 UI 是**细颗粒度注入**——不是注册整页面，而是向现有页面的具体位置注入组件。RainyNest 1:1 复刻这些扩展点：

##### 仪表盘

| 扩展点                        | 注入位置     | Halo 对应                                                       | 说明                |
| -------------------------- | -------- | ------------------------------------------------------------- | ----------------- |
| **`dashboardWidget`**      | 仪表盘小部件区  | `console:dashboard:widgets:create`                            | 返回卡片组件（访客数、今日评论等） |
| **`dashboardQuickAction`** | 仪表盘快捷操作区 | `console:dashboard:widgets:internal:quick-action:item:create` | 返回快捷入口按钮          |

##### 列表页操作菜单（文章/评论/附件/主题/插件 等）

Halo 插件可以在后台数据列表的每一行**追加自己的操作按钮**（比如 SEO 检测、一键生成摘要）：

| 扩展点                               | 列表          | Halo 对应                                  |
| --------------------------------- | ----------- | ---------------------------------------- |
| **`postListItemOperation`**       | 文章列表每行加操作按钮 | `post-list-item-operation-create`        |
| **`pageListItemOperation`**       | 独立页面列表加操作按钮 | `single-page-list-item-operation-create` |
| **`commentListItemOperation`**    | 评论列表加操作按钮   | `comment-list-item-operation-create`     |
| **`replyListItemOperation`**      | 回复列表加操作按钮   | `reply-list-item-operation-create`       |
| **`pluginListItemOperation`**     | 插件列表加操作按钮   | `plugin-list-item-operation-create`      |
| **`themeListItemOperation`**      | 主题列表加操作按钮   | `theme-list-item-operation-create`       |
| **`attachmentListItemOperation`** | 附件列表加操作按钮   | `attachment-list-item-operation-create`  |
| **`backupListItemOperation`**     | 备份列表加操作按钮   | `backup-list-item-operation-create`      |

##### 列表页字段扩展（表格额外列）

| 扩展点                       | 列表       | Halo 对应                              | 说明           |
| ------------------------- | -------- | ------------------------------------ | ------------ |
| **`postListItemField`**   | 文章列表表格加列 | `post-list-item-field-create`        | 比如加一列 SEO 分数 |
| **`pageListItemField`**   | 页面列表加列   | `single-page-list-item-field-create` | <br />       |
| **`pluginListItemField`** | 插件列表加列   | `plugin-list-item-field-create`      | <br />       |

##### Tab 注入（在现有页面加选项卡）

| 扩展点                         | 注入位置         | Halo 对应                           | 说明                      |
| --------------------------- | ------------ | --------------------------------- | ----------------------- |
| **`pluginDetailTab`**       | 插件详情页加 Tab   | `plugin-self-tabs-create`         | 比如插件自己的配置页              |
| **`themeListTab`**          | 主题列表页加 Tab   | `theme-list-tabs-create`          | 比如"官方主题"/"社区主题"Tab      |
| **`attachmentSelectorTab`** | 附件选择器弹窗加 Tab | `attachment-selector-create`      | 比如添加"从 URL 导入"Tab       |
| **`pluginInstallTab`**      | 插件安装页加 Tab   | `plugin-installation-tabs-create` | 比如"从 ZIP 安装"/"从 Git 安装" |
| **`backupTab`**             | 备份页加 Tab     | `backup-tabs-create`              | 比如"云备份"/"本地备份"          |
| **`userDetailTab`**         | 用户详情页加 Tab   | `user-detail-tabs-create`         | <br />                  |

##### 编辑器/评论/附件替换

| 扩展点                                 | Halo 对应                             | 说明                                                       |
| ----------------------------------- | ----------------------------------- | -------------------------------------------------------- |
| **`editorCreate`**                  | `editor-create`                     | 向编辑器注入功能（比如 Markdown 工具按钮）                               |
| **`commentEditorReplace`**          | `comment-editor-replace`            | 完全替换评论编辑器组件                                              |
| **`commentListItemContentReplace`** | `comment-list-item-content-replace` | 替换评论列表里评论内容的渲染                                           |
| **`commentSubjectRef`**             | `comment-subject-ref-create`        | 评论来源显示方式                                                 |
| **`customAdminRoutes`**             | UI Plugin                           | **注册插件独立的后台路由**（我们比 Halo 更直接——用 Next.js App Router 自然实现） |

##### 仪表盘权限控制

每个 UI 扩展点可以声明需要的权限，RainyNest 核心会自动过滤：

```ts
{
  dashboardWidget: [
    {
      component: () => import('./admin/SeoScoreWidget'),
      permissions: ['plugin:seo-helper:view'],  // 需要这个权限
      title: 'SEO 健康度',
    }
  ]
}
```

### 4.5 插件入口完整示例（Halo 风格，覆盖 7 类扩展点）

```ts
// vendor/plugins/seo-helper/index.ts
// 一个插件可以同时实现：服务端 + 主题端 + 后台 Console UI 扩展点
// 全部扩展点按需实现（只返回你用到的）

import type {
  PluginContext,
  ExtensionHandlers,
  BeforeSavePostMeta,
} from '@/lib/plugin/types';
import { autoGenerateSummary, analyzeSeoScore } from './utils';

export default function seoHelperPlugin(ctx: PluginContext): ExtensionHandlers {
  const config = ctx.config as { autoSummary?: boolean; maxSummaryLength?: number } || {};

  return {
    // ═══════════════════════════════════════
    // ① 服务端扩展点（API 钩子 / 生命周期）
    // ═══════════════════════════════════════

    async beforeSavePost(post, meta: BeforeSavePostMeta) {
      if (config.autoSummary !== false && !post.summary) {
        meta.patch = {
          summary: autoGenerateSummary(post.content, config.maxSummaryLength || 160),
        };
      }
    },

    onGenerateMetadata({ metadata, post }) {
      return {
        ...metadata,
        keywords: [
          ...(metadata.keywords as string[] || []),
          'auto-seo',
          post?.category?.name,
        ].filter(Boolean),
      };
    },

    injectHead() {
      return [
        `<meta name="generator" content="RainyNest-SEO-Helper">`,
        `<link rel="preconnect" href="https://fonts.googleapis.com">`, // 插件可以预加载资源
      ];
    },

    customApi: [
      {
        method: 'GET',
        path: '/api/plugin/seo-helper/analyze',
        handler: async (req: Request) => {
          const url = new URL(req.url);
          const content = url.searchParams.get('content') || '';
          const score = analyzeSeoScore(content);
          return Response.json({ success: true, data: { score } });
        },
        auth: false,
      },
    ],

    // ═══════════════════════════════════════
    // ② 主题端前台 UI 扩展点（注入到用户主题的前台页面）
    // ═══════════════════════════════════════

    // 侧边栏小部件：SEO 健康度
    injectSidebarWidget: () => import('./templates/SeoWidget'),

    // 文章文末追加：相关文章推荐
    injectPostContent: () => import('./templates/RelatedPosts'),

    // 声明插件自己有哪些模板（主题可以覆盖）
    providesTemplates: ['default', 'widget', 'related-posts'],

    // ═══════════════════════════════════════
    // ③ 后台 Console UI 扩展点（管理后台注入组件）
    // ═══════════════════════════════════════

    // 仪表盘小部件：总 SEO 分 + 今日待优化文章数
    dashboardWidget: [
      {
        component: () => import('./admin/SeoScoreWidget'),
        title: 'SEO 健康度',
        icon: 'search',
        permissions: ['plugin:seo-helper:view'],
        colSpan: 1,  // 占几列（仪表盘默认 4 列网格）
      },
      {
        component: () => import('./admin/TodoOptimizeWidget'),
        title: '待优化文章',
        icon: 'alert-triangle',
        permissions: ['plugin:seo-helper:view'],
        colSpan: 1,
      },
    ],

    // 后台文章列表每行加一个 "SEO 检测" 按钮
    postListItemOperation: [
      {
        label: 'SEO 检测',
        icon: 'search-check',
        variant: 'default',
        onClick: `plugin:seo-helper:analyze`,  // 触发事件，RainyNest 核心会调插件的处理逻辑
        permissions: ['plugin:seo-helper:view'],
      },
      {
        label: '重新生成摘要',
        icon: 'refresh-cw',
        variant: 'ghost',
        onClick: `plugin:seo-helper:regen-summary`,
        permissions: ['plugin:seo-helper:edit'],
      },
    ],

    // 后台文章列表表格加一列 SEO 分数
    postListItemField: [
      {
        key: 'seoScore',
        label: 'SEO',
        width: 80,
        render: () => import('./admin/SeoScoreCell'),  // 组件，props 传 post 对象
        sortable: true,
      },
    ],

    // 插件详情页加一个"SEO 分析" Tab
    pluginDetailTab: [
      {
        key: 'seo-analysis',
        label: 'SEO 分析',
        component: () => import('./admin/SeoAnalysisTab'),
      },
    ],

    // 附件选择器弹窗加 "从 URL 导入" Tab
    attachmentSelectorTab: [
      {
        key: 'from-url',
        label: '从 URL 导入',
        component: () => import('./admin/AttachmentFromUrl'),
      },
    ],

    // 注册插件独立的后台完整页面路由（比如配置页）
    // 这个跟上面的细颗粒度扩展点不冲突——细颗粒度是"向现有页面注入"，customAdminRoutes 是"注册全新的顶级页面"
    customAdminRoutes: [
      {
        path: '/console/plugins/seo-helper',
        title: 'SEO 助手',
        icon: 'search',
        group: '内容',     // 后台侧边栏分组
        component: () => import('./admin/ConfigPage'),
      },
      {
        path: '/console/plugins/seo-helper/report',
        title: 'SEO 报告',
        icon: 'bar-chart',
        hideSidebar: false,
        component: () => import('./admin/ReportPage'),
      },
    ],

    // ═══════════════════════════════════════
    // ④ 插件独立前台页面（直接注册 /web/plugins/seo-helper/ 路由）
    // ═══════════════════════════════════════

    customFrontendRoutes: [
      {
        path: '/web/plugins/seo-helper',
        title: 'SEO 检测',
        component: () => import('./templates/SeoCheckerPage'),
        ssr: true,  // 需要实时数据走 SSR
      },
    ],
  };
}
```

### 4.6 插件-主题双向集成（仿 Halo 核心机制）

```
┌──────────────┐     可以覆盖      ┌──────────────┐
│   插件模板    │ ◄────────────── │   主题模板    │
│              │                  │              │
│ templates/   │                  │ templates/   │
│  default.tsx │                  │ plugins/     │
│  widget.tsx  │                  │  seo-helper/ │
│              │                  │   default.tsx│
└──────────────┘                  └──────────────┘
       ▲                                  │
       │ 主题没提供同名文件                 │ 主题提供了同名文件
       │ 回退到插件默认模板                 │ 用主题的模板覆盖
       └──────────────────────────────────┘
                     ↓
            RainyNest 渲染时先查主题
            查不到再查插件
```

```tsx
// lib/plugin/theme-integration.ts
// Halo 风格的"主题优先"模板解析
export async function resolvePluginTemplate(pluginSlug: string, templateName: string) {
  const THEMES_DIR = path.join(process.cwd(), 'vendor', 'themes');
  const PLUGINS_DIR = path.join(process.cwd(), 'vendor', 'plugins');

  // 1. 先查当前激活主题有没有覆盖这个模板
  const activeTheme = await getActiveTheme();
  if (activeTheme) {
    const themeOverridePath = path.join(
      THEMES_DIR, activeTheme.slug, 'templates', 'plugins', pluginSlug, `${templateName}.tsx`
    );
    if (fs.existsSync(themeOverridePath)) {
      return await import(`file://${themeOverridePath}`);
    }
  }

  // 2. 回退：用插件自带的默认模板
  const pluginTemplatePath = path.join(
    PLUGINS_DIR, pluginSlug, 'templates', `${templateName}.tsx`
  );
  if (fs.existsSync(pluginTemplatePath)) {
    return await import(`file://${pluginTemplatePath}`);
  }

  return null;  // 都没有 → 显示"插件模板缺失"
}
```

主题开发者可以这样覆盖插件模板：

```
vendor/themes/dark/
└── templates/
    └── plugins/
        └── seo-helper/
            └── default.tsx     ← 覆盖 seo-helper 插件的默认模板
```

### 4.7 ⚠️ 关键：vendor 目录预编译（生产构建必备）

#### 问题根源

Next.js 的打包器（Turbo / Webpack）做**静态分析**，运行时拼接的路径 `import(\`file://${entryPath}\`)` 在 `next build` 时完全看不到 → **生产构建后动态 import 直接崩溃**。

```
✅ next dev（开发模式）：能跑，dev server 支持实时转译
❌ next build && next start（生产）：崩溃，找不到模块
❌ next export（纯 SSG）：同上
```

Node.js 生态没有 Java 那样的类加载器，绕过 Next.js 打包器动态加载 `.ts` 文件在生产环境不可行。

#### 解决方案：esbuild 预编译

构建前用 **esbuild**（极速 TypeScript 转译器）把 `vendor/{plugins,themes}/*/*.ts` 预编译成 JS，放到 `.next/vendor-compiled/` 目录，运行时从那个目录 import。

```
构建链路：
  npm run build
    ↓
  scripts/build-vendor.js（esbuild 预编译）
    vendor/plugins/*/index.ts  →  .next/vendor-compiled/plugins/{slug}/index.js
    vendor/themes/*/theme.ts    →  .next/vendor-compiled/themes/{slug}/theme.js
    ↓
  next build（静态 import 已存在的 .js 文件，打包器能正确识别）
    ↓
  next start（生产运行时动态 import 预编译后的 .js）
```

#### 预编译脚本

```js
// scripts/build-vendor.js
// 构建前 + 开发时热重载都跑这个脚本
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

const CJS_BUNDLE = {
  format: 'cjs',          // 用 CommonJS，Node.js 直接 require
  platform: 'node',
  target: 'node20',
  minify: process.env.NODE_ENV === 'production',
  external: ['next', 'react', 'react-dom', '@prisma/client', 'better-sqlite3'], // RainyNest 核心依赖不打包
};

function compileDir(srcDir, destDir, entryGlobs) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });

  for (const item of fs.readdirSync(srcDir)) {
    const itemPath = path.join(srcDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;

    for (const glob of entryGlobs) {
      // glob 是具体文件名，如 'index.ts' 或 'theme.ts'
      const entry = path.join(itemPath, glob);
      if (!fs.existsSync(entry)) continue;

      const out = path.join(destDir, item, glob.replace('.ts', '.js'));
      fs.mkdirSync(path.dirname(out), { recursive: true });

      esbuild.buildSync({
        entryPoints: [entry],
        outfile: out,
        bundle: false,      // 不 bundle，插件可以 import 自己的依赖
        ...CJS_BUNDLE,
      });
    }
  }
}

function main() {
  const root = process.cwd();

  // 1. 清空旧的预编译产物
  const compiledDir = path.join(root, '.next', 'vendor-compiled');
  if (fs.existsSync(compiledDir)) fs.rmSync(compiledDir, { recursive: true });

  // 2. 预编译插件（入口 index.ts）
  compileDir(
    path.join(root, 'vendor', 'plugins'),
    path.join(compiledDir, 'plugins'),
    ['index.ts', 'plugin.client.tsx']
  );

  // 3. 预编译主题（入口 theme.ts）
  compileDir(
    path.join(root, 'vendor', 'themes'),
    path.join(compiledDir, 'themes'),
    ['theme.ts']
  );

  console.log('[build-vendor] ✓ Precompiled vendor/plugins + vendor/themes');
}

if (require.main === module) main();
```

```json
// package.json
{
  "scripts": {
    "prebuild": "node scripts/sync-themes.js && node scripts/build-vendor.js",
    "prestart": "node scripts/sync-themes.js && node scripts/build-vendor.js",
    "predev": "node scripts/sync-themes.js",
    "reload:vendor": "node scripts/build-vendor.js"   // 开发时热重载插件/主题
  },
  "dependencies": {
    "esbuild": "^0.23.x"
  }
}
```

#### 开发模式热重载

开发时 `esbuild --watch` 监听 vendor 目录变化，改动插件/主题代码后自动重编译，`bootPlugins()` 里加 `?t=timestamp` 绕过 Node 模块缓存：

```ts
// scripts/build-vendor.js —— 开发时加 --watch
if (process.argv.includes('--watch')) {
  // esbuild 也支持 watch 模式
  compileDirWatch(/* ... */);
}
```

### 4.8 插件加载与扩展点执行引擎

```ts
// lib/plugin/engine.ts
// 核心：扫描 → 加载（从预编译产物） → 按扩展点分组 → 执行

import fs from 'node:fs';
import path from 'node:path';
import { db } from '../prisma';
import { analytics } from '../analytics';
import { getSiteSetting } from '../site';
import { getPluginDb } from '../plugin-db';

const PLUGINS_DIR = path.join(process.cwd(), 'vendor', 'plugins');
// ⭐ 运行时从预编译目录加载，不是 vendor/ 源码目录
const COMPILED_DIR = path.join(process.cwd(), '.next', 'vendor-compiled', 'plugins');

// 内部：缓存所有已加载插件（进程启动时加载，或热重载时刷新）
let loadedPlugins: LoadedPlugin[] | null = null;

interface LoadedPlugin {
  slug: string;
  meta: any;                  // plugin.json
  handlers: ExtensionHandlers; // 插件导出的扩展点实现
  enabled: boolean;           // 数据库里的启用状态
  config: Record<string, any>;
}

// 扫描 + 加载所有插件（启动时调用一次）
export async function bootPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) { loadedPlugins = []; return; }

  const dirs = fs.readdirSync(PLUGINS_DIR);
  const plugins: LoadedPlugin[] = [];

  for (const dir of dirs) {
    const jsonPath = path.join(PLUGINS_DIR, dir, 'plugin.json');
    if (!fs.existsSync(jsonPath)) continue;

    const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const dbEntry = await db.plugin.findUnique({ where: { slug: dir } });
    if (dbEntry && !dbEntry.isActive) continue;  // 数据库禁用的跳过

    try {
      // ⭐ 关键：从预编译目录加载 .js，不是从 vendor/ 源码目录加载 .ts
      const compiledEntry = path.join(COMPILED_DIR, dir, (meta.entry || 'index').replace('.ts', '.js'));
      if (!fs.existsSync(compiledEntry)) {
        console.error(`[Plugin] ${dir}: 预编译产物不存在，请先运行 npm run reload:vendor`);
        continue;
      }

      // 用 require + ?t= 绕过缓存（Node 原生 require 比 file:// import 更稳）
      const mod = require(compiledEntry + '?t=' + Date.now());
      const ctx = {
        db,
        analytics,
        pluginDb: getPluginDb(dir),
        site: await getSiteSetting(),
        config: dbEntry?.config ? JSON.parse(dbEntry.config) : {},
        slug: dir,
        version: meta.version,
        env: process.env,
        logger: createPluginLogger(dir),
        emitEvent: (name: string, data: any) => { /* 事件总线 */ },
      };

      const handlers = mod.default(ctx);  // 工厂函数
      plugins.push({ slug: dir, meta, handlers, enabled: true, config: ctx.config });
    } catch (err) {
      console.error(`[Plugin] Failed to load ${dir}:`, err);
    }
  }

  loadedPlugins = plugins;

  // 执行 onMount 扩展点
  for (const p of plugins) {
    if (p.handlers.onMount) {
      try {
        await p.handlers.onMount({ db, analytics, pluginDb: getPluginDb(p.slug), site: await getSiteSetting(), slug: p.slug, config: p.config });
      } catch (err) {
        console.error(`[Plugin] ${p.slug} onMount failed:`, err);
      }
    }
  }
}

// ⭐ 核心：执行某个扩展点（让所有实现了这个扩展点的插件都跑一遍）
export async function fireExtensionPoint<K extends keyof ExtensionHandlers>(
  point: K,
  ...args: Parameters<NonNullable<ExtensionHandlers[K]>>
): Promise<ReturnType<NonNullable<ExtensionHandlers[K]>>[]> {
  if (!loadedPlugins) await bootPlugins();

  const results: any[] = [];
  for (const plugin of loadedPlugins || []) {
    const handler = plugin.handlers[point] as any;
    if (typeof handler === 'function') {
      try {
        const result = await handler(...args);
        if (result !== undefined) results.push(result);
      } catch (err) {
        console.error(`[Plugin] ${plugin.slug} ${String(point)} failed:`, err);
      }
    }
  }
  return results;
}

// 辅助：收集某个扩展点的第一个有效返回值（用于覆盖类扩展点）
export async function firstWins<K extends keyof ExtensionHandlers>(
  point: K,
  ...args: Parameters<NonNullable<ExtensionHandlers[K]>>
): Promise<ReturnType<NonNullable<ExtensionHandlers[K]>> | null> {
  const results = await fireExtensionPoint(point, ...args);
  return results[0] ?? null;
}
```

### 4.8 扩展点在核心流程中的调用位置

```
保存文章流程：
  ┌───────────────────────────────────────────────────┐
  │  Controller                                        │
  │    ↓                                               │
  │  fireExtensionPoint('beforeSavePost', post, meta)  │ ← 插件可以修改/拦截
  │    ↓ 插件没有拦截才继续                              │
  │  db.post.create({...})                             │
  │    ↓                                               │
  │  fireExtensionPoint('afterSavePost', savedPost)    │ ← 插件可以做后续操作（发通知等）
  └───────────────────────────────────────────────────┘

渲染首页 metadata：
  ┌───────────────────────────────────────────────────┐
  │  app/layout.tsx → generateMetadata()               │
  │    ↓                                               │
  │  let metadata = { title, description, ... }         │
  │    ↓                                               │
  │  const patches = await fireExtensionPoint(         │
  │    'onGenerateMetadata',                            │
  │    { metadata, post: null }                         │
  │  );                                                 │
  │    ↓ 每个插件返回的 patch 合并到 metadata             │
  │  patches.forEach(p => { metadata = { ...metadata, ...p }; })
  │    ↓                                               │
  │  return metadata;                                   │
  └───────────────────────────────────────────────────┘

HTML head 注入：
  ┌───────────────────────────────────────────────────┐
  │  app/layout.tsx <head>                             │
  │    ↓                                               │
  │  const heads = await fireExtensionPoint('injectHead');
  │    ↓                                               │
  │  heads.forEach(h => <Fragment>{h}</Fragment>)       │
  └───────────────────────────────────────────────────┘

侧边栏小部件：
  ┌───────────────────────────────────────────────────┐
  │  components/layout/Sidebar.tsx                      │
  │    ↓                                               │
  │  const widgets = await fireExtensionPoint(          │
  │    'injectSidebarWidget'                            │
  │  );                                                 │
  │    ↓                                               │
  │  widgets.map(W => <W />)                           │
  └───────────────────────────────────────────────────┘

Markdown 渲染：
  ┌───────────────────────────────────────────────────┐
  │  lib/markdown/renderer.tsx                          │
  │    ↓                                               │
  │  let content = post.content;                       │
  │    ↓                                               │
  │  const processors = await fireExtensionPoint(       │
  │    'onRenderMarkdown', content                       │
  │  );                                                 │
  │    ↓ 每个插件可以返回修改后的 content                 │
  │  processors.forEach(c => { if (c) content = c; })   │
  │    ↓                                               │
  │  ReactMarkdown → JSX                               │
  └───────────────────────────────────────────────────┘
```

### 4.9 插件管理 API

```
GET    /api/console/plugins                        ← 列出所有已安装 + 扩展点清单
POST   /api/console/plugins                       ← 安装新插件（ZIP / Git URL）
GET    /api/console/plugins/[slug]                ← 读单个插件详情 + 配置
PUT    /api/console/plugins/[slug]/activate       ← 启用插件
PUT    /api/console/plugins/[slug]/deactivate     ← 禁用插件
PUT    /api/console/plugins/[slug]/config          ← 保存插件配置（动态 Zod 校验）
DELETE /api/console/plugins/[slug]                ← 卸载插件
POST   /api/console/plugins/reload                ← 热重载所有插件（不重启服务器）
```

### 4.10 热重载（开发友好）

```ts
// lib/plugin/engine.ts
// 后台提供热重载 API，开发插件时可以实时生效

export async function reloadPlugins() {
  loadedPlugins = null;  // 清空缓存
  await bootPlugins();   // 重新扫描加载
}

// 后台 "重新加载插件" 按钮点击 → POST /api/console/plugins/reload
// 开发时改了插件代码不用重启 Next.js
```

### 4.11 SSR/SSG/ISR 策略（插件相关）

| 场景           | 策略        | 说明                                                |
| ------------ | --------- | ------------------------------------------------- |
| 插件扩展点实现      | 运行时动态     | 插件在 Next.js 启动时加载，每个请求执行扩展点时调用                    |
| 插件注册的前台页面    | SSG + ISR | 插件页面和 RainyNest 主页面一样走 SSG                        |
| 插件注册的后台页面    | SSR       | 管理员操作需要实时                                         |
| 插件模板文件       | 静态资源      | `vendor/plugins/{slug}/templates/*.tsx`           |
| 插件 CSS/JS 注入 | SSR 内联    | 通过 `injectHead` / `injectBodyEnd` 在 layout.tsx 注入 |

### 4.12 内置示例插件

| 插件 slug           | 功能                           | 提供扩展点                                            | 预装 |
| ----------------- | ---------------------------- | ------------------------------------------------ | -- |
| `default-seo`     | 自动生成摘要 + JSON-LD 增强          | beforeSavePost + onGenerateMetadata + injectHead | ✅  |
| `code-highlight`  | Expressive Code 代码高亮增强（额外主题） | onRenderMarkdown                                 | ✅  |
| `rss-feed`        | RSS/Atom 双格式输出               | customApi + customFrontendRoutes                 | ✅  |
| `sitemap-enhance` | sitemap.xml 额外规则             | customApi                                        | ❌  |
| `comment-filter`  | 垃圾评论自动审核（关键词/IP）             | beforeCommentApprove                             | ❌  |
| `reading-time`    | 文章阅读时间显示                     | onRenderMarkdown                                 | ✅  |
| `related-posts`   | 相关文章推荐小部件                    | injectSidebarWidget                              | ❌  |

> 注：`page-views` 插件已移除——路径级 PV 统计已合并进系统统计页（`/console/tools/stats`，直接聚合 analytics 库 PageView 表）。`onPageView` 扩展点保留，供社区插件做旁路增强。

### 核心功能 vs 预装插件 vs 社区插件——三层边界

**很多人第一次看这里会困惑**：访问统计明明是核心功能（sendBeacon + queue + WAL 模式），为什么还留一个 `onPageView` 扩展点？`injectSidebarWidget` 又和核心侧边栏组件是什么关系？

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: 核心（RainyNest 内置，vendor/plugins 外面）                │
│                                                                     │
│  负责：框架级基础设施，不涉及具体业务逻辑                               │
│                                                                     │
│  ✅ 扩展点引擎本身（fireExtensionPoint / registerHandler）           │
│  ✅ middleware.ts（保护路由）                                       │
│  ✅ 进程内 analytics queue（sendBeacon → enqueue → flush）            │
│     ↑ 这层永远跑，不管有没有插件消费 onPageView                     │
│  ✅ 核心侧边栏硬编码组件（分类/标签云/最新评论/归档）                   │
│     ↑ 这层永远渲染，不管有没有 injectSidebarWidget 插件              │
│  ✅ 主题切换 / Markdown 渲染 / 权限检查 / NextAuth                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↑
                              │ fireExtensionPoint('xxx') 触发
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 2: 预装插件（✅，vendor/plugins 里，默认启用）                 │
│                                                                     │
│  负责：**消费**核心的扩展点钩子，提供默认业务逻辑                      │
│  可以禁用（但禁用后该功能就没了）                                      │
│                                                                     │
│  例 1: 假想的 realtime-pv 社区插件（onPageView 扩展点）              │
│    核心 sendBeacon queue 永远在收集 PV                               │
│    插件注册 onPageView handler → 做额外的事                         │
│      → 比如实时写入 Redis（给仪表盘秒级 PV）                         │
│      → 比如发送 Webhook 到第三方分析                                 │
│      → 核心 queue 照常跑，插件只是"旁路监听"                         │
│                                                                     │
│  例 2: reading-time（onRenderMarkdown 扩展点）                        │
│    核心 Markdown 渲染器永远在跑                                      │
│    reading-time 插件在渲染完后追加阅读时间统计到文末                   │
│                                                                     │
│  例 3: default-seo（beforeSavePost + injectHead）                    │
│    核心文章保存流程永远在跑                                           │
│    default-seo 在保存前自动生成 summary，在 <head> 注入 JSON-LD       │
└─────────────────────────────────────────────────────────────────────┘
                              ↑
                              │ 用户在后台"插件市场"安装
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: 社区插件（❌，vendor/plugins 里但默认禁用）                 │
│                                                                     │
│  负责：在核心扩展点基础上做差异化功能                                  │
│  装了才生效，不装不影响任何东西                                        │
│                                                                     │
│  例 1: related-posts（injectSidebarWidget 扩展点）                   │
│    核心侧边栏永远渲染（分类/标签/最新评论）                            │
│    related-posts 插件注册 injectSidebarWidget handler                │
│    fireExtensionPoint 会把所有 handler 收集起来一起渲染               │
│    → 核心组件 | 插件组件 | 另一个插件组件（按注册顺序）                 │
│                                                                     │
│  例 2: comment-filter（beforeCommentApprove 扩展点）                 │
│    核心评论审核流程永远在跑                                           │
│    comment-filter 插件在审核前做关键词/IP/邮箱黑名单检查               │
│    → 如果返回 false，评论直接标记 SPAM，不进审核队列                    │
└─────────────────────────────────────────────────────────────────────┘
```

**一句话总结**：核心是地基，预装插件是默认装修，社区插件是自选家具。扩展点就是地基上预留的插座，谁想接什么都行。

### 4.13 预装插件详细设计（8 个）

---

#### ① `default-seo` ✅ — 自动生成摘要 + JSON-LD + `<head>` 增强

**核心问题**：作者写文章时懒得填 meta description，也不会写 JSON-LD 结构化数据。搜索引擎收录质量差。

**插件做什么**：
```
文章保存前（beforeSavePost）
  ↓ 自动从 Markdown 正文截取前 140 字作为 summary
  ↓ 如果作者手动填了 summary → 不覆盖
  ↓ 如果正文 < 140 字 → 直接用全文
  ↓ 同时生成 excerpt（纯文本去 Markdown 语法）

页面渲染时（injectHead + onGenerateMetadata）
  ↓ 在 <head> 注入：
    ✅ Open Graph 标签（og:title, og:description, og:image, og:type）
    ✅ Twitter Card 标签
    ✅ canonical URL（防重复内容）
    ✅ Article 类型 JSON-LD（标题/作者/发布时间/图片）
    ✅ BlogPosting 类型 JSON-LD（更详细的文章结构化数据）
  ↓ 如果是首页 → WebSite + Organization JSON-LD
  ↓ 如果是作者页 → Person JSON-LD
```

**plugin.json 配置**：
```json
{
  "slug": "default-seo",
  "version": "1.0.0",
  "name": "默认 SEO 增强",
  "description": "自动生成摘要、Open Graph 标签和 JSON-LD 结构化数据",
  "entry": "index.ts",
  "configSchema": {
    "type": "object",
    "properties": {
      "autoSummary": { "type": "boolean", "default": true, "title": "自动生成摘要" },
      "summaryLength": { "type": "number", "default": 140, "title": "摘要长度（字）" },
      "jsonLdTypes": {
        "type": "array",
        "items": { "enum": ["Article", "BlogPosting", "NewsArticle"] },
        "default": ["Article", "BlogPosting"],
        "title": "JSON-LD 类型"
      },
      "socialImage": { "type": "string", "default": "", "title": "默认社交分享图 URL" }
    }
  }
}
```

**关键代码（扩展点 handler）**：
```ts
// vendor/plugins/default-seo/index.ts
export default function seoPlugin(ctx: PluginContext) {
  return {
    // 保存前自动生成 summary
    beforeSavePost: async ({ data, existingPost }) => {
      if (!ctx.config.autoSummary) return data;
      // 如果作者没手动填 summary → 从 content 自动截取
      if (!data.summary && data.content) {
        const plainText = data.content.replace(/[#*_`\[\]()]/g, '').replace(/\n/g, ' ');
        data.summary = plainText.slice(0, ctx.config.summaryLength || 140);
      }
      return data;
    },

    // <head> 注入
    injectHead: async ({ type, data }) => {
      if (type === 'post') {
        const post = data;
        const canonical = `${ctx.site.url}/blog/${post.slug}`;
        return `
          <meta property="og:title" content="${escapeHtml(post.title)}" />
          <meta property="og:description" content="${escapeHtml(post.summary || '')}" />
          <meta property="og:url" content="${canonical}" />
          <meta property="og:image" content="${post.cover || ctx.config.socialImage || ''}" />
          <meta name="twitter:card" content="summary_large_image" />
          <link rel="canonical" href="${canonical}" />
          <script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": post.title,
            "author": { "@type": "Person", "name": post.author?.name },
            "datePublished": post.createdAt,
            "dateModified": post.updatedAt,
            "image": post.cover,
            "mainEntityOfPage": canonical,
          })}</script>
        `;
      }
      return '';
    },

    // Next.js generateMetadata 钩子（后台自动补充 keywords）
    onGenerateMetadata: async ({ type, data, site }) => {
      if (type === 'post' && data.tags?.length) {
        return { keywords: data.tags.map(t => t.name).join(', ') };
      }
      return {};
    },
  };
}
```

---

#### ② `code-highlight` ✅ — Expressive Code 代码高亮增强

**核心问题**：RainyNest 核心 Markdown 渲染器用 Expressive Code 做代码高亮，但默认只带一套主题。用户可能想要 GitHub Dark / One Dark / Nord 等不同风格。

**插件做什么**：
```
核心渲染器启动时（onRenderMarkdown 扩展点）
  ↓ 插件注册额外的 Expressive Code 主题
  ↓ 后台主题设置页自动出现"代码高亮主题"下拉框
  ↓ 主题切换时 revalidatePath 刷新 ISR 缓存
  ↓ 同时可以自定义：
    ✅ 行号显示/隐藏
    ✅ 代码块圆角/边框
    ✅ 复制按钮样式
    ✅ 语言徽章
    ✅ 代码折叠（超过 N 行自动折叠）
```

**plugin.json 配置**：
```json
{
  "slug": "code-highlight",
  "version": "1.0.0",
  "name": "代码高亮增强",
  "description": "Expressive Code 额外主题 + 代码块美化",
  "configSchema": {
    "type": "object",
    "properties": {
      "theme": {
        "type": "string",
        "default": "github-dark",
        "enum": ["github-dark", "github-light", "one-dark", "nord", "dracula", "monokai", "tokyo-night"],
        "title": "高亮主题"
      },
      "showLineNumbers": { "type": "boolean", "default": true, "title": "显示行号" },
      "showCopyButton": { "type": "boolean", "default": true, "title": "复制按钮" },
      "collapsible": { "type": "boolean", "default": true, "title": "长代码折叠" },
      "collapseAfterLines": { "type": "number", "default": 40, "title": "超过 N 行自动折叠" }
    }
  }
}
```

**关键代码**：
```ts
// vendor/plugins/code-highlight/index.ts
import { plugin as ecPlugin } from 'expressive-code';
import { githubDark, oneDark, nord, dracula, tokyoNight } from '@expressive-code/theme-catalog';

export default function codeHighlightPlugin(ctx: PluginContext) {
  const themes: Record<string, any> = {
    'github-dark': githubDark, 'one-dark': oneDark,
    'nord': nord, 'dracula': dracula, 'tokyo-night': tokyoNight,
  };

  return {
    // 核心 Markdown 渲染器会调 fireExtensionPoint('onRenderMarkdown', config)
    // 插件返回修改后的 config
    onRenderMarkdown: async ({ rendererConfig }) => {
      rendererConfig.expressiveCode = {
        themes: [themes[ctx.config.theme] || githubDark],
        plugins: [
          ecPlugin({ showLineNumbers: ctx.config.showLineNumbers }),
          // ... 其他插件配置
        ],
      };
      return rendererConfig;
    },
  };
}
```

---

#### ③ `rss-feed` ✅ — RSS / Atom 双格式输出

**核心问题**：核心系统没有 RSS feed。读者想订阅更新。

**插件做什么**：
```
注册路由（customApi + customFrontendRoutes 扩展点）
  ↓ /api/feed  → 返回 RSS 2.0 XML
  ↓ /api/feed/atom → 返回 Atom XML
  ↓ /api/feed.json → 返回 JSON Feed 1.1

内容来源：从主库 Post 表取 status=PUBLISHED 的最新 20 篇
  ↓ 包含：标题/链接/发布时间/作者/分类/正文（CDATA 包裹）
  ↓ 支持完整正文或摘要模式（配置可选）
  ↓ 自动在 <head> 注入 <link rel="alternate" type="application/rss+xml">
```

**plugin.json 配置**：
```json
{
  "slug": "rss-feed",
  "version": "1.0.0",
  "name": "RSS/Atom Feed",
  "description": "生成 RSS 2.0 / Atom / JSON Feed 三种格式",
  "configSchema": {
    "type": "object",
    "properties": {
      "includeFullContent": { "type": "boolean", "default": false, "title": "包含完整正文（否则摘要）" },
      "maxItems": { "type": "number", "default": 20, "title": "最多文章数" },
      "feedFormats": {
        "type": "array",
        "default": ["rss", "atom", "json"],
        "items": { "enum": ["rss", "atom", "json"] },
        "title": "启用的 Feed 格式"
      }
    }
  }
}
```

**关键代码**：
```ts
// vendor/plugins/rss-feed/index.ts
export default function rssPlugin(ctx: PluginContext) {
  return {
    // 注册自定义 API 路由
    customApi: [
      { path: '/api/feed', handler: handleRss },
      { path: '/api/feed/atom', handler: handleAtom },
      { path: '/api/feed.json', handler: handleJsonFeed },
    ],

    // <head> 注入 feed link
    injectHead: async () => {
      const base = ctx.site.url;
      const links = [];
      if (ctx.config.feedFormats.includes('rss'))
        links.push(`<link rel="alternate" type="application/rss+xml" title="${ctx.site.title} RSS" href="${base}/api/feed" />`);
      if (ctx.config.feedFormats.includes('atom'))
        links.push(`<link rel="alternate" type="application/atom+xml" title="${ctx.site.title} Atom" href="${base}/api/feed/atom" />`);
      return links.join('\n');
    },
  };
}

async function handleRss(req: Request, ctx: PluginContext) {
  const posts = await ctx.db.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: ctx.config.maxItems || 20,
  });
  // 生成 RSS 2.0 XML（用 xmlbuilder2 或手动拼接）
  const xml = buildRss(posts, ctx.site, ctx.config);
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml' } });
}
```

---

#### ④ `onPageView` 扩展点示例 — PV 统计旁路增强（原 `page-views` 插件，已并入系统统计）

**核心问题**：核心 analytics queue 已经在收集 PV（sendBeacon → enqueue → flush → createMany），但那是"基础版"——只写 SQLite、聚合回填主库 views。如果想做实时 PV 计数、Redis 缓存、Webhook 通知等，需要插件扩展。路径级 PV 明细已由系统统计页直接聚合 analytics 库提供，下面示例保留作为 `onPageView` 扩展点的参考实现。

**插件做什么**：
```
核心 API route /api/analytics/pv
  ↓ 核心 enqueuePageView() 入队 → 立即 return
  ↓ 同时 fireExtensionPoint('onPageView', pvData) → 旁路触发所有订阅者
  ↓ page-views 插件消费这个钩子，做额外的事：
    ✅ Redis 实时计数器（仪表盘秒级 PV 数字）
    ✅ 单篇文章实时浏览量（不用等定时聚合回填）
    ✅ 热门文章实时排行（Top 10）
    ✅ 可选项：Webhook 通知（每篇新文章被访问 100 次时发通知）
```

**plugin.json 配置**：
```json
{
  "slug": "page-views",
  "version": "1.0.0",
  "name": "PV 统计增强",
  "description": "实时 PV 计数 + Redis 缓存 + Webhook 通知",
  "configSchema": {
    "type": "object",
    "properties": {
      "enableRealTimeCounter": { "type": "boolean", "default": true, "title": "启用实时计数（Redis/内存）" },
      "webhookUrl": { "type": "string", "default": "", "title": "Webhook URL（留空不发）" },
      "webhookThreshold": { "type": "number", "default": 100, "title": "每 N 次 PV 发一次 Webhook" }
    }
  }
}
```

**关键代码**：
```ts
// vendor/plugins/page-views/index.ts
// 注意：onPageView 扩展点是"旁路监听"，不影响核心 queue 的 flush 流程
// 核心逻辑在 lib/analytics/queue.ts 的 enqueuePageView 里已经调了
// fireExtensionPoint('onPageView', pvData)

let memoryCounter = new Map<string, number>();  // slug → 实时计数
let webhookCounters = new Map<string, number>();

export default function pageViewsPlugin(ctx: PluginContext) {
  return {
    onPageView: async (pv: PendingPV) => {
      // ① 内存计数器（无 Redis 时的 fallback）
      if (pv.postSlug) {
        const cur = (memoryCounter.get(pv.postSlug) || 0) + 1;
        memoryCounter.set(pv.postSlug, cur);

        // ② 实时更新主库 views（单独 async，不阻塞）
        // 注意：这是"旁路"更新，不影响核心定时聚合
        // 核心定时聚合每小时会批量回填，这里只是让 views 更实时
        // 但频率太高会导致主库写压力，所以做节流（每 10 次 PV 更新一次）
        if (cur % 10 === 0) {
          ctx.db.post.update({
            where: { slug: pv.postSlug },
            data: { views: { increment: 10 } },
          }).catch(() => {});  // 失败不影响
        }

        // ③ Webhook 通知
        if (ctx.config.webhookUrl && ctx.config.webhookThreshold) {
          const wcur = (webhookCounters.get(pv.postSlug) || 0) + 1;
          webhookCounters.set(pv.postSlug, wcur);
          if (wcur >= ctx.config.webhookThreshold) {
            webhookCounters.set(pv.postSlug, 0);
            fetch(ctx.config.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug: pv.postSlug, count: ctx.config.webhookThreshold }),
            }).catch(() => {});
          }
        }
      }
    },

    // 后台仪表盘可以查这个实时计数
    customApi: [
      {
        path: '/api/admin/stats/realtime-pv',
        handler: async () => Response.json(Object.fromEntries(memoryCounter)),
      },
    ],
  };
}
```

---

#### ⑤ `reading-time` ✅ — 文章阅读时间 + 字数统计

**核心问题**：文章详情页没有"这篇文章需要 5 分钟读完"的提示，用户不知道是否要点击。

**插件做什么**：
```
Markdown 渲染完成后（onRenderMarkdown 扩展点）
  ↓ 统计正文纯文本字数（去掉 Markdown 语法）
  ↓ 按平均阅读速度（中文 400 字/分钟，英文 200 词/分钟）计算
  ↓ 在文章标题下方注入：
    📖 约 3 分钟阅读 · 1,247 字
  ↓ 同时后台文章编辑页显示字数统计
  ↓ 自动存 Post.readingTime 和 Post.wordCount 字段（如果 schema 里有）
```

**plugin.json 配置**：
```json
{
  "slug": "reading-time",
  "version": "1.0.0",
  "name": "阅读时间统计",
  "description": "自动计算文章阅读时间和字数",
  "configSchema": {
    "type": "object",
    "properties": {
      "showOnPost": { "type": "boolean", "default": true, "title": "文章详情页显示" },
      "showOnList": { "type": "boolean", "default": false, "title": "文章列表显示" },
      "wordsPerMinute": { "type": "number", "default": 400, "title": "每分钟字数（中文）" }
    }
  }
}
```

**关键代码**：
```ts
// vendor/plugins/reading-time/index.ts
export default function readingTimePlugin(ctx: PluginContext) {
  return {
    onRenderMarkdown: async ({ html, meta }) => {
      // 从渲染后的 HTML 提取纯文本
      const text = html.replace(/<[^>]+>/g, '');
      const wordCount = text.length;  // 中文按字符算
      const minutes = Math.max(1, Math.round(wordCount / (ctx.config.wordsPerMinute || 400)));

      // 注入到文章 HTML 顶部
      const badge = `
        <div class="rainynest-reading-time" style="font-size: 14px; color: #666; margin-bottom: 16px;">
          约 ${minutes} 分钟阅读 · ${wordCount.toLocaleString()} 字
        </div>
      `;

      // 如果是完整文章渲染 → 插入到第一个 <h1> 或 <p> 前面
      const modifiedHtml = html.replace(
        /(<h1[\s\S]*?<\/h1>|<p>)/,
        `$1${badge}`
      );

      return { html: modifiedHtml, wordCount, readingTime: minutes };
    },

    // 保存文章时把字数/阅读时间存到主库
    beforeSavePost: async ({ data }) => {
      if (data.content) {
        const text = data.content.replace(/[#*_`\[\]()>]/g, '').replace(/\n/g, '');
        data.wordCount = text.length;
        data.readingTime = Math.max(1, Math.round(text.length / (ctx.config.wordsPerMinute || 400)));
      }
      return data;
    },
  };
}
```

---

#### ⑥ `sitemap-enhance` ❌ — sitemap.xml 额外规则（社区）

**核心问题**：核心 sitemap 只收录 Post 和 Page，可能需要加自定义 URL（比如相册、说说、友链页面）。

**插件做什么**：
```
核心 sitemap 生成器（customApi 扩展点）
  ↓ 插件可以往 sitemap.xml 里追加 URL
  ↓ 比如：
    ✅ /web/gallery（相册首页）
    ✅ /web/talks（说说）
    ✅ 自定义外部 URL（友情链接等）
  ↓ 支持配置每个 URL 的 priority 和 changefreq
```

**关键代码**：
```ts
// vendor/plugins/sitemap-enhance/index.ts
export default function sitemapEnhancePlugin(ctx: PluginContext) {
  return {
    customApi: [
      {
        path: '/sitemap.xml',  // 注意：和核心 sitemap 合并，不是替换
        handler: async () => {
          // 插件可以给核心 sitemap 追加 URL
          const extraUrls = [
            { loc: `${ctx.site.url}/web/gallery`, priority: '0.8', changefreq: 'weekly' },
            { loc: `${ctx.site.url}/web/talks`, priority: '0.6', changefreq: 'daily' },
          ];
          // 调用核心的 getCoreSitemapUrls() → 合并 → 输出
          // ...
        },
      },
    ],
  };
}
```

---

#### ⑦ `comment-filter` ❌ — 垃圾评论自动审核（社区）

**核心问题**：垃圾评论泛滥——广告、SPAM、人身攻击。手动审核太累。

**插件做什么**：
```
评论提交后（beforeCommentApprove 扩展点）
  ↓ 核心评论审核流程先调所有 beforeCommentApprove handler
  ↓ comment-filter 插件检查：
    ✅ 关键词黑名单（如"加微信"、"代购"、"免费领取"）
    ✅ IP 黑名单（同一 IP 1 分钟内发 > 3 条 → SPAM）
    ✅ 邮箱黑名单（一次性邮箱域名如 temp-mail.org）
    ✅ 链接数量（> 3 个外链 → 可能是广告）
    ✅ 内容相似度（和已有评论相似度 > 80% → 重复评论）
  ↓ 返回值：
    { action: 'approve' } → 自动通过
    { action: 'spam', reason: '检测到广告关键词' } → 标记 SPAM，不进入审核队列
    { action: 'hold' } → 进入人工审核队列（默认）
```

**plugin.json 配置**：
```json
{
  "slug": "comment-filter",
  "version": "1.0.0",
  "name": "垃圾评论自动过滤",
  "description": "关键词/IP/邮箱/链接检测，自动标记 SPAM",
  "configSchema": {
    "type": "object",
    "properties": {
      "keywordBlocklist": {
        "type": "array",
        "items": { "type": "string" },
        "default": ["加微信", "免费领取", "代购", "点击链接", "点击下面"],
        "title": "关键词黑名单"
      },
      "maxLinks": { "type": "number", "default": 3, "title": "最大外链数" },
      "maxPerMinute": { "type": "number", "default": 3, "title": "同 IP 每分钟上限" },
      "tempEmailDomains": {
        "type": "array",
        "default": ["temp-mail.org", "throwaway.email", "guerrillamail.com"],
        "title": "一次性邮箱域名"
      }
    }
  }
}
```

**关键代码**：
```ts
// vendor/plugins/comment-filter/index.ts
export default function commentFilterPlugin(ctx: PluginContext) {
  const ipCounter = new Map<string, number>();  // IP → 1 分钟窗口计数

  return {
    beforeCommentApprove: async ({ comment }) => {
      // ① 关键词检查
      for (const kw of ctx.config.keywordBlocklist || []) {
        if (comment.content.includes(kw)) {
          return { action: 'spam', reason: `关键词匹配: ${kw}` };
        }
      }

      // ② 同 IP 频率检查
      const ipCount = (ipCounter.get(comment.ip) || 0) + 1;
      ipCounter.set(comment.ip, ipCount);
      // 1 分钟后重置（简化版，可以用定时器或 TTL 缓存）
      setTimeout(() => ipCounter.set(comment.ip, Math.max(0, ipCounter.get(comment.ip)! - 1)), 60000);
      if (ipCount > (ctx.config.maxPerMinute || 3)) {
        return { action: 'spam', reason: '同 IP 发送频率过高' };
      }

      // ③ 外链数量检查
      const urlCount = (comment.content.match(/https?:\/\//g) || []).length;
      if (urlCount > (ctx.config.maxLinks || 3)) {
        return { action: 'spam', reason: `外链过多: ${urlCount}` };
      }

      // ④ 一次性邮箱检查
      const emailDomain = comment.email?.split('@')[1]?.toLowerCase();
      if (emailDomain && ctx.config.tempEmailDomains?.includes(emailDomain)) {
        return { action: 'spam', reason: '一次性邮箱域名' };
      }

      // 通过 → 让核心走正常审核流程
      return { action: 'hold' };
    },
  };
}
```

---

#### ⑧ `related-posts` ❌ — 相关文章推荐侧边栏（社区）

**核心问题**：文章详情页底部没有"你可能还喜欢"，读者看完一篇就走了。

**插件做什么**：
```
侧边栏渲染时（injectSidebarWidget 扩展点）
  ↓ 插件返回一个 React 组件
  ↓ 核心 Sidebar.tsx 会 fireExtensionPoint('injectSidebarWidget')
  ↓ 拿到所有插件返回的组件 → 按注册顺序渲染
  ↓ related-posts 组件的逻辑：
    ✅ 同分类优先（Category 相同的其他文章）
    ✅ 同标签加权（Tag 重叠度高的）
    ✅ 时间衰减（越新的越优先）
    ✅ 排除当前文章自己
    ✅ 显示 3-5 篇，带封面缩略图
```

**关键代码（组件）**：
```tsx
// vendor/plugins/related-posts/templates/RelatedPosts.tsx
// ⭐ 这是 React Server Component（因为插件默认跑 SSR）
// 可以直接 import 主库 Prisma client
import { db } from '../../../lib/prisma';

interface Props { currentPostId: number; categoryId?: number; tags?: { id: number }[] }

export default async function RelatedPosts({ currentPostId, categoryId, tags = [] }: Props) {
  // 用 Prisma $queryRaw 做标签重叠度排序（SQLite 没有原生 ARRAY 类型，需要 workaround）
  const related = await db.post.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: currentPostId },
      OR: [
        categoryId ? { categoryId } : {},
        tags.length ? { tags: { some: { id: { in: tags.map(t => t.id) } } } } : {},
      ].filter(Object.keys),
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
    take: 5,
    select: { id: true, title: true, slug: true, cover: true, summary: true },
  });

  if (related.length === 0) return null;

  return (
    <aside className="sidebar-widget">
      <h3 className="widget-title">相关文章</h3>
      <ul className="related-posts-list">
        {related.map(post => (
          <li key={post.id}>
            <a href={`/blog/${post.slug}`}>
              {post.cover && <img src={post.cover} alt="" width={60} height={60} />}
              <span>{post.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

**plugin.json**：
```json
{
  "slug": "related-posts",
  "version": "1.0.0",
  "entry": "index.ts",
  "configSchema": {
    "type": "object",
    "properties": {
      "maxItems": { "type": "number", "default": 5, "title": "最多推荐数" },
      "showCover": { "type": "boolean", "default": true, "title": "显示封面缩略图" },
      "strategy": {
        "type": "string", "default": "category-tags",
        "enum": ["category-tags", "tags-only", "same-author"],
        "title": "推荐策略"
      }
    }
  }
}
```

**扩展点 handler**：
```ts
// vendor/plugins/related-posts/index.ts
export default function relatedPostsPlugin() {
  return {
    injectSidebarWidget: async ({ pageType, data }) => {
      // 只在文章详情页显示（不在首页/列表页显示）
      if (pageType !== 'post') return null;

      const RelatedPosts = (await import('./templates/RelatedPosts')).default;
      return {
        component: RelatedPosts,
        props: {
          currentPostId: data.id,
          categoryId: data.categoryId,
          tags: data.tags,
        },
        weight: 50,  // 排序权重，越小越靠前
      };
    },
  };
}
```

***

## 五、⭐ 主题系统（仿 Halo / WordPress 主题体验）

### 5.1 后台主题管理界面结构

```
/console/system/themes                    ← 主题列表页（Halo 风格）
┌──────────────────────────────────────────────────────────┐
│  [安装新主题]  [从 ZIP 安装]  [从 Git 安装]               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ 🖼️ 默认主题 │  │ 🖼️ Dark    │  │ 🖼️ Minimal  │          │
│  │            │  │   暗夜     │  │   极简     │          │
│  │ v1.0.0     │  │ v2.1.0     │  │ v0.9.0     │          │
│  │            │  │ ✅ 激活中   │  │            │          │
│  │ [激活]     │  │ [设置]     │  │ [设置]     │          │
│  │ [预览]     │  │ [预览]     │  │ [预览]     │          │
│  │ [详情]     │  │ [详情]     │  │ [详情]     │          │
│  └────────────┘  └────────────┘  └────────────┘          │
│                                                          │
└──────────────────────────────────────────────────────────┘

/console/system/themes/[slug]/settings   ← 单个主题设置页（Halo/WP Customizer 风格）
┌──────────────────────────────────────────────────────────┐
│  Dark 暗夜主题 - 设置                        [重置默认]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📐 基础外观                                             │
│  ├── 主色调     [  #ff6b6b  ] 🎨 颜色选择器              │
│  ├── 背景模式   [ ○ 浅色  ● 深色  ○ 跟随系统 ]           │
│  ├── 圆角风格   [ ● 圆润 ○ 标准 ○ 方正 ]                 │
│  └── 字体家族   [ Inter ▾ ]                               │
│                                                          │
│  📑 布局                                                 │
│  ├── 侧边栏位置  [ ● 右侧 ○ 左侧 ○ 无侧边栏 ]             │
│  ├── 文章列表样式 [ ● 卡片 ○ 列表 ○ 瀑布流 ]              │
│  └── 每页文章数  [ 12 ]                                  │
│                                                          │
│  🔗 顶部导航                                             │
│  ├── 显示搜索框  [ ✓ ]                                    │
│  ├── 显示用户头像 [ ✓ ]                                   │
│  └── Logo 图片   [ 📤 上传 ] 或 [ URL 输入 ]              │
│                                                          │
│  ⚡ 高级                                                  │
│  ├── 自定义 CSS  [ ▼ 展开代码编辑器 ]                     │
│  └── 自定义 JS   [ ▼ 展开代码编辑器 ]                     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                              [取消]  [保存并应用]         │
└──────────────────────────────────────────────────────────┘
```

### 5.2 主题目录规范

```
vendor/themes/dark/
├── theme.json              # ⭐ 必须：元数据 + 配置 Schema
├── theme.ts                # ⭐ 必须：配置默认值 + CSS 变量映射
├── theme.css               # 必须：主题基础 CSS 变量
├── settings.tsx            # 可选：主题专属设置组件（如果动态表单不够用）
├── preview.png             # 必须：主题预览缩略图
├── README.md
└── components/             # 可选：覆盖默认组件
    ├── CustomHeader.tsx
    └── CustomPostCard.tsx
```

### 5.3 theme.json（完整配置 Schema 规范）

> **theme.json 是主题的"身份证 + 设置说明书"**，后台读取后自动渲染出设置表单。

```json
{
  "slug": "dark",
  "name": "暗夜主题",
  "version": "2.1.0",
  "description": "深色系极简风格，夜间护眼",
  "author": "RainyNest Team",
  "preview": "preview.png",
  "minRainyNestVersion": "1.0.0",
  "supports": ["dark-mode", "custom-css", "custom-js"],

  "configSchema": {
    "basic": {
      "label": "基础外观",
      "fields": {
        "primaryColor": {
          "label": "主色调",
          "type": "color",
          "default": "#3b82f6",
          "description": "按钮、链接、高亮的主色"
        },
        "bgMode": {
          "label": "背景模式",
          "type": "radio",
          "default": "dark",
          "options": [
            { "value": "light", "label": "浅色" },
            { "value": "dark", "label": "深色" },
            { "value": "auto", "label": "跟随系统" }
          ]
        },
        "radiusStyle": {
          "label": "圆角风格",
          "type": "select",
          "default": "rounded",
          "options": [
            { "value": "sharp", "label": "方正" },
            { "value": "rounded", "label": "标准" },
            { "value": "pill", "label": "圆润" }
          ]
        },
        "fontFamily": {
          "label": "字体家族",
          "type": "select",
          "default": "inter",
          "options": [
            { "value": "inter", "label": "Inter（现代无衬线）" },
            { "value": "noto-sc", "label": "思源黑体" },
            { "value": "serif", "label": "衬线体（阅读舒适）" },
            { "value": "mono", "label": "等宽（极客风）" }
          ]
        }
      }
    },

    "layout": {
      "label": "布局",
      "fields": {
        "sidebarPosition": {
          "label": "侧边栏位置",
          "type": "radio",
          "default": "right",
          "options": [
            { "value": "left", "label": "左侧" },
            { "value": "right", "label": "右侧" },
            { "value": "none", "label": "无侧边栏" }
          ]
        },
        "postListStyle": {
          "label": "文章列表样式",
          "type": "radio",
          "default": "card",
          "options": [
            { "value": "card", "label": "卡片" },
            { "value": "list", "label": "列表" },
            { "value": "masonry", "label": "瀑布流" }
          ]
        },
        "pageSize": {
          "label": "每页文章数",
          "type": "number",
          "default": 12,
          "min": 6,
          "max": 30
        },
        "showToc": {
          "label": "文章目录",
          "type": "boolean",
          "default": true,
          "description": "在文章右侧显示标题锚点"
        }
      }
    },

    "header": {
      "label": "顶部导航",
      "fields": {
        "showSearch": { "label": "显示搜索框", "type": "boolean", "default": true },
        "showAvatar": { "label": "显示用户头像", "type": "boolean", "default": true },
        "logoUrl": {
          "label": "Logo 图片",
          "type": "image",
          "description": "留空则使用站点标题文字"
        },
        "navLinks": {
          "label": "导航链接",
          "type": "keyvalue",
          "default": { "首页": "/", "博客": "/web/blog", "关于": "/web/about" }
        }
      }
    },

    "advanced": {
      "label": "高级",
      "fields": {
        "customCss": {
          "label": "自定义 CSS",
          "type": "textarea",
          "language": "css",
          "description": "会注入到所有页面的 <style> 标签中"
        },
        "customJs": {
          "label": "自定义 JS",
          "type": "textarea",
          "language": "javascript",
          "description": "会注入到 </body> 之前"
        }
      }
    }
  }
}
```

#### 支持的字段类型

| 类型          | 说明      | 渲染                                    |
| ----------- | ------- | ------------------------------------- |
| `text`      | 短文本     | Input                                 |
| `textarea`  | 长文本     | TextArea                              |
| `number`    | 数字      | NumberInput（可选 min/max/step）          |
| `boolean`   | 开关      | Switch / Checkbox                     |
| `color`     | 颜色值     | 颜色选择器（带预览）                            |
| `select`    | 单选下拉    | Select                                |
| `radio`     | 单选按钮组   | RadioGroup                            |
| `keyvalue`  | 键值对对象   | 可增删的 Key-Value 编辑器                    |
| `image`     | 图片 URL  | 上传组件 + URL 输入                         |
| `font`      | 字体选择    | 下拉 + 实时预览                             |
| `code`      | 代码块     | CodeMirror 编辑器（可指定 language）          |
| `component` | 主题自定义组件 | 动态 import `settings.tsx` 导出的 React 组件 |

### 5.4 theme.ts（配置 → CSS 变量映射）

> 后台保存的配置值存在数据库 `themes.config`（JSON）里。RainyNest 启动时从 DB 读出配置，每个主题的 `theme.ts` 负责把配置值转换成**最终注入到页面的 CSS 变量**。

```ts
// vendor/themes/dark/theme.ts
// 主题自己定义：配置值如何映射到 CSS 变量
export interface ThemeConfig {
  basic: {
    primaryColor: string;
    bgMode: 'light' | 'dark' | 'auto';
    radiusStyle: 'sharp' | 'rounded' | 'pill';
    fontFamily: string;
  };
  layout: {
    sidebarPosition: 'left' | 'right' | 'none';
    postListStyle: 'card' | 'list' | 'masonry';
    pageSize: number;
    showToc: boolean;
  };
  header: {
    showSearch: boolean;
    showAvatar: boolean;
    logoUrl?: string;
    navLinks: Record<string, string>;
  };
  advanced: {
    customCss?: string;
    customJs?: string;
  };
}

// 圆角风格映射
const radiusMap = {
  sharp: { sm: '0px', md: '0px', lg: '0px' },
  rounded: { sm: '4px', md: '8px', lg: '12px' },
  pill: { sm: '12px', md: '20px', lg: '28px' },
};

// 颜色调色板（根据 primaryColor 自动生成 hover 等衍生色）
function generateColorPalette(hex: string) {
  // 简单版本，实际可以用 culori/color 库
  return {
    primary: hex,
    primaryHover: hex.replace(/[0-9a-f]{2}$/, hex.slice(-2)), // 实际做 shade
  };
}

// ⭐ 核心函数：配置值 → CSS 变量字符串
export function configToCssVariables(config: ThemeConfig): Record<string, string> {
  const radius = radiusMap[config.basic.radiusStyle];
  const palette = generateColorPalette(config.basic.primaryColor);

  return {
    '--color-primary': palette.primary,
    '--color-primary-hover': palette.primaryHover,
    '--radius-sm': radius.sm,
    '--radius-md': radius.md,
    '--radius-lg': radius.lg,
    '--bg-mode': config.basic.bgMode,
    '--font-sans': getFontStack(config.basic.fontFamily),
    '--sidebar-position': config.layout.sidebarPosition,
  };
}

function getFontStack(key: string): string {
  const fonts: Record<string, string> = {
    inter: "'Inter', system-ui, -apple-system, sans-serif",
    'noto-sc': "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    serif: "'Source Serif 4', Georgia, 'Times New Roman', serif",
    mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  };
  return fonts[key] || fonts.inter;
}
```

### 5.5 主题配置加载流水线（SSG + ISR + SSR）

```
构建时 / ISR 刷新时
    ↓
lib/theme.ts → getActiveTheme() 从 DB 读激活主题
    ↓
拿到 Theme { slug: 'dark', config: { basic: {...}, layout: {...}, ... } }
    ↓
import(`vendor/themes/${slug}/theme.ts`) → 调用 configToCssVariables(config)
    ↓
得到 { '--color-primary': '#ff6b6b', '--radius-md': '20px', ... }
    ↓
┌── app/layout.tsx 注入两种 CSS ──┐
│  1. <link href="/themes/dark/theme.css">   ← 主题静态 CSS（基础变量默认值）
│  2. <style id="theme-dynamic-vars">         ← 动态生成的内联 <style>
│     :root {
│       --color-primary: #ff6b6b;
│       --radius-md: 20px;
│       --bg-mode: dark;
│     }
│     </style>
│  3. <style id="theme-custom-css">           ← 用户自定义 CSS（如果有）
│     body { font-size: 16px; }
│     </style>
│  4. <script>/* customJs */</script>         ← 用户自定义 JS（如果有）
└───────────────────────────────────────────────┘
    ↓
所有主题配置 → 变成 CSS 变量 → 组件直接读 var()
组件本身完全不知道主题的存在（解耦）
```

```tsx
// lib/theme.ts - 核心加载器
import fs from 'node:fs';
import path from 'node:path';
import { db } from './prisma';

const THEMES_DIR = path.join(process.cwd(), 'vendor', 'themes');

export interface ThemeMeta {
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

// 扫描所有已安装主题
export async function scanInstalledThemes(): Promise<ThemeMeta[]> {
  if (!fs.existsSync(THEMES_DIR)) return [];
  return fs.readdirSync(THEMES_DIR)
    .map(dir => {
      const jsonPath = path.join(THEMES_DIR, dir, 'theme.json');
      if (!fs.existsSync(jsonPath)) return null;
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    })
    .filter(Boolean);
}

// ⭐ 运行时从预编译目录加载（不是 vendor/ 源码目录）
const COMPILED_THEMES_DIR = path.join(process.cwd(), '.next', 'vendor-compiled', 'themes');

// 获取当前激活主题（从 DB + 加载预编译的主题配置映射函数）
export async function getActiveTheme() {
  // 1. 从数据库找 isActive = true 的主题
  const dbTheme = await db.theme.findFirst({ where: { isActive: true } });
  if (!dbTheme) return null;

  // 2. 读取 theme.json 元数据（源码目录读 JSON，不走预编译）
  const jsonPath = path.join(THEMES_DIR, dbTheme.slug, 'theme.json');
  if (!fs.existsSync(jsonPath)) return null;
  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // 3. 从预编译目录加载 theme.js（不是动态 import vendor/ 下的 .ts）
  let configToVars = (config: any) => config; // 默认 identity
  try {
    const compiledTheme = path.join(COMPILED_THEMES_DIR, dbTheme.slug, 'theme.js');
    if (fs.existsSync(compiledTheme)) {
      // require + ?t= 绕过 Node 缓存
      const mod = require(compiledTheme + '?t=' + Date.now());
      configToVars = mod.configToCssVariables || configToVars;
    }
  } catch { /* 主题没有 theme.ts，用默认映射 */ }

  // 4. 合并：DB 存的配置值（可能用户改过） + theme.json 里的默认值
  const mergedConfig = mergeWithDefault(meta.configSchema, dbTheme.config ? JSON.parse(dbTheme.config) : {});

  // 5. 生成 CSS 变量
  const cssVars = configToVars(mergedConfig);

  return {
    ...meta,
    dbId: dbTheme.id,
    config: mergedConfig,
    cssVars,
    customCss: mergedConfig.advanced?.customCss,
    customJs: mergedConfig.advanced?.customJs,
  };
}

// 辅助函数：把用户存的配置值和 schema 默认值合并
function mergeWithDefault(schema: any, userConfig: any): any {
  const result: any = {};
  for (const [key, group] of Object.entries(schema || {})) {
    result[key] = {};
    for (const [fieldKey, field] of Object.entries((group as any).fields || {})) {
      const userValue = userConfig?.[key]?.[fieldKey];
      result[key][fieldKey] = userValue !== undefined ? userValue : (field as any).default;
    }
  }
  return result;
}
```

### 5.6 后台主题设置 API

```
GET    /api/console/themes                 ← 列出所有已安装主题 + 激活状态
POST   /api/console/themes                 ← 安装新主题（上传 ZIP / Git URL）
GET    /api/console/themes/[slug]          ← 读单个主题详情（theme.json + DB 配置）
PUT    /api/console/themes/[slug]/activate ← 激活主题（+ revalidatePath）
PUT    /api/console/themes/[slug]/config   ← 保存主题设置（+ 清缓存 + revalidate）
DELETE /api/console/themes/[slug]          ← 卸载主题
POST   /api/console/themes/[slug]/reset    ← 重置为默认配置
```

```tsx
// app/api/console/themes/[slug]/config/route.ts
import { clearSiteSettingCache } from '@/lib/site';
import { getActiveTheme } from '@/lib/theme';
import { revalidatePath } from 'next/cache';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const dbTheme = await db.theme.findUnique({ where: { slug } });
  const meta = /* 读取 vendor/themes/{slug}/theme.json */ null;

  // 合并 schema 默认值 + DB 存的用户值
  const config = mergeWithDefault(meta.configSchema, dbTheme?.config ? JSON.parse(dbTheme.config) : {});

  return Response.json({ success: true, data: { schema: meta.configSchema, config } });
}

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.json();

  // 1. 校验（可以用 theme.json 的 config_schema 动态生成 Zod schema）
  const meta = /* 读取 theme.json */ null;
  const zodSchema = buildZodFromSchema(meta.configSchema);
  const parsed = zodSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, error: parsed.error }, { status: 400 });

  // 2. 存到数据库
  await db.theme.update({ where: { slug }, data: { config: JSON.stringify(parsed.data) } });

  // 3. 如果这个主题是激活中 → 触发 ISR 刷新前台
  const active = await db.theme.findFirst({ where: { isActive: true } });
  if (active?.slug === slug) {
    revalidatePath('/');
    revalidatePath('/web');
    revalidatePath('/web/blog');
    clearSiteSettingCache(); // 虽然不是 SiteSetting，但保持模式一致
  }

  return Response.json({ success: true });
}
```

### 5.7 动态设置表单（后台渲染）

后台设置页面**不硬编码**，而是读 theme.json 的 `configSchema` 后自动生成表单：

```tsx
// components/admin/ThemeSettingsForm.tsx
// 通用动态表单组件：根据 configSchema 渲染
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ColorPicker from './ColorPicker';
import Select from './Select';
import Switch from './Switch';
import CodeEditor from './CodeEditor';

interface ThemeSettingsFormProps {
  slug: string;
  schema: Record<string, any>;   // theme.json 的 configSchema
  initialConfig: Record<string, any>;
}

export function ThemeSettingsForm({ slug, schema, initialConfig }: ThemeSettingsFormProps) {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/console/themes/${slug}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    setSaving(false);
    // 可以加 toast 提示
  }

  return (
    <div className="space-y-8">
      {Object.entries(schema).map(([groupKey, group]: [string, any]) => (
        <section key={groupKey}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {getGroupIcon(groupKey)} {group.label}
          </h3>
          <div className="space-y-4">
            {Object.entries(group.fields).map(([fieldKey, field]: [string, any]) => (
              <FieldRenderer
                key={fieldKey}
                fieldKey={fieldKey}
                field={field}
                value={config[groupKey]?.[fieldKey]}
                onChange={(v) => setConfig(prev => ({
                  ...prev,
                  [groupKey]: { ...prev[groupKey], [fieldKey]: v },
                }))}
              />
            ))}
          </div>
        </section>
      ))}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? '保存中...' : '保存并应用'}
      </Button>
    </div>
  );
}

// 单个字段渲染器（根据 field.type 决定用哪个组件）
function FieldRenderer({ fieldKey, field, value, onChange }: any) {
  switch (field.type) {
    case 'color':
      return <ColorPicker label={field.label} value={value ?? field.default} onChange={onChange} />;

    case 'boolean':
      return <Switch label={field.label} checked={value ?? field.default} onCheckedChange={onChange} />;

    case 'select':
    case 'radio':
      return (
        <Select
          label={field.label}
          value={value ?? field.default}
          options={field.options}
          onChange={onChange}
        />
      );

    case 'number':
      return (
        <div>
          <label className="text-sm text-gray-700">{field.label}</label>
          <Input type="number" value={value ?? field.default} onChange={e => onChange(+e.target.value)} />
        </div>
      );

    case 'textarea':
    case 'code':
      return (
        <div>
          <label className="text-sm text-gray-700">{field.label}</label>
          <CodeEditor
            value={value ?? ''}
            language={field.language}
            onChange={onChange}
          />
        </div>
      );

    case 'image':
      return (
        <div>
          <label className="text-sm text-gray-700">{field.label}</label>
          <div className="flex gap-2">
            <Input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="图片 URL" />
            <Button variant="outline" size="sm">📤 上传</Button>
          </div>
          {value && <img src={value} className="mt-2 h-20 rounded" alt="preview" />}
        </div>
      );

    default: // text / textarea
      return (
        <div>
          <label className="text-sm text-gray-700">{field.label}</label>
          <Input value={value ?? ''} onChange={e => onChange(e.target.value)} />
        </div>
      );
  }
}
```

### 5.8 SSR/SSG/ISR 策略（主题相关）

| 场景                                         | 策略                                        | 说明                                                |
| ------------------------------------------ | ----------------------------------------- | ------------------------------------------------- |
| **`app/layout.tsx`（注入主题 CSS 处）**           | **SSR + SSG + ISR**                       | 构建时查 DB 预渲染，ISR 1h 刷新，激活/保存配置时主动 `revalidatePath` |
| 前台所有页面                                     | SSG + ISR 1h                              | 主题配置变化后下一个 ISR 周期自动刷新                             |
| 后台主题列表页                                    | SSR                                       | 实时状态                                              |
| 后台单个主题设置页                                  | SSR                                       | 读取 theme.json schema + DB 配置                      |
| `/api/console/themes/*` API                | 动态                                        | 每次操作都要改 DB                                        |
| 主题 CSS 文件 `public/themes/{slug}/theme.css` | 静态资源                                      | 直接返回                                              |
| 用户自定义 CSS/JS                               | **内联** **`<style>`** **/** **`<script>`** | 存在 DB themes.config 里，layout.tsx 读取后注入            |

### 5.9 主题安装/管理流程

```
安装新主题：
  方式 A：上传 ZIP → 解压到 vendor/themes/{slug}/
  方式 B：输入 Git URL → git clone 到 vendor/themes/{slug}/
  方式 C：后台"主题市场" → npm / GitHub Releases 下载
  → 自动校验 theme.json（必需字段、版本兼容性、config_schema 格式）
  → 复制到 public/themes/{slug}/（运行时实际提供的目录）
  → 写入数据库 themes 表（slug/name/version/config=JSON.stringify(schema 默认值)）

激活主题：
  1. PUT /api/console/themes/[slug]/activate
  2. db.theme.updateMany({ data: { isActive: false } })  // 其他全部取消
  3. db.theme.update({ where: { slug }, data: { isActive: true } })
  4. revalidatePath('/') + revalidatePath('/web/blog')  // 强制刷新 ISR

保存主题设置：
  1. PUT /api/console/themes/[slug]/config
  2. db.theme.update({ where: { slug }, data: { config: JSON.stringify(newConfig) } })
  3. 判断这个主题是否激活 → 激活则 revalidatePath 触发前台刷新

卸载主题：
  1. DELETE /api/console/themes/[slug]
  2. 禁止卸载当前激活的（先切换到其他）
  3. fs.rmrf vendor/themes/{slug} + public/themes/{slug}
  4. db.theme.delete({ where: { slug } })

预览主题（不激活）：
  方式 A：URL 参数 ?theme={slug}（客户端切换，用于快速预览效果）
  方式 B：后台"预览"按钮 → 新窗口打开 /web?theme={slug}&preview=xxx 带 token
  → 可以用 cookie 存预览 token，绕过 isActive 检查
```

### 5.10 目录同步脚本（启动时自动跑）

```js
// scripts/sync-themes.js
// 把 vendor/themes/（源码）复制到 public/themes/（运行时静态资源）
// theme.json 里配置的 customCss 不在这里，因为 customCss 存在 DB 里，通过 SSR 内联注入

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'vendor', 'themes');
const DEST = path.join(__dirname, '..', 'public', 'themes');

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true });
fs.mkdirSync(DEST, { recursive: true });

if (fs.existsSync(SRC)) {
  for (const themeDir of fs.readdirSync(SRC)) {
    fs.cpSync(path.join(SRC, themeDir), path.join(DEST, themeDir), { recursive: true });
  }
}

console.log('✓ Themes synced to public/themes/');
```

```json
// package.json - 启动前自动同步
{
  "scripts": {
    "predev": "node scripts/sync-themes.js",
    "prestart": "node scripts/sync-themes.js",
    "prebuild": "node scripts/sync-themes.js"
  }
}
```

### 5.11 主题开发指引（给主题开发者的文档）

每个主题应该自带一个 `README.md`，内容模板：

```markdown
# {主题名}

作者：{你的名字}
版本：{版本号}
RainyNest 最低版本：1.0.0

## 功能特性
- ✅ 深色/浅色模式自适应
- ✅ 侧边栏位置可切换
- ✅ 代码高亮主题自定义

## 配置项
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| primaryColor | color | #3b82f6 | 主色调 |
| bgMode | radio | dark | 背景模式 |

## 目录结构
```

my-theme/
├── theme.json          # 配置 Schema
├── theme.ts            # 配置 → CSS 变量映射
├── theme.css           # 基础 CSS 变量
├── preview\.png         # 预览图（800x600）
├── components/         # 可选：覆盖默认组件
│   └── CustomHeader.tsx
└── README.md

````

## 开发调试
```bash
# 1. 把主题放到 vendor/themes/my-theme/
# 2. npm run dev
# 3. 后台 系统 → 主题 → 激活
````

````

---

## 六、Markdown 渲染（完整移植 Firefly 技术栈）

> 参考：[CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly) v6.16.9 真实配置（2025 活跃更新中）
> 架构：remark（Markdown → MDAST）→ rehype（MDAST → HAST）→ React 组件渲染（HAST → JSX）

### 6.1 Firefly → RainyNest 插件对照表

| 功能 | Firefly 用的 | RainyNest（Next.js）替换 |
|------|-------------|-------------------------|
| Markdown 解析入口 | `@astrojs/markdown-remark` 的 `unified()` | `react-markdown`（底层也是 unified，直接传 remark/rehype 插件） |
| 代码高亮 | `astro-expressive-code` + 插件链 | **`@expressive-code/core`（脱离 Astro 独立使用）** + `pluginLineNumbers` / `pluginCollapsible` / `pluginLanguageBadge` / `pluginLanguageLogo` / `pluginCollapsibleSections` |
| GFM | 内置 | `remark-gfm` |
| 数学公式 | `remark-math` + `rehype-katex` | 同 |
| 标题锚点 | `rehype-slug` + `rehype-autolink-headings` | 同 |
| Callout 块 | `rehype-callouts` | 同 |
| Tab 代码块 | `rehype-code-group` | 同 |
| 外链处理 | 自定义 `rehype-external-links` | `rehype-external-links`（npm 包） |
| 邮箱保护 | 自定义 `rehype-email-protection` | 同（npm 包） |
| 图片 Figure | 自定义 `rehype-figure` | 同 |
| 阅读时间 | `remark-reading-time`（自定义） | npm 包 `remark-reading-time` |
| 章节分组 | `remark-sectionize` | 同 |
| admonition → callout | `remark-admonition-to-blockquote-callout` | 同 |
| Wiki 双链 | `remark-wiki-link` | 同（可选） |
| 图片网格 | 自定义 `remark-image-grid` | 同（可选） |
| Mermaid 图表 | `remark-mermaid` + `rehype-mermaid` | 同（可选） |
| PlantUML 图表 | `remark-plantuml` + `rehype-plantuml` | 同（可选） |
| XSS 防护 | `sanitize-html` | 同 |

### 6.2 核心渲染代码（完整 Firefly 风格）

```tsx
// lib/markdown/renderer.tsx
// 完全对齐 Firefly 的 astro.config.mjs 里的 markdown.processor 配置
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkSectionize from 'remark-sectionize';
import remarkDirective from 'remark-directive';
import remarkAdmonitionToBlockquoteCallout from 'remark-admonition-to-blockquote-callout';
import remarkWikiLink from 'remark-wiki-link';           // 可选，双链
import remarkReadingTime from 'remark-reading-time';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeCallouts from 'rehype-callouts';
import rehypeCodeGroup from 'rehype-code-group';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeFigure from 'rehype-figure';
import rehypeEmailProtection from 'rehype-email-protection';
import rehypeRaw from 'rehype-raw';                     // 允许原始 HTML（配合 sanitize-html）
import katex from 'katex';

// ⭐ Expressive Code（脱离 Astro 独立使用，代码高亮核心）
import { createRehypeExpressiveCode, pluginLineNumbers } from '@expressive-code/core';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginCollapsible } from 'expressive-code-collapsible';
import { pluginLanguageBadge } from 'expressive-code-language-badge';
import { pluginLanguageLogo } from 'ec-lang-logo';

// 主题色（可被 RainyNest 主题系统的 CSS 变量覆盖）
const EC_LIGHT_THEME = {
  name: 'github-light',
  // 实际用 Expressive Code 内置主题或从 Shiki 获取
};
const EC_DARK_THEME = {
  name: 'github-dark',
};

const rehypeExpressiveCode = createRehypeExpressiveCode({
  themes: [EC_LIGHT_THEME, EC_DARK_THEME],
  useDarkModeMediaQuery: false,
  themeCssSelector: (theme: { name: string }) => `[data-theme='${theme.name}']`,
  plugins: [
    pluginLineNumbers(),
    pluginCollapsibleSections(),
    pluginLanguageBadge(),
    pluginLanguageLogo(),
    pluginCollapsible({
      lineThreshold: 15,
      previewLines: 8,
      defaultCollapsed: true,
      expandButtonText: '展开',
      collapseButtonText: '收起',
    }),
  ],
  defaultProps: { wrap: false },
  styleOverrides: {
    borderRadius: '0.75rem',
    codeFontSize: '0.875rem',
    codeFontFamily: 'var(--font-mono, ui-monospace, Menlo, Monaco, monospace)',
    codeLineHeight: '1.5rem',
  },
  frames: { showCopyToClipboardButton: true }, // 内置复制按钮
});

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      // ===== Remark 插件（Markdown → MDAST）=====
      remarkPlugins={[
        remarkGfm,                                        // GFM：表格/删除线/任务列表/自动链接
        remarkMath,                                       // $...$ 数学公式
        remarkSectionize,                                 // heading 自动分组为 <section>
        remarkDirective,                                  // :::note 自定义指令
        remarkAdmonitionToBlockquoteCallout,              // Python 风格 admonition → callout
        [remarkWikiLink, { pageResolver: (name: string) => `/pages/${name}` }], // [[双链]]
        remarkReadingTime,                                // 阅读时间统计
      ]}

      // ===== Rehype 插件（MDAST → HAST）=====
      rehypePlugins={[
        [rehypeRaw, { passThrough: ['table'] }],          // 允许原始 HTML（安全可控）
        [rehypeKatex, { katex }],                         // KaTeX 数学公式渲染
        [rehypeCallouts, { theme: 'github' }],            // Callout 块
        rehypeSlug,                                        // heading 自动加 ID
        [rehypeAutolinkHeadings, {                        // 标题锚链接
          behavior: 'append',
          properties: { className: ['anchor'] },
          content: { type: 'element', tagName: 'span', properties: { className: ['anchor-icon'] }, children: [{ type: 'text', value: '#' }] },
        }],
        rehypeCodeGroup,                                   // Tab 代码块（多语言并排）
        rehypeExpressiveCode,                              // ⭐ Expressive Code 代码高亮
        rehypeFigure,                                      // 图片自动包 <figure> + <figcaption>
        [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
        [rehypeEmailProtection, { method: 'base64' }],
      ]}

      // ===== React 组件覆盖（HAST → JSX 时自定义）=====
      components={{
        a: ({ href, children, ...props }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
        ),
        img: ({ src, alt, ...props }) => (
          <img src={src} alt={alt} loading="lazy" decoding="async" className="rounded-lg" {...props} />
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-6 border border-[var(--color-border)] rounded-lg">
            <table className="w-full border-collapse">{children}</table>
          </div>
        ),
        pre: ({ children }) => (
          <pre className="my-6 rounded-xl overflow-hidden" data-theme>{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-[var(--color-primary)] pl-4 py-2 my-6 bg-[var(--color-bg-secondary)] rounded-r-lg">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
````

### 6.3 插件可配置项（放到后台）

这些功能在 Firefly 里是配置文件控制的，RainyNest 改成 **后台系统配置页开关 + SiteSetting 表**：

| 功能                | SiteSetting 字段                    | 默认    | 可后台切换    |
| ----------------- | --------------------------------- | ----- | -------- |
| 代码高亮              | 固定 Expressive Code                | -     | ❌ 代码级锁定  |
| 行号                | SiteSetting.codeShowLineNumbers   | true  | ✅        |
| 代码块折叠             | SiteSetting.codeCollapsible       | true  | ✅        |
| 折叠阈值（行）           | SiteSetting.codeCollapseThreshold | 15    | ✅        |
| 语言徽章              | SiteSetting.codeLanguageBadge     | true  | ✅        |
| Tab 代码块           | SiteSetting.codeTabGroup          | true  | ✅        |
| Callout 块         | SiteSetting.enableCallouts        | true  | ✅        |
| 数学公式              | SiteSetting.enableMath            | true  | ✅        |
| Wiki 双链           | SiteSetting.enableWikiLink        | false | ✅        |
| Mermaid 图表        | SiteSetting.enableMermaid         | false | ✅        |
| PlantUML 图表       | SiteSetting.enablePlantuml        | false | ✅        |
| 阅读时间              | SiteSetting.enableReadingTime     | true  | ✅        |
| 邮箱保护              | SiteSetting.enableEmailProtection | true  | ✅        |
| 外链 target=\_blank | 固定                                | true  | ❌ 安全策略锁定 |

后台配置修改后 → `clearSiteSettingCache()` → Markdown 渲染器重新读取配置 → 下次 ISR 刷新生效。

### 6.4 KaTeX 字体加载（CSS）

```tsx
// app/layout.tsx 或 globals.css 里引入 KaTeX 样式
// 只在启用 enableMath 时加载，避免浪费体积
import 'katex/dist/katex.min.css';
```

### 6.5 Expressive Code vs rehype-pretty-code

| 特性                 | Expressive Code（Firefly 用的）           | rehype-pretty-code（我们之前选的） |
| ------------------ | ------------------------------------- | -------------------------- |
| 代码高亮引擎             | Shiki                                 | Shiki                      |
| 行号                 | ✅ 内置                                  | ❌ 需额外插件                    |
| 代码折叠               | ✅ 内置                                  | ❌                          |
| Tab 并排             | ❌ 需额外 rehype-code-group               | ❌                          |
| 语言徽章               | ✅ 内置                                  | ❌                          |
| 语言 Logo            | ✅ 内置                                  | ❌                          |
| 复制按钮               | ✅ 内置                                  | ❌ 需自己写                     |
| 明暗主题               | ✅ 原生支持                                | ✅ 支持                       |
| 与 React/Next.js 兼容 | ✅ `@expressive-code/core` 脱离 Astro 可用 | ✅ 纯 rehype                 |
| 体积                 | 稍大（插件多）                               | 更小                         |

**结论：Expressive Code 功能完胜，和 Firefly 风格完全一致，RainyNest 直接用 Expressive Code 核心库。**

### 6.6 架构图

```
Markdown 原始文本（数据库 content 字段）
        ↓
ReactMarkdown 入口（接收 remark + rehype 插件数组）
        ↓
┌─── Remark 插件链（Markdown → MDAST）───┐
│  remark-gfm        → 表格/删除线/任务列表  │
│  remark-math       → $...$ 数学公式标记   │
│  remark-sectionize → heading → <section> │
│  remark-directive  → :::note 自定义指令   │
│  remark-admonition →  admonition → callout │
│  remark-wiki-link  → [[双链]]            │
│  remark-reading-time → 阅读时间           │
└─────────────────────────────────────────┘
        ↓ MDAST
┌─── Rehype 插件链（MDAST → HAST）───┐
│  rehype-raw           → 允许原始 HTML │
│  rehype-katex         → 数学公式渲染   │
│  rehype-callouts      → Callout 块   │
│  rehype-slug          → heading 加 ID │
│  rehype-autolink-headings → 锚链接   │
│  rehype-code-group    → Tab 代码块    │
│  @expressive-code     → ⭐ 代码高亮核心 │
│  rehype-figure        → 图片 <figure> │
│  rehype-external-links→ 外链处理      │
│  rehype-email-protection → 邮箱保护   │
└───────────────────────────────────────┘
        ↓ HAST
ReactMarkdown 内置的 HAST → JSX 转换
        ↓
自定义 components 覆盖（a, img, table, pre, blockquote）
        ↓
最终 JSX → 浏览器渲染
```

### 6.7 后台编辑器

```tsx
// components/admin/MarkdownEditor.tsx
// 默认用 Tiptap（现代、可扩展、WYSIWYG + Markdown 双模）
// 也支持切换到 Milkdown 或 EasyMDE
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

export function MarkdownEditor({ value, onChange }) {
  const lowlight = createLowlight(common);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始写点什么...' }),
      Image,
      Link.configure({ openOnClick: false }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return <EditorContent editor={editor} className="prose max-w-none min-h-[400px]" />;
}
```

***

## 七、SEO 策略（Next.js 15 原生）

### 7.1 Metadata 全部从数据库读

```tsx
// app/layout.tsx - 全局 generateMetadata（异步，从 SiteSetting + 当前激活主题读）
export async function generateMetadata(): Promise<Metadata> {
  const [site, theme] = await Promise.all([
    getSiteSetting(),
    getActiveTheme(),
  ]);
  const url = site?.url || 'http://localhost:3000';
  const primaryColor = site?.primaryColor || theme?.config?.primaryColor || '#3b82f6';

  return {
    metadataBase: new URL(url),
    title: {
      default: site?.title || 'RainyNest',
      template: `%s | ${site?.title || 'RainyNest'}`,
    },
    description: site?.description,
    keywords: site?.keywords?.split(',').map(s => s.trim()) || [],
    themeColor: primaryColor,
    verification: {
      google: site?.googleVerification,
      other: { baidu: site?.baiduVerification },
    },
    // ... OpenGraph, Twitter Card, alternates 同之前版本
  };
}
```

### 7.2 核心 SEO 要素

| 要素                       | 实现                                               |
| ------------------------ | ------------------------------------------------ |
| ✅ 语义化 HTML               | 文章页用 `<article>` + `<h1>` + `<nav>` + `<header>` |
| ✅ 语义化 URL                | `/web/blog/{slug}`，禁止数字 ID                       |
| ✅ Canonical URL          | Metadata API 自动生成                                |
| ✅ sitemap.xml            | `app/sitemap.ts` 动态生成，后台可开关                      |
| ✅ robots.txt             | `app/robots.ts` 动态生成                             |
| ✅ RSS Feed               | `/api/feed` Route Handler                        |
| ✅ JSON-LD Article Schema | 每篇文章注入                                           |
| ✅ 404 页面                 | `app/not-found.tsx`                              |
| ✅ 移动友好                   | Tailwind 响应式 + viewport meta                     |
| ✅ Core Web Vitals        | Next.js `<Image>` + gzip + CSS 变量主题切换（无 JS 延迟）   |

***

## 七-A、邮件通知模块（lib/mailer.ts）

SiteSetting 里已经有 SMTP 字段（smtpHost/smtpPort/smtpUser/smtpPass/smtpFrom），但之前没有实现发送邮件的代码。RainyNest 需要发邮件的场景：

| 场景 | 触发时机 | 接收方 |
|------|---------|--------|
| 评论审核通过 | 管理员点"通过" | 评论者 |
| 评论审核拒绝 | 管理员点"拒绝" | 评论者 |
| 新评论待审核 | 有人发评论 → 状态 PENDING | 管理员（smtpFrom 配置的邮箱） |
| 用户注册验证 | 用户注册（邮箱验证码开启时） | 新用户 |
| 密码重置 | 用户点"忘记密码" | 用户 |
| 插件 notifier | 插件扩展点触发 | 自定义 |

```ts
// lib/mailer.ts
// 统一邮件发送入口，所有业务场景都走这里
// 插件 notifier 扩展点可以替换/增强这个实现

import nodemailer from 'nodemailer';
import { getSiteSetting } from './site';

let transporter: nodemailer.Transporter | null = null;

// 懒加载 SMTP 连接（第一次发邮件时才初始化，避免无 SMTP 配置时报错）
async function getTransporter() {
  if (transporter) return transporter;

  const site = await getSiteSetting();
  if (!site?.smtpHost) {
    throw new Error('SMTP 未配置，请在后台系统设置里填写 SMTP 信息');
  }

  transporter = nodemailer.createTransport({
    host: site.smtpHost,
    port: site.smtpPort || 587,
    secure: (site.smtpPort || 587) === 465,  // 465 用 SSL，其他用 STARTTLS
    auth: site.smtpUser ? {
      user: site.smtpUser,
      pass: site.smtpPass,
    } : undefined,
    from: site.smtpFrom || site.email,
  });

  return transporter;
}

// 发送邮件（所有业务场景都调这个）
export async function sendMail(to: string | string[], opts: {
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}) {
  try {
    const t = await getTransporter();
    const site = await getSiteSetting();

    const info = await t.sendMail({
      from: site?.smtpFrom || site?.email || 'rainynest@localhost',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });

    console.log(`[Mailer] ✓ Sent to ${Array.isArray(to) ? to.join(', ') : to} (${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] ✗ Failed:', err);
    return { ok: false, error: (err as Error).message };
  }
}

// 常用业务场景封装
export const mailScenes = {
  commentApproved: (to: string, postTitle: string, commentContent: string) =>
    sendMail(to, {
      subject: `你的评论已通过审核 - ${postTitle}`,
      html: `<p>你在文章 <strong>${postTitle}</strong> 下的评论已通过审核。</p>
             <blockquote>${commentContent}</blockquote>`,
    }),

  newCommentPending: async (postTitle: string, commenterEmail: string, content: string) => {
    const site = await getSiteSetting();
    if (!site?.email) return null;  // 管理员邮箱未配置则跳过
    return sendMail(site.email, {
      subject: `新评论待审核 - ${postTitle}`,
      html: `<p><strong>${commenterEmail}</strong> 在 <em>${postTitle}</em> 下发表了评论：</p>
             <blockquote>${content}</blockquote>
             <p><a href="${site.url}/console/comments">去审核</a></p>`,
    });
  },

  emailVerification: (to: string, code: string, siteName: string) =>
    sendMail(to, {
      subject: `【${siteName}】邮箱验证码`,
      html: `<p>你的验证码是：<strong style="font-size: 24px; letter-spacing: 4px;">${code}</strong></p>
             <p>5 分钟内有效，请勿泄露给他人。</p>`,
    }),
};

// SMTP 连接测试（后台"测试连接"按钮调用）
export async function testSmtpConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const t = await getTransporter();
    await t.verify();
    return { ok: true, message: 'SMTP 连接成功' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
```

## 七-B、全文搜索（SQLite FTS5 默认实现）

插件系统有 `searchProvider` 扩展点（可替换默认搜索引擎），但核心默认搜索用 **SQLite 原生 FTS5 全文搜索**——零额外依赖、性能足够博客规模（<10 万篇文章）。

### FTS5 虚拟表（主库 schema 扩展）

```sql
-- 在 db/ 初始化时执行（或在 Prisma 迁移里用 raw SQL）
CREATE VIRTUAL TABLE IF NOT EXISTS post_fts USING fts5(
  title, summary, content,
  content='Post', content_rowid='rowid',
  tokenize='porter unicode61'
);

-- 触发器：文章创建/更新/删除时同步 FTS 表
CREATE TRIGGER IF NOT EXISTS post_ai AFTER INSERT ON Post BEGIN
  INSERT INTO post_fts(rowid, title, summary, content) VALUES (new.rowid, new.title, new.summary, new.content);
END;

CREATE TRIGGER IF NOT EXISTS post_ad AFTER DELETE ON Post BEGIN
  INSERT INTO post_fts(post_fts, rowid, title, summary, content) VALUES('delete', old.rowid, old.title, old.summary, old.content);
END;

CREATE TRIGGER IF NOT EXISTS post_au AFTER UPDATE ON Post BEGIN
  INSERT INTO post_fts(post_fts, rowid, title, summary, content) VALUES('delete', old.rowid, old.title, old.summary, old.content);
  INSERT INTO post_fts(rowid, title, summary, content) VALUES (new.rowid, new.title, new.summary, new.content);
END;
```

### 搜索 API

```ts
// lib/search/default-provider.ts
// 默认搜索实现（FTS5），searchProvider 插件可以替换它

import { db } from '../prisma';
import type { SearchProvider, SearchResult } from './types';

export const defaultSearchProvider: SearchProvider = {
  name: 'fts5',
  builtIn: true,

  async search(query: string, options?: { limit?: number; offset?: number }): Promise<SearchResult[]> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    // ⚠️ 用 Prisma 的 $queryRaw 执行原生 SQL（Prisma 不支持 FTS5 查询语法）
    // SQLite FTS5 语法：MATCH + BM25 排序
    const rows = await db.$queryRaw<SearchResult[]>`
      SELECT p.id, p.title, p.slug, p.summary, p.categoryId,
             snippet(post_fts, 2, '<mark>', '</mark>', '...') as snippet,
             rank * bm25(post_fts) as score
      FROM post_fts
      JOIN Post p ON p.rowid = post_fts.rowid
      WHERE post_fts MATCH ${query.replace(/'/g, "''")}
        AND p.status = 'PUBLISHED'
      ORDER BY score
      LIMIT ${limit} OFFSET ${offset}
    `;

    return rows;
  },
};
```

```ts
// app/web/search/page.tsx —— 前台搜索页
export const dynamic = 'force-dynamic';  // 搜索需要实时，不走 SSG + ISR

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const results = q ? await defaultSearchProvider.search(q, { limit: 20 }) : [];
  // 渲染结果列表，snippet 里的 <mark> 高亮匹配词
}
```

### 插件 searchProvider 扩展点替换

```ts
// 如果插件想换搜索（比如接 Meilisearch / Algolia）
// 在 plugin.json 里声明 searchProvider，核心 fireExtensionPoint('searchProvider') 取第一个有效结果
// RainyNest 内部：fireExtensionPoint('searchProvider') → 有插件实现就用插件的，没有就用 defaultSearchProvider
```

***

## 八、后台功能清单

### 仪表盘（/console）

```
┌──────────────────────────────────────────────┐
│ 总览                                          │
│  ├── 今日/本周/本月文章数                       │
│  ├── 待审核评论数                              │
│  ├── 今日浏览量 PV/UV                          │
│  ├── 热文 Top 5                                │
│  └── 实时在线（WebSocket，可选）                │
└──────────────────────────────────────────────┘
```

### 内容（/console/posts 等）

| 模块   | 功能                                    |
| ---- | ------------------------------------- |
| 文章   | 列表/搜索/筛选/草稿/发布/定时发布/置顶/批量删除           |
| 编辑器  | Tiptap 可视化 + Markdown 源码模式切换，图片上传，代码块 |
| 分类   | CRUD，slug 自动生成，文章数统计                  |
| 标签   | CRUD，slug 自动生成，合并标签                   |
| 评论   | 列表/搜索/审核通过/拒绝/删除/批量操作                 |
| 独立页面 | 关于/隐私等，独立 slug，可选择侧边栏显示               |
| 说说   | 短文本 + 多图上传，时间轴展示                      |
| 相册   | 相册 CRUD + 拖拽上传照片 + 批量管理               |

### 系统（/console/system）

| 模块     | 功能                                             |
| ------ | ---------------------------------------------- |
| 配置     | 站点所有设置（SiteSetting 表），分组 Tab：基础/SEO/社交/SMTP/功能 |
| 菜单     | 多级菜单，拖拽排序，支持自定义 URL 和图标                        |
| 用户     | 用户列表，角色管理（USER/ADMIN），重置密码                     |
| **主题** | 已安装列表（激活/预览/卸载）+ 安装新主题（zip/git）+ 主题自定义配置       |
| **插件** | 已安装列表（启用/禁用/卸载）+ 安装新插件 + 插件专属配置面板              |

### 工具（/console/tools）

| 模块   | 功能                                     |
| ---- | -------------------------------------- |
| 访问统计 | PV/UV 趋势图（日/周/月），热门文章 Top 10，来源分析，访客地域 |
| 备份   | SQLite 数据库一键下载备份，定期自动备份                |
| 缓存   | 清空 ISR 缓存，清空浏览量统计，重建索引                 |

***

## 九、环境变量（4 项，仅框架敏感配置）

```bash
# ========== 主库（业务数据）—— Prisma schema.prisma 读取 ==========
DATABASE_URL="file:./db/blog.db"

# ========== 访问库（访问统计）—— Prisma analytics.prisma 读取 ==========
# ⚠️ 双库架构必须保留这一项，3.7 节有完整说明
ANALYTICS_DATABASE_URL="file:./db/analytics.db"

# ========== NextAuth（认证框架）初始化时读取 ==========
NEXTAUTH_SECRET="change-me-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

> **为什么只有 4 项？** 所有业务配置（站点标题、SMTP、站长验证、功能开关、插件配置等）全部在**后台系统配置页**存入数据库 `SiteSetting` 表，实时生效。.env 里只保留框架启动必需的敏感连接串。
>
> 插件扩展点可以通过 `PluginContext.env` 读取环境变量（只读）。

***

## 十、Next.js 15 渲染策略总表

| 页面          | 路径                               | 策略              | 代码写法                                                        |
| ----------- | -------------------------------- | --------------- | ----------------------------------------------------------- |
| 首页          | `/web`                           | SSG + ISR 1h    | `export const dynamic = 'force-static'; revalidate = 3600;` |
| 文章列表        | `/web/blog`                      | SSG + ISR 1h    | 同上                                                          |
| 文章详情        | `/web/blog/[slug]`               | SSG + ISR 1h    | 同上                                                          |
| 说说列表        | `/web/moments`                   | SSG + ISR 10min | `revalidate = 600`                                          |
| 相册列表        | `/web/gallery`                   | SSG + ISR 1h    | 同文章                                                         |
| 友链          | `/web/links`                     | SSG + ISR 1h    | 同上                                                          |
| 归档          | `/web/archive`                   | SSG             | 固定内容，revalidate 可不加                                         |
| 标签云         | `/web/tags`                      | SSG + ISR 1h    | 同上                                                          |
| 后台所有页       | `/console/*`                     | SSR（动态）         | 默认，或显式 `force-dynamic`                                      |
| 仪表盘统计       | `/console`                       | SSR             | 实时数据                                                        |
| sitemap.xml | `/sitemap.xml`                   | SSG + ISR 1h    | Next.js 原生支持                                                |
| robots.txt  | `/robots.txt`                    | SSG             | Next.js 原生支持                                                |
| RSS         | `/api/feed`                      | SSG + ISR 10min | Route Handler 加 revalidate                                  |
| 浏览量 +1      | `/api/posts/[id]/increment-view` | 动态              | `force-dynamic`                                             |
| 评论列表        | `/api/comments`                  | 动态              | `force-dynamic`                                             |

***

## 十一、部署方案

### 自托管（最推荐，SQLite 完美）

```bash
# Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/db ./db
COPY --from=builder /app/vendor ./vendor
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

```bash
# docker run -d \
#   -p 8080:3000 \
#   -v /data/rainynest/db:/app/db \      # SQLite 持久化
#   -v /data/rainynest/uploads:/app/public/uploads \
#   -v /data/rainynest/themes:/app/vendor/themes \   # 主题持久化
#   -v /data/rainynest/plugins:/app/vendor/plugins \  # 插件持久化
#   --name rainynest \
#   rainynest:latest
```

### Vercel + Turso

```bash
# 如果想上 Vercel（无状态），用 Turso（SQLite serverless）替换本地文件
# 改 db/schema.prisma datasource url 为 libsql://...
# 其他代码零改动
```

### PM2 + Nginx（服务器部署）

```bash
# 1. 服务器装 Node 20+
# 2. git clone + npm ci + npx prisma generate + npm run build
# 3. PM2 守护
npm i -g pm2
pm2 start npm --name rainynest -- start
pm2 save && pm2 startup

# 4. Nginx 反代
server {
  listen 80;
  server_name blog.yourdomain.com;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
```

***

## 十二、项目搭建步骤

```
Phase 1 - 基础骨架
  ├── npm create next-app@15 rainynest --template app --ts --tailwind --eslint
  ├── 安装 Prisma + SQLite + NextAuth + react-markdown + shadcn/ui
  ├── 写 db/schema.prisma 完整模型
  ├── npx prisma migrate dev --name init
  ├── prisma/seed.ts（创建 admin + 默认主题 + 示例文章）
  ├── lib/prisma.ts + lib/site.ts + lib/auth.ts
  └── app/layout.tsx 骨架（generateMetadata 从 SiteSetting 读）

Phase 2 - 前台公开页面（SEO 优先）
  ├── app/web/layout.tsx + Header + Footer + Sidebar
  ├── app/web/page.tsx（首页）
  ├── app/web/blog/*（列表 + 详情 + 标签筛选，全部 SSG + ISR）
  ├── app/web/moments/*（说说）
  ├── app/web/gallery/*（相册）
  ├── app/web/links/page.tsx
  ├── app/web/archive/page.tsx
  ├── components/markdown/MarkdownRenderer.tsx（前台渲染核心）
  ├── app/sitemap.ts + app/robots.ts + /api/feed
  └── 测试 SEO：百度站长平台提交，Google Lighthouse 检测

Phase 3 - 认证
  ├── NextAuth 5（Auth.js）Credentials Provider
  ├── middleware.ts（保护 /console/*，Next.js 15 Edge Runtime 约束）⭐ 详见下方
  ├── app/signin/page.tsx
  └── lib/auth.ts 完整配置

Phase 4 - 后台（/console）
  ├── 仪表盘（统计卡片 + 实时数据）
  ├── 文章 CRUD（Tiptap 编辑器）
  ├── 分类/标签/评论/页面/说说/相册 管理
  └── 系统配置（SiteSetting 完整表单）

Phase 5 - ⭐ 主题系统
  ├── lib/theme.ts（扫描/加载/切换）
  ├── vendor/themes/default/（默认主题 CSS 变量）
  ├── app/layout.tsx 动态注入主题 CSS
  └── /console/system/themes 页面（安装/切换/预览）

Phase 6 - ⭐ 插件系统
  ├── lib/plugin/{registry,loader,hooks,types}.ts
  ├── vendor/plugins/default-seo + code-highlight（预装）
  ├── 钩子系统集成到文章保存/渲染流程
  └── /console/system/plugins 页面（安装/启用/配置）

Phase 7 - 部署 + 上线
  ├── Dockerfile + docker-compose.yml
  ├── 域名 + HTTPS
  ├── 百度/Google Search Console 提交
  └── 性能优化
```

***

## 十二-A、⚠️ Next.js 15 middleware.ts 编写指南（有暗坑）

### Edge Runtime 约束

Next.js 15 的 `middleware.ts` 运行在 **Edge Runtime**（不是 Node.js），有硬性限制：

```
✅ 可以：NextRequest / NextResponse / auth() / cookies() / headers()
❌ 不能：import { PrismaClient } from '@prisma/client'      （Node-only）
❌ 不能：import { getServerSession } from 'next-auth'          （NextAuth 4 的，Node-only）
❌ 不能：import bcrypt / nodemailer / fs / path               （Node-only）
❌ 不能：动态 import 任意本地 .ts 文件                          （打包器看不到）
```

**结论**：middleware 里**绝对不能直接查 Prisma 数据库**，只能用 NextAuth 的 `auth()` 函数读 session（存在 cookie 里），session 里缓存了用户 ID + 权限列表。

### middleware.ts 完整代码（项目根目录）

```ts
// middleware.ts —— 放在项目根目录（不是 app/ 下）
// ⚠️ 必须用 Edge Runtime 兼容的 API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';  // NextAuth 5 导出的 auth() 函数（Edge-compatible）

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ═══════════════════════════════════════
  // ① 保护后台 /console/* 路由
  // ═══════════════════════════════════════
  if (pathname.startsWith('/console')) {
    const session = await auth();  // NextAuth 5，Edge-compatible，直接读 session cookie

    if (!session) {
      // 未登录 → 跳转到登录页，带上 redirect URL
      const signInUrl = new URL('/signin', request.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // ⭐ 权限检查：从 session 里读缓存好的角色 + 权限
    // session 结构由 lib/auth.ts 的 session callback 决定
    const roleNames = (session.user?.roles as string[]) || [];
    const permissions = (session.user?.permissions as string[]) || [];

    // 超级管理员直接放行
    if (roleNames.includes('administrator')) {
      return NextResponse.next();
    }

    // forbidConsole 角色（如 viewer）禁止访问后台
    // 注意：forbidConsole 信息需要在登录时就查好并存进 session
    if ((session.user?.forbidConsole as boolean) === true) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // 其他角色：需要 console:login 权限（在 session 里缓存好）
    if (!permissions.includes('console:login')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ═══════════════════════════════════════
  // ② 个人中心 /uc/* 保护（可选，未实现）
  // ═══════════════════════════════════════

  return NextResponse.next();
}

export const config = {
  // 只对这些路径运行 middleware
  matcher: [
    '/console/:path*',
    // '/uc/:path*',
    // '/api/console/:path*',   // API 层也可以用 middleware 预检查
  ],
};
```

### auth.ts 的 session callback 必须缓存权限

```ts
// lib/auth.ts —— NextAuth 5 风格（Auth.js v5）
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      authorize: async (credentials) => {
        const user = await db.user.findUnique({
          where: { username: credentials.username },
          include: {
            roles: { include: { role: { include: { permissions: true } } } },
          },
        });
        if (!user || user.status !== 'ENABLED') return null;

        const valid = await bcrypt.compare(credentials.password!, user.passwordHash || '');
        if (!valid) return null;

        // ⭐ 登录成功时，一次性把用户的所有角色 + 权限查出来，缓存进 session
        const isAdmin = user.roles.some(ur => ur.role.name === 'administrator');
        const forbidConsole = user.roles.some(ur => ur.role.forbidConsole);

        // 聚合权限列表（超级管理员放行所有）
        let permissionList: string[] = [];
        if (!isAdmin) {
          permissionList = user.roles.flatMap(ur =>
            ur.role.permissions.map(rp => rp.permission.name)
          );
        }

        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          roles: user.roles.map(ur => ur.role.name),
          permissions: isAdmin ? ['*'] : permissionList,  // admin 存 '*'
          forbidConsole,
        };
      },
    }),
  ],

  callbacks: {
    session: ({ session, token }) => {
      // session callback 把 token 里的字段透传到 session.user
      if (token.sub) {
        session.user = {
          id: token.sub,
          roles: token.roles as string[],
          permissions: token.permissions as string[],
          forbidConsole: token.forbidConsole as boolean,
          // ...其他字段
        };
      }
      return session;
    },
    jwt: ({ token, user }) => {
      // 登录时 user 有值，把角色/权限写进 JWT token
      if (user) {
        token.roles = (user as any).roles;
        token.permissions = (user as any).permissions;
        token.forbidConsole = (user as any).forbidConsole;
      }
      return token;
    },
  },
});

// 辅助函数：在 Server Component / API Route 里检查权限（读 session 缓存，不查 DB）
export async function requireSessionPermission(required: string | string[]) {
  const session = await auth();
  if (!session) return false;

  const perms = session.user?.permissions as string[] || [];
  if (perms.includes('*')) return true;  // admin

  const req = Array.isArray(required) ? required : [required];
  return req.some(p => perms.includes(p));
}
```

### 为什么不用每次查 DB？

```
没有 session 缓存的方案（❌ 慢）：
  每次 /console/* 请求 → middleware 查 DB（嵌套 JOIN User→UserRole→Role→RolePermission→Permission）
  一个后台页面 3 个 API 调用 = 4 次一模一样的嵌套查询

有 session 缓存的方案（✅ 快）：
  登录时查一次 DB → 权限列表存进 JWT token
  每次请求 → middleware 读 session cookie（O(1)，Edge Runtime 原生支持）
  需要更细粒度时（比如文章只能改自己的）→ API 层再查 DB
```

### session 大小限制

NextAuth 默认 JWT token 存 cookie，**cookie 有 4KB 限制**。RainyNest 内置 ~50 权限 + 最多 4 角色，`roles: string[] + permissions: string[]` 完全够用。如果插件多了权限总数可能超 150，这时要把权限列表从"全量存 cookie"改成"只存角色名，API 层按角色查权限缓存"。

***

## 十二-B、部署与运维补充（P2 修复）

### better-sqlite3 原生编译风险

插件独立库用了 `better-sqlite3`（原生 C++ addon），在不同平台可能出二进制兼容性问题：

```
❌ 风险场景：
  Mac M1（arm64）开发 → 部署到 AMD64 Docker 镜像 → native module 不匹配
  Node.js 20 → Node.js 22 升级 → ABI 版本变了 → 重新编译

✅ 解决方案：
  1. package.json 里加 "better-sqlite3": "optionalDependencies"（可选，构建失败不影响主库）
  2. Dockerfile 里加 npm rebuild better-sqlite3（或 --build-from-source）
  3. 降级方案：如果原生编译持续报错，插件独立库改用 sql.js（纯 JS，体积稍大但零编译）
```

### 图片上传存储策略

```
存储方案（默认 + 可切换）：
  默认：public/uploads/{YYYY}/{MM}/{filename}.{ext}
  文件命名：uuid + 原扩展名（防冲突 + 防路径遍历）
  自动处理：EXIF 旋转修正 + 可选的自动压缩 sharp
  CDN：后台系统设置里填 CDN 域名，所有图片 URL 自动替换前缀
  插件扩展：attachmentStorage 扩展点替换默认存储（七牛/阿里云 OSS/S3）

/backend/api/upload/route.ts 返回：
  { url: "https://cdn.yoursite.com/uploads/2026/11/uuid.jpg", filename, size, width, height }
```

### 侧边栏 / 页脚内容来源

```
侧边栏：
  ├── 核心硬编码组件（可被主题 components/ 覆盖）
  │   ├── 文章分类导航（从 Category 表读）
  │   ├── 标签云（从 Tag 表读，热门优先）
  │   ├── 最新评论（从 Comment 表读，最近 5 条）
  │   └── 归档时间轴（从 Post 表 GROUP BY date_trunc）
  └── 插件注入的 Widget（injectSidebarWidget 扩展点）

页脚：
  ├── 版权信息（SiteSetting.footerText）
  ├── 友链链接（从 Link 表读，status=PUBLISHED）
  └── 社交图标（SiteSetting.githubUrl/twitterUrl/email）

顶部导航：
  └── 从 Menu 表读（多级，按 order 排序）
```

### 数据库备份与恢复

```ts
// lib/backup.ts —— 备份恢复实现

import fs from 'node:fs';
import path from 'node:path';

const DB_DIR = path.join(process.cwd(), 'db');

// SQLite 热备：PRAGMA wal_checkpoint → 文件复制
// 不能直接复制 .db 文件（可能有 WAL 日志未刷盘）
export async function createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(DB_DIR, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const paths: string[] = [];

  // 主库
  paths.push(await copySqliteFile('blog.db', `blog-${timestamp}.db`));
  // 访问库
  paths.push(await copySqliteFile('analytics.db', `analytics-${timestamp}.db`));
  // 插件库（如果有）
  const pluginDbDir = path.join(DB_DIR, 'plugins');
  if (fs.existsSync(pluginDbDir)) {
    for (const file of fs.readdirSync(pluginDbDir)) {
      if (file.endsWith('.db')) {
        paths.push(await copySqliteFile(`plugins/${file}`, `plugins/${file.replace('.db', `-${timestamp}.db`)}`));
      }
    }
  }

  return paths.join(', ');
}

async function copySqliteFile(src: string, dest: string): Promise<string> {
  const srcPath = path.join(DB_DIR, src);
  const destPath = path.join(DB_DIR, 'backups', dest);

  if (!fs.existsSync(srcPath)) return '';

  // 1. 先刷 WAL 到主文件（保证数据完整）
  // ⚠️ 需要用 better-sqlite3 打开一下执行 PRAGMA wal_checkpoint
  // （Prisma 的 $queryRaw 也行，但不如 better-sqlite3 直接）
  // 简化版：直接复制（生产环境建议加 checkpoint）
  fs.copyFileSync(srcPath, destPath);

  return destPath;
}

// 恢复：需要停 Next.js（SQLite 文件锁冲突）
// 流程：npm stop → 覆盖 .db 文件 → npm start
// 恢复前自动创建当前时间的备份（防误操作）
export async function restoreBackup(backupFileName: string): Promise<void> {
  // ... 覆盖逻辑
}
```

### error.tsx 错误边界（Next.js 15）

```tsx
// app/error.tsx —— 前台/后台共用的错误边界（捕获 Server Component 运行时错误）
'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-red-500">出错了</h1>
        <p className="text-gray-600">{error.message || '服务器开小差了'}</p>
        <button onClick={reset}>重试</button>
      </div>
    </div>
  );
}
```

```tsx
// app/global-error.tsx —— 根布局级别的错误边界（处理 layout.tsx / generateMetadata 崩溃）
// ⚠️ 这个组件不能 import 任何全局样式（globals.css 在 layout.tsx 里，这里会循环）
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <h1>系统严重错误</h1>
        <p>Error ID: {error.digest}</p>
        <button onClick={reset}>刷新页面</button>
      </body>
    </html>
  );
}
```

### 目录结构补全

原目录结构遗漏了以下文件，应该补上：

```
next.config.ts              # Next.js 配置（revalidate 默认值、images remotePatterns）
middleware.ts               # ← 新增：保护 /console/* 路由（Edge Runtime）
error.tsx                   # ← 新增：Server Component 错误边界
global-error.tsx            # ← 新增：根布局错误边界
scripts/
  build-vendor.js           # ← 新增：esbuild 预编译 vendor 目录
  sync-themes.js            # 已有：同步 vendor/themes → public/themes
lib/
  analytics/
    aggregator.ts           # ← 新增：定时聚合逻辑
    scheduler.ts            # ← 新增：cron 调度（自托管）
    queue.ts                # ← 新增：进程内队列 + 批量写入（不阻塞核心）
  analytics.ts              # 已有：访问库 Client
  auth.ts                   # ← 修复：NextAuth 5 风格 + session 缓存权限
  mailer.ts                 # ← 新增：邮件发送统一入口
  search/
    default-provider.ts     # ← 新增：FTS5 默认搜索
    types.ts                # ← 新增：SearchProvider 接口
  backup.ts                 # ← 新增：数据库备份恢复
  plugin-db.ts              # 已有：插件独立库封装
components/
  analytics/
    AnalyticsBeacon.tsx     # ← 新增：客户端 sendBeacon PV 上报
app/
  api/
    analytics/
      pv/route.ts           # ← 新增：PV 入队 API（< 5ms 响应）
scripts/
  init-analytics-db.ts      # ← 新增：analytics.db WAL 模式 + PRAGMA 优化
prisma/
  schema.prisma             # 已有：主库
  analytics.prisma          # ← 修复：generator output 路径 + 用 env("ANALYTICS_DATABASE_URL")
```

***

### Node.js 20 和 15 是什么关系？

```
你说的 Node.js 15 实际存在，但已停止维护很久（2020 年底）
Next.js 15 需要 Node.js 20+ 才能运行（18 也可以但有警告）
┌──────────────────────────────────┐
│ Node.js 20 LTS ← 你应该用这个    │
│ Node.js 22 LTS ← 也可以          │
│ Node.js 15     ← 太老，别用       │
└──────────────────────────────────┘
```

### 插件能做什么、不能做什么？

✅ **能**：

- 注入 API 路由、拦截/修改请求
- 钩子形式扩展保存/渲染/SEO 等核心流程
- 提供自定义后台组件（动态加载）
- 添加新的元数据字段、代码高亮主题

❌ **不能**：

- 修改 RainyNest 核心文件（插件在 vendor/plugins/ 隔离目录）
- 直接访问文件系统的任意位置
- 绕过数据库直接操作文件（通过 Prisma Client 间接操作）
- 执行任意 shell 命令

### 主题切换后 ISR 缓存会不会不刷？

不会。切换主题时我们会调用 Next.js 的 `revalidatePath('/')` 清空首页缓存，加上 ISR 1 小时自动刷新，最多 1 小时全站就切到新主题了。如果想立即看到效果，手动在后台点「清空缓存」按钮。

### 为什么要用 CSS 变量而不是 Tailwind 的类名覆盖？

CSS 变量方案：

```css
/* 主题 CSS 文件覆盖 CSS 变量 */
:root { --color-primary: #ff6b6b; }
```

Tailwind 类名覆盖方案更复杂（要在运行时注入新的 Tailwind class 定义），所以主题系统统一走 CSS 变量。同时主题也可以提供自定义组件覆盖（`components/CustomHeader.tsx`），实现更深度的定制。

***

## 十四、依赖清单

```json
{
  "dependencies": {
    "next": "15.x",
    "react": "19.x",
    "react-dom": "19.x",
    "@prisma/client": "^5.x",
    "next-auth": "^5.x",

    "react-markdown": "^9.x",
    "remark-gfm": "^4.x",
    "remark-math": "^6.x",
    "remark-sectionize": "^2.x",
    "remark-directive": "^4.x",
    "remark-admonition-to-blockquote-callout": "^1.x",
    "remark-wiki-link": "^2.x",
    "remark-reading-time": "^2.x",
    "rehype-katex": "^7.x",
    "rehype-slug": "^6.x",
    "rehype-autolink-headings": "^7.x",
    "rehype-callouts": "^2.x",
    "rehype-code-group": "^1.x",
    "rehype-figure": "^1.x",
    "rehype-external-links": "^3.x",
    "rehype-email-protection": "^1.x",
    "rehype-raw": "^7.x",
    "katex": "^0.16.x",

    "@expressive-code/core": "^0.44.x",
    "@expressive-code/plugin-line-numbers": "^0.44.x",
    "@expressive-code/plugin-collapsible-sections": "^0.44.x",
    "expressive-code-collapsible": "^0.1.x",
    "expressive-code-language-badge": "^0.1.x",
    "ec-lang-logo": "^1.x",

    "@tiptap/react": "^2.x",
    "@tiptap/starter-kit": "^2.x",
    "@tiptap/extension-image": "^2.x",
    "@tiptap/extension-link": "^2.x",
    "@tiptap/extension-code-block-lowlight": "^2.x",
    "lowlight": "^3.x",

    "zod": "^3.x",
    "lucide-react": "^0.400.x",
    "bcryptjs": "^2.x",
    "date-fns": "^3.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x"
  },
  "devDependencies": {
    "prisma": "^5.x",
    "typescript": "^5.x",
    "tailwindcss": "^3.x",
    "@tailwindcss/typography": "^0.5.x",
    "eslint": "^9.x"
  }
}
```

## 十五、实现状态对齐（2026-11-20）

本节记录代码实际落地口径，替代前文中与之冲突的描述（尤其是 `vendor/` 路径与扩展点数量）。

### 15.1 运行时目录（重要修正）

| 内容 | 实际路径 | 说明 |
|------|----------|------|
| 插件安装态 | `scripts/plugins/<slug>/plugin.json` + `index.js` | 由 `lib/ext-installer.ts` 写入；启动/构建前由 `scripts/ensure-extensions.js` 补齐内置项 |
| 主题安装态 | `scripts/themes/<slug>/` | 含 `theme.json`、`theme.css`、可选 `templates/` |
| 主题模板覆盖 | `scripts/themes/<active>/templates/<name>.tsx` | `lib/theme/templates.ts` 运行时编译，失败回退内置模板 |
| 主题覆盖插件模板 | `scripts/themes/<active>/templates/plugins/<pluginSlug>/<name>.tsx` | `lib/plugin/theme-integration.ts` |
| 文档旧写法 | `vendor/plugins`、`vendor/themes` | 仅作源码/设计约定，**不是**运行时扫描目录；`build-vendor` 预编译方案未采用 |

### 15.2 数据模型变更

迁移文件：`prisma/migrations/20261120120000_complete_features/migration.sql`（已通过 `prisma migrate deploy` 应用）。

- 新增 `VerificationCode`（邮箱验证码 / 找回密码，带过期与已用标记）
- 新增 `Attachment`（附件库：url、大小、mime、上传者、存储驱动）
- `Comment`：新增 `ip`、`userAgent`、`extra`（插件 `injectCommentField` 的结构化数据）
- `Page`：新增 `showSidebar`、`sidebarContent`
- `User`：新增 `attachments` 关联
- `SiteSetting` 新增：`enableSectionize`、`codeTabGroup`、`enableFigure`、`enableMermaid`、`enablePlantuml`、`autoBackupCron`、`autoBackupKeep`、`allowThemeGitInstall`、`oauthGithubId/Secret`、`oauthGoogleId/Secret`、`oauthWechatId/Secret`、`enableLdap`、`ldapUrl`、`ldapBindDn`、`ldapBindPassword`、`ldapBaseDn`、`ldapUserFilter`

`lib/site.ts` 的 `DEFAULT_SITE_SETTING` 已同步全部字段。

### 15.3 插件 SPI 实际实现

类型来源：`@rainynest/plugin-types@0.3.1`（已发布到 npm，源码在 `RainyNest_Dev/packages/types`）。`lib/plugin/types.ts` 仅做统一 re-export，宿主不再维护本地类型副本；扩展点变更时发布新版本类型包并升级依赖即可。

新增/已实现扩展点：

- 请求与存储：`apiMiddleware`、`attachmentStorage`、`notifier`、`searchProvider`
- 页面注入：`injectHeaderAction`、`injectSinglePageContent`、`injectCommentField`、`injectFooter`、`providesTemplates`
- 后台列表/操作：`pageListItemOperation`、`commentListItemOperation`、`replyListItemOperation`、`pluginListItemOperation`、`themeListItemOperation`、`attachmentListItemOperation`、`backupListItemOperation`
- 列表字段：`postListItemField`、`pageListItemField`、`pluginListItemField`
- Tab：`pluginDetailTab`、`themeListTab`、`attachmentSelectorTab`、`pluginInstallTab`、`backupTab`、`userDetailTab`
- 编辑器/评论：`editorCreate`、`commentEditorReplace`、`commentListItemContentReplace`、`commentSubjectRef`
- 仪表盘：`dashboardWidget`、`dashboardQuickAction`
- 生命周期：`onInstall`/`onUninstall`/`onEnable`/`onDisable`/`onRenderMarkdown`/`onGenerateMetadata` 等（沿用基础包）

执行引擎：

| 文件 | 职责 |
|------|------|
| `lib/plugin/engine.ts` | 扫描加载、`fireExtensionPoint`、`firstWins`、`getApiMiddlewares/runApiMiddlewares`、`getAttachmentStorageProvider`、`getPluginNotifier`、`getProvidedTemplates`、`collectPluginDefinitions` |
| `lib/plugin/ui.ts` | 列表操作/字段、Header 按钮、单页内容、评论字段、编辑器动作、快捷操作、Tab、评论编辑器/内容替换、`commentSubjectRef` |
| `lib/plugin/api-gate.ts` | `pluginApiGate(req)`：把 API 请求交给 `apiMiddleware` 链，异常放行 |
| `lib/mailer.ts` | `sendMail` 优先走插件 `notifier`，无 provider 或失败回退 SMTP，支持 `scene` |
| `lib/plugin-db.ts` | 每个插件独立 `.db` 与 JSON 配置（`lib/plugin/json-store.ts`） |

### 15.4 已接入的宿主位置

**用户体系**

- 注册/邮箱验证码/找回密码：`app/api/auth/register`、`email-code`、`forgot-password`、`reset-password`
- 登录页：`app/signin/page.tsx`；会话与权限沿用 NextAuth + `lib/api-auth.ts`
- OAuth2（GitHub/Google/微信）与 LDAP：配置存 `SiteSetting`，认证提供者在 NextAuth 配置中按开关装配
- 后台角色管理：`app/console/system/roles/page.tsx`、`app/api/console/roles`

**主题**

- Git 安装：`app/api/console/themes/git-install`（受 `allowThemeGitInstall` 控制）
- 在线预览：`app/(site)/preview/page.tsx?theme=<slug>`，复用首页组件、注入主题 CSS 变量，**不改用 cookie 动态化全站**，保留 ISR
- 主题设置页：`app/console/system/themes`（含 `themeListTab` 与行操作）

**运维**

- 备份/恢复：`app/api/console/backup`、`backup/restore`；定时策略读 `autoBackupCron/autoBackupKeep`
- 缓存工具（重置浏览量 / 重建 FTS5 / 刷新 ISR）：`app/api/console/cache` + `app/console/tools/cache/page.tsx`
- 实时在线人数 SSE：`app/api/analytics/online`（5 秒推送、30 分钟重连，需登录）
- GeoIP：`lib/analytics/geo.ts`（优先 CDN 请求头，可选动态加载 `geoip-lite`，内网跳过）
- 定时发布/聚合：`app/api/cron/publish`、`app/api/cron/analytics`

**Markdown 管线**（`lib/markdown/`）

- `processor.ts`：`enableCallouts`、`enableWikiLink`、`enableEmailProtection`、`enableSectionize`、`codeTabGroup`、`enableFigure`、`enableMermaid`、`enablePlantuml` 组合缓存
- 支持 `:::note/tip/warning/danger/info/important/caution`、`:::code-group`、相邻代码块自动分组、独占段落图片转 `figure/figcaption`、Mermaid 客户端 CDN 渲染、PlantUML 公共 SVG 服务
- `reading-time.ts`（阅读时间）、`comment.ts`（评论 Markdown + 严格白名单清洗）
- 样式：`app/globals.css` 已补 `.admonition`、`.code-group`、`.markdown-figure`、`pre.mermaid`、`img.plantuml`

**后台 UI 接入**

`posts`（插件字段列）、`pages`（字段/操作）、`system/plugins`（字段/行操作/详情 Tab/安装 Tab）、`system/themes`（Tab/行操作/预览）、`tools/backup`（Tab/操作）、`attachments`（Tab/操作）、`comments`（操作/来源 `_subject`）、`system/users`（详情 Tab/登录设备）、`console` 首页（`dashboardQuickAction`）、`ConsoleShell` 导航（附件/角色）、`MilkdownEditor`（`editorCreate` 按钮）

**前台**

- `app/(site)/layout.tsx`：`injectFooter`、`injectHeaderAction`、`<MermaidRenderer />`
- 文章详情：`injectSinglePageContent`（`collectPostContentHtml`）、第三方评论组件替换（`getCommentWidgetHtml`）、`injectCommentField`（`CommentForm` 动态字段）
- `components/markdown/MermaidRenderer.tsx`：按需加载 Mermaid ESM

### 15.5 内置插件（8 个）

`announcement-bar`（新增，演示 `injectHeaderAction`/`dashboardQuickAction`/`injectFooter`/`apiMiddleware`/`notifier`）、`code-highlight`、`comment-filter`、`default-seo`、`reading-time`、`related-posts`、`rss-feed`、`sitemap-enhance`。

### 15.6 部署文件

- `Dockerfile` + `.dockerignore`：多阶段构建，持久化 `db/`、`public/uploads/`、`scripts/plugins/`、`scripts/themes/`
- `vercel.json`：crons → `/api/cron/publish`（每分钟）、`/api/cron/analytics`（每天 03:00）
- `ecosystem.config.js`：PM2 fork 单实例（SQLite 写锁 + 插件 `.db`）
- `deploy/nginx.conf`：反代、静态资源缓存、SSE 关闭缓冲（`proxy_buffering off`）与超时

### 15.7 RainyNest_Dev 工作区同步

- `packages/types`：0.3.0，新增全部 SPI 类型（可构建）
- `packages/plugins/announcement-bar`：第 8 个示例插件（已复制到主项目 `scripts/plugins/announcement-bar`）
- `tools/ext-cli`：`validate.js` 支持 `specVersion 0.3.0`；CLI 模板补充新 SPI 注释
- `PLUGIN_THEME_PLAN.md`：新增第 9 章，说明扩展点与开发流程

### 15.8 已知边界（明确未做/降级）

| 项 | 现状 |
|----|------|
| `commentEditorReplace` / `commentListItemContentReplace` | 已实现收集器（`getCommentEditorHtml` / `getCommentContentRendererHtml`），但前台评论表单与列表仍使用内置 UI；这两个扩展点需要插件组件的 props 契约，未做逐条评论注入 |
| `apiMiddleware` | 已覆盖 8 个公开接口：`posts`、`pages`、`comments`、`categories`、`tags`、`links`、`gallery`、`moments`；后台与其余路由未接入 |
| `CodeBlock` 组件 | 未使用；代码高亮统一走 Expressive Code（rehype 插件） |
| PlantUML | 使用公共 `plantuml.com` SVG 服务，非本地渲染 |
| 主题 `vendor` 预编译 | 未采用 `build-vendor`；运行时直接编译 `scripts/themes` 模板 |
| npm 类型包 | `@rainynest/plugin-types` 已发布 0.3.1，主项目从 npm 安装并直接 re-export；类型包由同一维护者发布，不再使用本地补丁 |

***

> **文档版本**: v2.2
> **更新日期**: 2026-11-20
> **适用**: Next.js 15 + React 19 + Prisma 5 + SQLite
> **参考**: NovaCMS 插件/主题架构 + Halo 主题切换思路 + Firefly Markdown 架构

## 修订记录

| 版本 | 日期 | 改动 |
|------|------|------|
| **v2.2** | 2026-11-20 | **功能补齐与文档对齐**：新增第十五节，记录运行时目录（`scripts/plugins`、`scripts/themes`）、数据模型迁移、实际 SPI 扩展点与宿主接入、8 个内置插件、部署文件（Dockerfile/vercel/PM2/Nginx）、Markdown 新管线与已知边界；修正前文 `vendor/` 路径描述 |
| **v2.1** | 2026-11-13 | **架构审计修复**：3 个 P0 严重缺陷（动态 import vendor 目录→esbuild 预编译；Prisma 双 Client output/import 不一致；环境变量 3 vs 4 矛盾）、6 个 P1 中等缺陷（middleware.ts 缺失 + Next.js 15 Edge Runtime 约束；NextAuth 5 API；权限 session 缓存；定时聚合任务自托管 vs serverless 双方案 + 分布式锁；lib/mailer.ts 邮件通知模块；SQLite FTS5 默认搜索）、6 个 P2 小缺陷 + **访问统计不阻塞写入**（客户端 sendBeacon + `/api/analytics/pv` 立即响应 + 进程内队列 100ms flush + 批量 createMany + SQLite WAL 模式优化 + SIGTERM 安全退出 flush） |
| **v2.0** | 2026-11-13 | Halo 风格完整设计：双库架构、RBAC 用户系统、Halo 扩展点插件系统、动态配置主题系统、Firefly Markdown 完整移植 |
| **v1.0** | 2026-11-13 | 初始版本：基础架构、技术栈、目录结构 |

