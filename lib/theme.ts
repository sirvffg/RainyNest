// lib/theme.ts — 主题加载器（扫描 scripts/themes 安装态目录，读 theme.json，合并配置，生成 CSS 变量）
import fs from 'node:fs';
import path from 'node:path';
import { db } from './prisma';
import { compareSemver, satisfiesCoreVersion, getCoreVersion } from './plugin/semver';

// 安装目录（内置预装与后台上传共用）：theme.json 与 theme.js 同目录
const THEMES_DIR = path.join(process.cwd(), 'scripts', 'themes');

// ⭐ process.getBuiltinModule 运行时取模块，绕过 Turbopack 对 createRequire(计算路径) 的静态分析告警
const nodeRequire = process.getBuiltinModule('node:module').createRequire(
  path.join(process.cwd(), 'package.json')
);

export interface ThemeMeta {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  preview?: string;
  minRainyNestVersion?: string;
  /** 允许的最高核心版本（含），如 "2.0.0" */
  maxRainyNestVersion?: string;
  supports: string[];
  configSchema: Record<string, any>;
}

export interface ActiveTheme extends ThemeMeta {
  dbId: string;
  config: Record<string, any>;
  cssVars: Record<string, string>;
  customCss?: string;
  customJs?: string;
}

// 预览图路径规范化：theme.json 里常写 "preview.png" 相对路径，
// 后台直接放进 <img src> 会以当前页面为基准导致 404，这里统一转为 /themes/<slug>/xxx
function normalizePreview(meta: ThemeMeta, dirSlug: string): ThemeMeta {
  const raw = typeof meta.preview === 'string' ? meta.preview.trim() : '';
  if (!raw) return meta;
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/')) return meta;
  return { ...meta, preview: `/themes/${dirSlug}/${raw.replace(/^\.?\//, '')}` };
}

// 核心版本兼容性检查（theme.json 的 min/max RainyNestVersion；空视为不限制）
export function isThemeCompatible(meta: ThemeMeta): boolean {
  const coreVersion = getCoreVersion();
  if (meta.minRainyNestVersion && !satisfiesCoreVersion(coreVersion, meta.minRainyNestVersion)) {
    return false;
  }
  if (meta.maxRainyNestVersion && compareSemver(coreVersion, meta.maxRainyNestVersion) > 0) {
    return false;
  }
  return true;
}

// 扫描所有已安装主题
export async function scanInstalledThemes(): Promise<ThemeMeta[]> {
  if (!fs.existsSync(THEMES_DIR)) return [];
  const themes: ThemeMeta[] = [];
  for (const dir of fs.readdirSync(THEMES_DIR)) {
    // 跳过安装器备份/待删目录
    if (/(\.bak-\d+|\.deleted-\d+)$/.test(dir)) continue;
    const jsonPath = path.join(THEMES_DIR, dir, 'theme.json');
    if (!fs.existsSync(jsonPath)) continue;
    try {
      themes.push(normalizePreview(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')), dir));
    } catch (err) {
      console.error(`[Theme] ${dir}: theme.json 解析失败`, err);
    }
  }
  return themes;
}

// 辅助：把用户存的配置值和 schema 默认值合并
export function mergeWithDefault(schema: Record<string, any>, userConfig: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, group] of Object.entries(schema || {})) {
    result[key] = {};
    for (const [fieldKey, field] of Object.entries((group as any).fields || {})) {
      const userValue = userConfig?.[key]?.[fieldKey];
      result[key][fieldKey] = userValue !== undefined ? userValue : (field as any).default;
    }
  }
  return result;
}

const g = globalThis as unknown as { __rnActiveTheme?: { value: ActiveTheme | null; at: number } };
const THEME_CACHE_TTL = 30_000;

// 按 slug 读取磁盘 theme.json + DB 配置，生成 ActiveTheme（不校验 isActive）
function loadThemeBySlugSync(slug: string, dbTheme: { id: string; config: string | null } | null): ActiveTheme | null {
  // 1. 读取 theme.json 元数据（目录不存在视为未安装）
  const jsonPath = path.join(THEMES_DIR, slug, 'theme.json');
  if (!fs.existsSync(jsonPath)) return null;
  const rawMeta: ThemeMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const meta = normalizePreview(rawMeta, slug);

  // 1.5 核心版本兼容性：不满足 min/max RainyNestVersion 的主题不可加载
  if (!isThemeCompatible(meta)) {
    console.warn(
      `[Theme] ${slug} 已跳过：要求核心版本 ${meta.minRainyNestVersion ?? '*'} ~ ${meta.maxRainyNestVersion ?? '*'}，当前核心版本 ${getCoreVersion()}`
    );
    return null;
  }

  // 2. 加载 theme.js 的 configToCssVariables
  let configToVars: (config: Record<string, any>) => Record<string, string> = () => ({});
  try {
    const compiledTheme = path.join(THEMES_DIR, slug, 'theme.js');
    if (fs.existsSync(compiledTheme)) {
      const mod = nodeRequire(compiledTheme);
      configToVars = mod.configToCssVariables || configToVars;
    }
  } catch { /* 主题没有 theme.js，用默认映射 */ }

  // 3. 合并 DB 存的配置值 + theme.json 默认值
  const mergedConfig = mergeWithDefault(
    meta.configSchema,
    dbTheme?.config ? JSON.parse(dbTheme.config) : {}
  );

  // 4. 生成 CSS 变量
  const cssVars = configToVars(mergedConfig);

  return {
    ...meta,
    dbId: dbTheme?.id ?? '',
    config: mergedConfig,
    cssVars,
    customCss: mergedConfig.advanced?.customCss,
    customJs: mergedConfig.advanced?.customJs,
  };
}

// 获取当前激活主题（DB + 预编译 theme.js 配置映射）
export async function getActiveTheme(): Promise<ActiveTheme | null> {
  const cached = g.__rnActiveTheme;
  if (cached && Date.now() - cached.at < THEME_CACHE_TTL) return cached.value;

  let theme: ActiveTheme | null = null;
  try {
    // 1. 从数据库找 isActive = true 的主题
    const dbTheme = await db.theme.findFirst({ where: { isActive: true } });
    if (dbTheme) {
      // 2. 读取磁盘元数据 + 合并配置（不依赖激活状态）
      theme = loadThemeBySlugSync(dbTheme.slug, dbTheme);
    }
  } catch {
    theme = null;
  }

  g.__rnActiveTheme = { value: theme, at: Date.now() };
  return theme;
}

// 按 slug 获取任意已安装主题（在线预览用，不要求 isActive）
export async function getThemeBySlug(slug: string): Promise<ActiveTheme | null> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  try {
    const dbTheme = await db.theme.findUnique({ where: { slug } });
    return loadThemeBySlugSync(slug, dbTheme);
  } catch {
    return null;
  }
}

export function clearThemeCache() {
  g.__rnActiveTheme = undefined;
}
