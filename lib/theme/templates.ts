// lib/theme/templates.ts — 主题覆盖系统页面模板（Halo 风格"主题优先"）
//
// 约定：主题可在 scripts/themes/<slug>/templates/<name>.tsx 放置系统页面模板，
// 存在即覆盖系统内置渲染（当前支持：post-detail）。
//
// 模板为纯服务端 JSX（esbuild 运行时编译为 CJS 后 require）：
// - 可 import：react/jsx-runtime（自动注入）、lucide-react 等 node_modules 内的 CJS 包
// - 不可 import：'@/...' 别名路径、'use client' 组件（评论表单等交互区块
//   由宿主以 ReactNode 插槽 props.slots 传入，主题只决定摆放位置）
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { ComponentType, ReactNode } from 'react';
import { getActiveTheme } from '../theme';

// ── 模板 Props 契约（主题作者可见） ──────────────────────────────

/** 文章详情页模板 props（数据已由宿主取好，模板只管排版） */
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

export type PostDetailTemplate = ComponentType<PostDetailTemplateProps>;

/** 当前支持的系统模板名 */
export type SystemTemplateName = 'post-detail';

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
 * 解析当前激活主题 templates 目录下的模板（相对路径，如 plugins/foo/bar.tsx）。
 * 不直接 import .tsx，统一走运行时编译；路径越界返回 null。
 */
export async function resolveThemeTemplate(
  relPath: string,
  cacheName: string
): Promise<Record<string, unknown> | null> {
  const theme = await getActiveTheme();
  if (!theme) return null;

  const root = path.resolve(process.cwd(), 'scripts', 'themes', theme.slug, 'templates');
  const absPath = path.resolve(root, relPath);
  if (!absPath.startsWith(root + path.sep)) return null;

  return loadTsxModule(absPath, `theme-${theme.slug}-${cacheName}`);
}

/**
 * 解析主题对系统模板的覆盖。
 * 存在 scripts/themes/<activeSlug>/templates/<name>.tsx → 编译并返回；
 * 否则返回 null（宿主回退内置模板）。编译失败抛错由调用方回退。
 */
export async function resolveSystemTemplate(
  name: SystemTemplateName
): Promise<{ default: PostDetailTemplate } | null> {
  const theme = await getActiveTheme();
  if (!theme) return null;

  const absPath = path.join(process.cwd(), 'scripts', 'themes', theme.slug, 'templates', `${name}.tsx`);
  if (!fs.existsSync(absPath)) return null;

  const mod = await compileAndLoad(absPath, name);
  const comp = (mod.default ?? mod) as unknown;
  if (typeof comp !== 'function') {
    throw new Error(`主题模板 ${absPath} 缺少 default 导出组件`);
  }
  return { default: comp as PostDetailTemplate };
}
