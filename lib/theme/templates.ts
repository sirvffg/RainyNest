// lib/theme/templates.ts — 主题覆盖系统页面模板（Halo 风格「模板优先」）
//
// 约定：主题可在 scripts/themes/<slug>/templates/<name>.tsx 放置系统页面模板，
// 存在即覆盖系统内置渲染。模板名与 Halo 的路由模板一一对应：
//
//   layout       整体壳（Header/Sidebar/Footer 的摆放）
//   home         首页
//   post-list    博客列表
//   post         文章详情（兼容旧名 post-detail）
//   page         独立页面
//   archive      归档
//   categories   分类列表
//   category     分类详情
//   tags         标签列表
//   tag          标签详情
//   search       搜索
//   moments      说说列表
//   moment       说说详情
//   links        友链
//   gallery      相册列表
//   photo        相册详情
//   error        404
//
// 模板编译为混合模式：
// - 构建期注册表（predev/prebuild 生成）：已安装主题/插件模板按普通 Next 模块编译，
//   支持 `@/` 别名与 `'use client'` 客户端组件
// - 运行时兜底：新装、尚未重启的模板走 esbuild 编译，仅支持服务端 JSX
// 交互区块（评论表单、灯箱等）仍由宿主以 ReactNode 插槽 props.slots 传入，
// 主题可直接复用，也可用客户端组件自行实现。
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { ComponentType, ReactNode } from 'react';
import { getActiveTheme } from '../theme';
import { pluginTemplateRegistry, themeRouteRegistry, themeTemplateRegistry } from './generated-templates';

// ── 通用数据结构（主题作者可见） ────────────────────────────────

export interface TemplateSite {
  title: string;
  subtitle: string | null;
  description: string | null;
  logo: string | null;
  url: string | null;
  footerText: string | null;
  icp: string | null;
}

export interface TemplatePost {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImage: string | null;
  views: number;
  createdAt: Date;
  publishedAt: Date | null;
  isTop?: boolean;
  category?: { name: string; slug: string } | null;
}

export interface TemplateMenuItem {
  name: string;
  url: string;
}

// ── 各页面模板 Props 契约 ───────────────────────────────────────

/** 整体壳：theme 模板负责 Header/Sidebar/Footer 的摆放，children 是页面内容 */
export interface LayoutTemplateProps {
  site: TemplateSite;
  menus: TemplateMenuItem[];
  header: ReactNode;
  sidebar: ReactNode;
  footer: ReactNode;
  /** 插件 injectFooter 注入的节点 */
  footerNodes: ReactNode;
  children: ReactNode;
}

/** 首页 */
export interface HomeTemplateProps {
  site: TemplateSite;
  posts: TemplatePost[];
  total: number;
  slots: {
    /** 内置文章卡片网格（保留入场动画），主题可直接摆放或自行渲染 posts */
    posts: ReactNode;
  };
}

/** 博客列表 */
export interface PostListTemplateProps {
  posts: TemplatePost[];
  total: number;
  page: number;
  totalPages: number;
  slots: {
    list: ReactNode;
    pagination: ReactNode;
  };
}

/** 文章详情（旧名 PostDetailTemplateProps 保留） */
export interface PostDetailTemplateProps {
  post: {
    slug: string;
    title: string;
    /** 作者展示名 */
    author: string;
    /** 发布时间（无则用创建时间） */
    date: Date;
    /** 浏览量 */
    views: number;
    /** 分类（可能为 null） */
    category: { name: string; slug: string } | null;
    /** 标签列表 */
    tags: { name: string; slug: string }[];
    /** 封面图 URL（可能为 null） */
    coverImage: string | null;
    /** 是否允许评论 */
    allowComment: boolean;
  };
  /** Markdown 渲染后的完整 HTML（含插件管线处理） */
  html: string;
  /** 已通过评论总数 */
  commentsCount: number;
  /** 宿主预渲染的交互区块插槽，主题按需摆放 */
  slots: {
    /** 移动端目录（lg 以下显示） */
    tocMobile: ReactNode;
    /** 桌面端固定目录（lg 以上侧栏显示） */
    tocDesktop: ReactNode;
    /** 完整评论区（含表单 / 列表 / 第三方评论，已处理 allowComment 与插件替换） */
    comments: ReactNode;
    /** 插件文末追加块（相关文章 / 版权等，空则不渲染） */
    contentBlocks: ReactNode;
  };
}

/** 独立页面 */
export interface PageTemplateProps {
  page: {
    title: string;
    summary: string | null;
    /** Markdown 渲染后的 HTML */
    html: string;
    /** 页面自定义侧边栏 HTML（可能为 null） */
    sidebarHtml: string | null;
    showSidebar: boolean;
  };
  slots: {
    /** 插件 injectSinglePageContent 文末追加块 */
    contentBlocks: ReactNode;
  };
}

/** 归档 */
export interface ArchiveTemplateProps {
  total: number;
  years: {
    year: number;
    posts: { id: string; title: string; slug: string; date: Date }[];
  }[];
}

/** 分类列表 */
export interface CategoriesTemplateProps {
  categories: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    count: number;
  }[];
}

/** 分类详情 */
export interface CategoryTemplateProps {
  category: { name: string; slug: string; description: string | null };
  posts: TemplatePost[];
  slots: {
    list: ReactNode;
  };
}

/** 标签列表 */
export interface TagsTemplateProps {
  tags: { id: string; name: string; slug: string; count: number }[];
}

/** 标签详情 */
export interface TagTemplateProps {
  tag: { name: string; slug: string } | null;
  posts: TemplatePost[];
  slots: {
    list: ReactNode;
  };
}

/** 搜索 */
export interface SearchTemplateProps {
  query: string;
  results: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    snippet: string;
  }[];
  slots: {
    /** 搜索表单（GET /search） */
    form: ReactNode;
  };
}

/** 说说列表 */
export interface MomentsTemplateProps {
  moments: TemplateMoment[];
  slots: {
    list: ReactNode;
  };
}

/** 说说详情 */
export interface MomentTemplateProps {
  moment: TemplateMoment;
  prev: { id: string; content: string } | null;
  next: { id: string; content: string } | null;
  slots: {
    /** 图片灯箱 */
    lightbox: ReactNode;
  };
}

export interface TemplateMoment {
  id: string;
  content: string;
  images: string[];
  createdAt: Date;
  user: { displayName: string; avatar: string | null };
}

/** 友链 */
export interface LinksTemplateProps {
  links: {
    id: string;
    name: string;
    url: string;
    logo: string | null;
    description: string | null;
  }[];
  slots: {
    list: ReactNode;
  };
}

/** 相册列表 */
export interface GalleryTemplateProps {
  galleries: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    coverImage: string | null;
    count: number;
  }[];
  slots: {
    list: ReactNode;
  };
}

/** 相册详情 */
export interface PhotoTemplateProps {
  gallery: { title: string; description: string | null };
  photos: { url: string; title: string | null; width: number | null; height: number | null }[];
  slots: {
    /** 瀑布流 + 灯箱（客户端组件） */
    grid: ReactNode;
  };
}

/** 404 */
export interface ErrorTemplateProps {
  status: number;
  title: string;
  message: string;
}

// ── 组件类型别名 ────────────────────────────────────────────────

export type PostDetailTemplate = ComponentType<PostDetailTemplateProps>;
export type PostTemplate = ComponentType<PostDetailTemplateProps>;
export type LayoutTemplate = ComponentType<LayoutTemplateProps>;

export interface TemplateComponentMap {
  layout: LayoutTemplateProps;
  home: HomeTemplateProps;
  'post-list': PostListTemplateProps;
  post: PostDetailTemplateProps;
  'post-detail': PostDetailTemplateProps;
  page: PageTemplateProps;
  archive: ArchiveTemplateProps;
  categories: CategoriesTemplateProps;
  category: CategoryTemplateProps;
  tags: TagsTemplateProps;
  tag: TagTemplateProps;
  search: SearchTemplateProps;
  moments: MomentsTemplateProps;
  moment: MomentTemplateProps;
  links: LinksTemplateProps;
  gallery: GalleryTemplateProps;
  photo: PhotoTemplateProps;
  error: ErrorTemplateProps;
}

/** 当前支持的系统模板名 */
export type SystemTemplateName = keyof TemplateComponentMap;

// ── 运行时编译加载 ──────────────────────────────────────────────

// Turbopack 禁止 RSC 静态 import react-dom/server 等内置模块 → 与 ui.ts 同款 require
const require = process.getBuiltinModule('node:module').createRequire(
  process.cwd() + '/package.json'
) as NodeRequire;

const CACHE_DIR = path.join(process.cwd(), 'db', 'cache', 'theme-templates');

// 按绝对路径缓存编译产物，mtime 变化自动重编译（dev 热更友好）
const compileCache = new Map<string, { mtimeMs: number; file: string }>();

/** esbuild 编译 TSX → CJS 临时文件 → require 加载（含 mtime 缓存） */
async function compileAndLoad(absPath: string, name: string): Promise<Record<string, unknown>> {
  const mtimeMs = fs.statSync(absPath).mtimeMs;
  const hit = compileCache.get(absPath);
  if (hit && hit.mtimeMs === mtimeMs) {
    delete require.cache[hit.file];
    return require(hit.file) as Record<string, unknown>;
  }

  const esbuild = require('esbuild') as typeof import('esbuild');
  const source = fs.readFileSync(absPath, 'utf8');
  const result = await esbuild.transform(source, {
    loader: 'tsx',
    jsx: 'automatic',
    format: 'cjs',
    target: 'node18',
  });

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const file = path.join(CACHE_DIR, `${safeName}.${mtimeMs}.cjs`);
  fs.writeFileSync(file, result.code);

  // 清理同路径旧产物，避免缓存目录无限膨胀
  if (hit) fs.unlink(hit.file, () => {});

  compileCache.set(absPath, { mtimeMs, file });
  const mod = require(file) as Record<string, unknown>;
  delete require.cache[file];
  return mod;
}

/**
 * 运行时编译任意 TSX 模板文件（esbuild → CJS require，带 mtime 缓存）。
 * 插件模板覆盖等场景复用；文件不存在返回 null。
 */
export async function loadTsxModule(
  absPath: string,
  cacheName: string
): Promise<Record<string, unknown> | null> {
  if (!fs.existsSync(absPath)) return null;
  return compileAndLoad(absPath, cacheName);
}

/**
 * 解析主题 templates 目录下的模板（相对路径，如 plugins/foo/bar.tsx）。
 * 优先查构建期注册表（支持 @/ 与 'use client'），否则走运行时编译；路径越界返回 null。
 */
export async function resolveThemeTemplate(
  relPath: string,
  cacheName: string
): Promise<Record<string, unknown> | null> {
  const theme = await getActiveTheme();
  if (!theme) return null;

  const key = relPath.split(path.sep).join('/').replace(/^\.\//, '').replace(/\.tsx$/, '');
  const registered = themeTemplateRegistry[theme.slug]?.[key];
  if (registered && typeof registered === 'object') {
    return registered as Record<string, unknown>;
  }

  const root = path.resolve(process.cwd(), 'scripts', 'themes', theme.slug, 'templates');
  const absPath = path.resolve(root, relPath);
  if (!absPath.startsWith(root + path.sep)) return null;

  return loadTsxModule(absPath, `theme-${theme.slug}-${cacheName}`);
}

/**
 * 解析插件自带模板：优先构建期注册表，回退运行时编译。
 * 主题覆盖请在调用前先用 resolveThemeTemplate('plugins/<slug>/<name>.tsx') 尝试。
 */
export async function resolvePluginSourceTemplate(
  pluginSlug: string,
  templateName: string
): Promise<Record<string, unknown> | null> {
  const registered = pluginTemplateRegistry[pluginSlug]?.[templateName];
  if (registered && typeof registered === 'object') {
    return registered as Record<string, unknown>;
  }

  const absPath = path.join(
    process.cwd(),
    'scripts',
    'plugins',
    pluginSlug,
    'templates',
    `${templateName}.tsx`
  );
  return loadTsxModule(absPath, `plugin-src-${pluginSlug}-${templateName}`);
}

const TEMPLATE_NAME_RE = /^[a-z][a-z0-9-]*$/;
const THEME_SLUG_RE = /^[a-zA-Z0-9._-]+$/;

/** 模板候选文件名（post 与旧名 post-detail 互相兼容） */
function candidateFiles(name: SystemTemplateName): string[] {
  if (name === 'post') return ['post.tsx', 'post-detail.tsx'];
  if (name === 'post-detail') return ['post-detail.tsx', 'post.tsx'];
  return [`${name}.tsx`];
}

/**
 * 构建期注册表查找：predev/prebuild 由 generate-theme-registry.js 静态 import
 * 所有已安装主题模板，因此这里的组件支持 `@/` 别名与 `'use client'`。
 */
function registryTemplate(
  themeSlug: string,
  name: SystemTemplateName
): { default: ComponentType<unknown> } | null {
  const entry = themeTemplateRegistry[themeSlug];
  if (!entry) return null;

  for (const file of candidateFiles(name)) {
    const key = file.replace(/\.tsx$/, '');
    const mod = entry[key] as Record<string, unknown> | undefined;
    const comp = mod?.default;
    // 客户端组件在服务端模块里是 client reference 对象，不是函数
    if (comp && (typeof comp === 'function' || typeof comp === 'object')) {
      return { default: comp as ComponentType<unknown> };
    }
  }
  return null;
}

/**
 * 解析指定主题对系统模板的覆盖（不依赖激活主题，供在线预览使用）。
 * 存在模板文件 → 编译并返回；不存在返回 null；编译失败抛错由调用方回退。
 */
export async function resolveSystemTemplateForTheme<T = unknown>(
  themeSlug: string,
  name: SystemTemplateName
): Promise<{ default: ComponentType<T> } | null> {
  if (!THEME_SLUG_RE.test(themeSlug) || !TEMPLATE_NAME_RE.test(name)) return null;

  // 1. 构建期注册表优先：支持 @/ 别名、'use client'、正常参与 Next 编译
  const registered = registryTemplate(themeSlug, name);
  if (registered) return { default: registered.default as ComponentType<T> };

  // 2. 运行时编译兜底：主题刚安装、尚未重启 dev/build 时使用；
  //    仅支持服务端 TSX（不能用 @/ 与 'use client'）
  const root = path.resolve(process.cwd(), 'scripts', 'themes', themeSlug, 'templates');
  for (const file of candidateFiles(name)) {
    const absPath = path.join(root, file);
    if (!fs.existsSync(absPath)) continue;

    const mod = await compileAndLoad(absPath, `theme-${themeSlug}-${name}`);
    const comp = (mod.default ?? mod) as unknown;
    if (typeof comp !== 'function') {
      throw new Error(`主题模板 ${absPath} 缺少 default 导出组件`);
    }
    return { default: comp as ComponentType<T> };
  }
  return null;
}

/**
 * 解析当前激活主题的自定义路由模板（templates/routes/<path>.tsx，挂载于 /t/<path>）。
 * 优先查构建期注册表（支持 @/ 别名与 'use client'），否则运行时编译兜底；
 * 路由不存在返回 null（调用方 notFound）。
 */
export async function resolveThemeRouteTemplate(
  routePath: string
): Promise<{ default: ComponentType<unknown> } | null> {
  if (!TEMPLATE_NAME_RE.test(routePath)) return null;
  const theme = await getActiveTheme();
  if (!theme) return null;

  // 1. 构建期注册表
  const registered = themeRouteRegistry[theme.slug]?.[routePath] as Record<string, unknown> | undefined;
  const comp = registered?.default;
  if (comp && (typeof comp === 'function' || typeof comp === 'object')) {
    return { default: comp as ComponentType<unknown> };
  }

  // 2. 运行时编译兜底（新装/未重启，仅服务端 TSX）
  const absPath = path.join(
    process.cwd(),
    'scripts',
    'themes',
    theme.slug,
    'templates',
    'routes',
    `${routePath}.tsx`
  );
  if (!fs.existsSync(absPath)) return null;

  const mod = await compileAndLoad(absPath, `theme-${theme.slug}-route-${routePath}`);
  const resolved = (mod.default ?? mod) as unknown;
  if (typeof resolved !== 'function') {
    throw new Error(`主题路由模板 ${absPath} 缺少 default 导出组件`);
  }
  return { default: resolved as ComponentType<unknown> };
}

/**
 * 解析当前激活主题对系统模板的覆盖。
 * 存在 scripts/themes/<activeSlug>/templates/<name>.tsx → 编译并返回；
 * 否则返回 null（宿主回退内置模板）。编译失败抛错由调用方回退。
 */
export async function resolveSystemTemplate<T = unknown>(
  name: SystemTemplateName
): Promise<{ default: ComponentType<T> } | null> {
  const theme = await getActiveTheme();
  if (!theme) return null;

  try {
    return await resolveSystemTemplateForTheme<T>(theme.slug, name);
  } catch (err) {
    // 抛出给页面按需处理（多数页面 catch 后回退内置模板）
    throw err;
  }
}

/** 列出主题已提供的系统模板名（后台/文档展示用） */
export function listThemeTemplateFiles(themeSlug: string): string[] {
  if (!THEME_SLUG_RE.test(themeSlug)) return [];
  const root = path.resolve(process.cwd(), 'scripts', 'themes', themeSlug, 'templates');
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => entry.name.replace(/\.tsx$/, ''))
    .sort();
}
