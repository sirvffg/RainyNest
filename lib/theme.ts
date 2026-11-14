// lib/theme.ts — 主题加载器（扫描 scripts/themes 安装态目录，读 theme.json，合并配置，生成 CSS 变量）
import fs from 'node:fs';
import path from 'node:path';
import { db } from './prisma';

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
      themes.push(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')));
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

// 获取当前激活主题（DB + 预编译 theme.js 配置映射）
export async function getActiveTheme(): Promise<ActiveTheme | null> {
  const cached = g.__rnActiveTheme;
  if (cached && Date.now() - cached.at < THEME_CACHE_TTL) return cached.value;

  let theme: ActiveTheme | null = null;
  try {
    // 1. 从数据库找 isActive = true 的主题
    const dbTheme = await db.theme.findFirst({ where: { isActive: true } });
    if (dbTheme) {
      // 2. 读取 theme.json 元数据
      const jsonPath = path.join(THEMES_DIR, dbTheme.slug, 'theme.json');
      if (fs.existsSync(jsonPath)) {
        const meta: ThemeMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

        // 3. 加载 theme.js 的 configToCssVariables
        let configToVars = (config: any) => ({});
        try {
          const compiledTheme = path.join(THEMES_DIR, dbTheme.slug, 'theme.js');
          if (fs.existsSync(compiledTheme)) {
            const mod = nodeRequire(compiledTheme);
            configToVars = mod.configToCssVariables || configToVars;
          }
        } catch { /* 主题没有 theme.js，用默认映射 */ }

        // 4. 合并 DB 存的配置值 + theme.json 默认值
        const mergedConfig = mergeWithDefault(
          meta.configSchema,
          dbTheme.config ? JSON.parse(dbTheme.config) : {}
        );

        // 5. 生成 CSS 变量
        const cssVars = configToVars(mergedConfig);

        theme = {
          ...meta,
          dbId: dbTheme.id,
          config: mergedConfig,
          cssVars,
          customCss: mergedConfig.advanced?.customCss,
          customJs: mergedConfig.advanced?.customJs,
        };
      }
    }
  } catch {
    theme = null;
  }

  g.__rnActiveTheme = { value: theme, at: Date.now() };
  return theme;
}

export function clearThemeCache() {
  g.__rnActiveTheme = undefined;
}
